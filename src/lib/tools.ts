import { V3_TOOLS } from "./tools-v3";
/**
 * teachAI Tool Registry
 * ──────────────────────
 * 全ツール（API エンドポイント）の定義をここに集約。
 * MCP ツール一覧・OpenAPI スペック・フロントエンドのUI説明文
 * すべてこのファイルから自動生成される。
 */

import type { ToolDefinition } from "./api";

export const TOOLS: ToolDefinition[] = [
  // ── 1. コンテンツ取り込み ──────────────────────────────────
  {
    name: "ingest_content",
    description: "URL（YouTube・Web記事）またはテキストを学習コンテンツとして取り込み、タイトル・概要・キーコンセプト・学習モードを抽出する。",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: {
        apiKey:   { type: "string",  description: "Anthropic APIキー（sk-ant-...）", required: true },
        url:      { type: "string",  description: "YouTube URL / Web URL（url か text のどちらか必須）" },
        text:     { type: "string",  description: "直接入力するテキスト内容" },
        fileData: { type: "object",  description: "{ name, base64, mimeType } 形式のファイルデータ（PDF/DOCX/XLSX等）" },
        mode:     { type: "string",  description: "学習モード", enum: ["whynot","vocabulary","concept","procedure"], default: "concept" },
      },
      required: ["apiKey"],
    },
    outputSchema: {
      title: "string",
      summary: "string",
      key_concepts: "string[]",
      mode: "string",
      core_text: "string",
      first_prompt: "string",
      source_url: "string?",
    },
    examples: [
      { input: { url: "https://www.youtube.com/watch?v=xxx", mode: "whynot" }, description: "YouTube動画を取り込む" },
      { input: { text: "...", mode: "vocabulary" }, description: "テキストを直接取り込む" },
    ],
  },

  // ── 2. 教授セッション（1ターン）─────────────────────────────
  {
    name: "teach_turn",
    description: "ユーザーがAIキャラクターに知識を教えるセッションの1ターンを処理する。6ターン目または forceFinish=true で採点結果を返す。",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: {
        apiKey:          { type: "string",  description: "Anthropic APIキー", required: true },
        topic:           { type: "string",  description: "学習トピック名", required: true },
        coreText:        { type: "string",  description: "学習元テキスト（最大20000文字）", required: true },
        mode:            { type: "string",  description: "学習モード", enum: ["whynot","vocabulary","concept","procedure"], required: true },
        history:         { type: "array",   description: "[{ role: 'user'|'ai', text: string }] の会話履歴" },
        userMessage:     { type: "string",  description: "今回のユーザー発言", required: true },
        forceFinish:     { type: "boolean", description: "強制終了フラグ（採点を即座に行う）", default: false },
        character:       { type: "object",  description: "キャラクターオブジェクト" },
        leadingPenalty:  { type: "number",  description: "誘導ペナルティ累積値", default: 0 },
        gaveUpCount:     { type: "number",  description: "諦め回数", default: 0 },
        consecutiveFail: { type: "number",  description: "連続失敗回数", default: 0 },
      },
      required: ["apiKey", "topic", "coreText", "mode", "userMessage"],
    },
    outputSchema: {
      "type: continue": "{ type: 'continue', message: string, leading_penalty: number }",
      "type: complete": "{ type: 'complete', message: string, score: ScoreData, feedback: string, mastered: string[], gaps: string[] }",
      "type: quit":     "{ type: 'quit', message: string }",
    },
  },

  // ── 3. キャラクター管理 ───────────────────────────────────
  {
    name: "get_character",
    description: "デフォルトキャラクターを取得する（APIキー不要）。",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    outputSchema: { character: "Character" },
  },
  {
    name: "init_character",
    description: "学習プロフィールからユーザー専用キャラクターを初回生成する。",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: {
        apiKey:  { type: "string", description: "Anthropic APIキー", required: true },
        profile: { type: "array",  description: "過去セッション履歴" },
      },
      required: ["apiKey"],
    },
    outputSchema: { character: "Character" },
  },
  {
    name: "evolve_character",
    description: "セッション完了後にキャラクターをそのトピックの学習経験に基づいて進化させる。学習テーマが蓄積するにつれて性格・口調・セリフが変化する。",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: {
        apiKey:      { type: "string", description: "Anthropic APIキー", required: true },
        currentChar: { type: "object", description: "現在のキャラクターオブジェクト", required: true },
        session: {
          type: "object",
          description: "完了したセッション情報 { title, mode, score, mastered[], gaps[], feedback }",
          required: true,
        },
      },
      required: ["apiKey", "currentChar", "session"],
    },
    outputSchema: { character: "Character（進化後）" },
  },

  // ── 4. スキルマップ生成 ───────────────────────────────────
  {
    name: "generate_skill_map",
    description: "学習履歴とキャラクターを元に、キャラクター視点のスキルマップを生成する。キャラが何を知っていて何が得意かを可視化する。",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: {
        apiKey:    { type: "string", description: "Anthropic APIキー", required: true },
        profile:   { type: "array",  description: "学習履歴（SessionProfileEntry[]）", required: true },
        character: { type: "object", description: "キャラクターオブジェクト" },
      },
      required: ["apiKey", "profile"],
    },
    outputSchema: {
      char_name: "string", char_emoji: "string",
      skill_level: "見習い|成長中|一人前|熟達",
      summary: "string（キャラの一人称）",
      categories: "SkillCategory[]",
      strengths: "string[]", weak_areas: "string[]",
      next_steps: "string[]",
      total_sessions: "number", avg_score: "number",
      growth_message: "string",
    },
  },

  // ── 5. 思考グラフ面接（オプション機能）──────────────────────
  {
    name: "interview_turn",
    description: "論理グラフ構造を用いた思考力評価面接の1ターンを処理する。理想グラフと比較しながら深掘り質問を生成する。",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: {
        apiKey:       { type: "string", description: "Anthropic APIキー", required: true },
        domain:       { type: "string", description: "評価ドメイン名", required: true },
        idealGraph:   { type: "object", description: "理想的な知識構造グラフ", required: true },
        conversation: { type: "array",  description: "会話履歴" },
        turn:         { type: "number", description: "現在のターン番号" },
      },
      required: ["apiKey", "domain", "idealGraph"],
    },
  },
];

// ツール名からツール定義を引くユーティリティ
export const ALL_TOOLS = [...TOOLS, ...V3_TOOLS];
export const TOOL_MAP = Object.fromEntries(ALL_TOOLS.map(t => [t.name, t]));
