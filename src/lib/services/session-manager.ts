/**
 * teachAI Session Manager
 * ─────────────────────────────────────────────────────────────
 * Manages the lifecycle of teaching sessions with proper
 * state transitions, error recovery, and data persistence.
 *
 * Replaces ad-hoc session management scattered across components.
 */

export type SessionStatus = "idle" | "loading" | "ready" | "active" | "scoring" | "completed" | "error";

export interface SessionConfig {
  topic: string;
  summary: string;
  keyConcepts: string[];
  mode: "whynot" | "vocabulary" | "concept" | "procedure";
  coreText: string;
  firstPrompt: string;
  questionSeeds: string[];
  sourceUrl?: string;
}

export interface SessionTurn {
  role: "user" | "ai";
  text: string;
  timestamp: number;
  rqs?: number;
  state?: string;
  kbMode?: string;
}

export interface SessionState {
  id: string;
  status: SessionStatus;
  config: SessionConfig | null;
  turns: SessionTurn[];
  currentTurn: number;
  maxTurns: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  // v3 tracking
  rqsHistory: number[];
  stateHistory: Array<{ turn: number; from: string; to: string; rqs: number; reason: string }>;
  currentState: string;
  kbSignals: Array<{ turn: number; mode: string }>;
}

export function createInitialSessionState(): SessionState {
  return {
    id: generateSessionId(),
    status: "idle",
    config: null,
    turns: [],
    currentTurn: 0,
    maxTurns: 6,
    startedAt: null,
    completedAt: null,
    error: null,
    rqsHistory: [],
    stateHistory: [],
    currentState: "ORIENT",
    kbSignals: [],
  };
}

function generateSessionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Session State Machine ──────────────────────────────────

export type SessionAction =
  | { type: "START_INGEST" }
  | { type: "INGEST_SUCCESS"; config: SessionConfig }
  | { type: "INGEST_ERROR"; error: string }
  | { type: "ADD_AI_TURN"; text: string; state?: string }
  | { type: "ADD_USER_TURN"; text: string; rqs?: number; kbMode?: string }
  | { type: "UPDATE_STATE"; nextState: string; reason: string; rqs: number }
  | { type: "START_SCORING" }
  | { type: "COMPLETE"; result: unknown }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "START_INGEST":
      return { ...state, status: "loading", error: null };

    case "INGEST_SUCCESS":
      return {
        ...state,
        status: "ready",
        config: action.config,
        error: null,
      };

    case "INGEST_ERROR":
      return { ...state, status: "error", error: action.error };

    case "ADD_AI_TURN":
      return {
        ...state,
        status: "active",
        startedAt: state.startedAt ?? Date.now(),
        turns: [
          ...state.turns,
          {
            role: "ai",
            text: action.text,
            timestamp: Date.now(),
            state: action.state,
          },
        ],
      };

    case "ADD_USER_TURN":
      return {
        ...state,
        turns: [
          ...state.turns,
          {
            role: "user",
            text: action.text,
            timestamp: Date.now(),
            rqs: action.rqs,
            kbMode: action.kbMode,
          },
        ],
        currentTurn: state.currentTurn + 1,
        rqsHistory: action.rqs !== undefined
          ? [...state.rqsHistory, action.rqs]
          : state.rqsHistory,
        kbSignals: action.kbMode
          ? [...state.kbSignals, { turn: state.currentTurn + 1, mode: action.kbMode }]
          : state.kbSignals,
      };

    case "UPDATE_STATE":
      return {
        ...state,
        currentState: action.nextState,
        stateHistory: [
          ...state.stateHistory,
          {
            turn: state.currentTurn,
            from: state.currentState,
            to: action.nextState,
            rqs: action.rqs,
            reason: action.reason,
          },
        ],
      };

    case "START_SCORING":
      return { ...state, status: "scoring" };

    case "COMPLETE":
      return {
        ...state,
        status: "completed",
        completedAt: Date.now(),
      };

    case "ERROR":
      return { ...state, status: "error", error: action.error };

    case "RESET":
      return createInitialSessionState();

    default:
      return state;
  }
}

// ─── Session Duration ───────────────────────────────────────

export function getSessionDuration(state: SessionState): number {
  if (!state.startedAt) return 0;
  const end = state.completedAt ?? Date.now();
  return Math.round((end - state.startedAt) / 1000);
}

// ─── Session Validation ─────────────────────────────────────

export function canSubmitMessage(state: SessionState): boolean {
  return (
    state.status === "active" &&
    state.currentTurn < state.maxTurns &&
    state.config !== null
  );
}

export function shouldFinishSession(state: SessionState, forceFinish = false): boolean {
  return forceFinish || state.currentTurn >= state.maxTurns - 1;
}
