import { NextRequest, NextResponse } from "next/server";
import { callLLM, detectProvider } from "@/lib/llm";
import { CORS_HEADERS, corsResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  let apiKey = "";
  try {
    const body = await req.json();
    apiKey = body.apiKey || "";
    
    if (!apiKey) {
      return NextResponse.json({ error: "APIキーが入力されていません" }, { status: 400 });
    }
    const provider = detectProvider(apiKey);
    await callLLM({
      provider,
      apiKey,
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 10,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("API test error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    // Parse Anthropic error
    const authErr = msg.includes("authentication_error") || msg.includes("401");
    const permErr = msg.includes("permission") || msg.includes("403");
    if (authErr) {
      return NextResponse.json({ error: "APIキーが無効です。Anthropicコンソールで確認してください。" }, { status: 400 });
    }
    if (permErr) {
      return NextResponse.json({ error: "APIキーの権限が不足しています。" }, { status: 400 });
    }
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 400 });
  }
}

// ─── CORS Preflight ──────────────────────────────────────────
export async function OPTIONS() { return corsResponse(); }
