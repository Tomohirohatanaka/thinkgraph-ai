/**
 * teachAI Enhanced Error Boundary
 * ─────────────────────────────────────────────────────────────
 * Production-grade error boundary with:
 *   - Graceful degradation
 *   - Error reporting integration point
 *   - User-friendly recovery UI
 *   - Session data preservation
 */
"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { COLORS, RADIUS, SHADOW, FONT } from "@/lib/design/tokens";
import { KEYFRAMES } from "@/lib/design/animations";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  level?: "page" | "section" | "component";
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Future: send to error tracking service
    console.error("[teachAI Error]", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const level = this.props.level ?? "section";
    const isPage = level === "page";

    return (
      <>
        <style>{KEYFRAMES}</style>
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: isPage ? "80px 24px" : "32px 20px",
            minHeight: isPage ? "60vh" : "auto",
            fontFamily: FONT.family,
            textAlign: "center",
            animation: "fadeSlideIn 0.3s ease-out",
          }}
        >
          <div
            style={{
              width: isPage ? 72 : 56,
              height: isPage ? 72 : 56,
              borderRadius: "50%",
              background: "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: isPage ? 32 : 24,
              marginBottom: 16,
            }}
          >
            😵
          </div>

          <h2
            style={{
              fontSize: isPage ? 22 : 17,
              fontWeight: 800,
              color: COLORS.gray800,
              margin: "0 0 8px",
            }}
          >
            {isPage ? "ページの読み込みに失敗しました" : "表示エラーが発生しました"}
          </h2>

          <p
            style={{
              fontSize: 14,
              color: COLORS.gray500,
              margin: "0 0 24px",
              maxWidth: 360,
              lineHeight: 1.6,
            }}
          >
            {isPage
              ? "アプリケーションで予期しないエラーが発生しました。再読み込みをお試しください。"
              : "この部分の表示に問題がありました。再試行してください。"}
          </p>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "10px 24px",
                background: COLORS.primary,
                color: "#fff",
                border: "none",
                borderRadius: RADIUS.md,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: FONT.family,
                boxShadow: SHADOW.sm,
              }}
            >
              再試行
            </button>
            {isPage && (
              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  padding: "10px 24px",
                  background: "transparent",
                  color: COLORS.gray600,
                  border: `1.5px solid ${COLORS.gray200}`,
                  borderRadius: RADIUS.md,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: FONT.family,
                }}
              >
                トップに戻る
              </button>
            )}
          </div>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <details
              style={{
                marginTop: 32,
                padding: 16,
                background: COLORS.gray50,
                borderRadius: RADIUS.md,
                maxWidth: 600,
                width: "100%",
                textAlign: "left",
                border: `1px solid ${COLORS.gray200}`,
              }}
            >
              <summary
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.gray600,
                  cursor: "pointer",
                }}
              >
                エラー詳細 (開発環境のみ)
              </summary>
              <pre
                style={{
                  fontSize: 12,
                  color: COLORS.error,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  marginTop: 8,
                  padding: 12,
                  background: "#fff",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.gray200}`,
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </>
    );
  }
}
