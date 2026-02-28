import { NextRequest, NextResponse } from "next/server";
import { callLLM, detectProvider, LLMContentPart } from "@/lib/llm";
import { CORS_HEADERS, corsResponse } from "@/lib/api";

// ─── YouTube ─────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fetchYouTubeContent(videoId: string): Promise<string> {
  let title = `YouTube動画 (${videoId})`;
  let author = "";
  try {
    const oe = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (oe.ok) {
      const d = await oe.json() as { title?: string; author_name?: string };
      if (d.title) title = d.title;
      if (d.author_name) author = d.author_name;
    }
  } catch { /* continue */ }

  let transcript = "";
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    for (const lang of ["ja", "en"]) {
      try {
        const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        if (items && items.length > 0) {
          transcript = items.map((i: { text: string }) => i.text).join(" ").replace(/\s+/g, " ").trim();
          if (transcript.length > 100) break;
        }
      } catch { /* try next lang */ }
    }
  } catch { /* library unavailable */ }

  if (!transcript) {
    for (const lang of ["ja", "en", "ja-JP", "en-US"]) {
      try {
        const res = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`,
          { headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" } });
        if (res.ok) {
          const d = await res.json() as { events?: { segs?: { utf8: string }[] }[] };
          const t = (d.events || []).filter(e => e.segs).map(e => (e.segs || []).map(s => s.utf8).join("")).join(" ").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
          if (t.length > 100) { transcript = t; break; }
        }
      } catch { /* try next */ }
    }
  }

  if (!transcript) {
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`,
        { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ja,en;q=0.9" } });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const captionMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])\s*,\s*"audioTracks"/);
        if (captionMatch) {
          const tracks = JSON.parse(captionMatch[1]) as Array<{ baseUrl?: string; languageCode?: string }>;
          const preferredTrack = tracks.find(t => t.languageCode?.startsWith("ja")) || tracks.find(t => t.languageCode?.startsWith("en")) || tracks[0];
          if (preferredTrack?.baseUrl) {
            const capRes = await fetch(preferredTrack.baseUrl + "&fmt=json3");
            if (capRes.ok) {
              const capData = await capRes.json() as { events?: { segs?: { utf8: string }[] }[] };
              transcript = (capData.events || []).filter(e => e.segs).map(e => (e.segs || []).map(s => s.utf8).join("")).join(" ").replace(/\s+/g, " ").trim();
            }
          }
        }
        const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
        const description = descMatch ? descMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').slice(0, 500) : "";
        if (description && !transcript) {
          return `YouTube動画タイトル: ${title}\nチャンネル: ${author}\n\n概要欄:\n${description}\n\n※字幕が取得できませんでした。`;
        }
      }
    } catch { /* ignore */ }
  }

  if (transcript) {
    const trimmed = transcript.length > 20000 ? transcript.slice(0, 14000) + "\n\n[...中略...]\n\n" + transcript.slice(-4000) : transcript;
    return `YouTube動画タイトル: ${title}\nチャンネル: ${author}\n\n字幕（全文）:\n${trimmed}`;
  }
  return `YouTube動画タイトル: ${title}\nチャンネル: ${author}\n\n※字幕が取得できませんでした。`;
}

// ─── Web scraping ─────────────────────────────────────────────
async function fetchWebContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "text/html,application/xhtml+xml", "Accept-Language": "ja,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, aside, .ad, .advertisement, .sidebar, [role=banner], [role=navigation]").remove();
  const metaTitle = $("title").text().trim() || $('meta[property="og:title"]').attr("content") || "";
  const metaDesc = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
  const mainSelectors = ["article", "main", '[role="main"]', ".content", ".post", ".entry", "#content", "#main", "body"];
  let mainText = "";
  for (const sel of mainSelectors) {
    const el = $(sel);
    if (el.length) { const text = el.text().replace(/\s+/g, " ").trim(); if (text.length > 200) { mainText = text; break; } }
  }
  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => { const t = $(el).text().trim(); if (t) headings.push(`[${el.tagName.toUpperCase()}] ${t}`); });
  const paragraphs: string[] = [];
  $("p, li, td, blockquote").each((_, el) => { const t = $(el).text().replace(/\s+/g, " ").trim(); if (t.length > 30) paragraphs.push(t); });
  const combined = [
    metaTitle && `ページタイトル: ${metaTitle}`,
    metaDesc && `概要: ${metaDesc}`,
    headings.length && `\n見出し構造:\n${headings.slice(0, 20).join("\n")}`,
    "\n本文:\n" + (mainText || paragraphs.join("\n")).slice(0, 14000),
  ].filter(Boolean).join("\n");
  return combined.slice(0, 20000);
}

// ─── PDF ──────────────────────────────────────────────────────
async function extractPDF(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text.replace(/\s+/g, " ").trim().slice(0, 20000);
  } catch {
    return ""; // フォールバック: 空文字（呼び出し元でbase64を直接LLMに渡す）
  }
}

// ─── DOCX ─────────────────────────────────────────────────────
async function extractDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.replace(/\s+/g, " ").trim().slice(0, 20000);
}

// ─── XLSX ─────────────────────────────────────────────────────
async function extractXLSX(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];
  for (const sheetName of wb.SheetNames.slice(0, 5)) {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws);
    lines.push(`=== シート: ${sheetName} ===\n${csv.slice(0, 4000)}`);
  }
  return lines.join("\n\n").slice(0, 20000);
}

// ─── PPTX ────────────────────────────────────────────────────
async function extractPPTX(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter(f => f.match(/ppt\/slides\/slide[0-9]+\.xml$/))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
      const nb = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
      return na - nb;
    });
  const slides: string[] = [];
  for (const [idx, file] of slideFiles.slice(0, 30).entries()) {
    const xml = await zip.files[file].async("string");
    const text = xml.replace(/<a:p[^>]*>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#[0-9]+;/g, " ").replace(/\s+/g, " ").trim();
    if (text.length > 10) slides.push(`[スライド${idx + 1}] ${text}`);
  }
  return slides.join("\n").slice(0, 20000);
}

// ─── LLMプロンプト生成 ──────────────────────────────────────
function buildIngestPrompt(rawContent: string): string {
  return `以下のコンテンツから学習トピックを抽出してください。コンテンツの内容・文脈・要点を漏れなく読み取り、学習価値の高いポイントを整理してください。

コンテンツ:
${rawContent.slice(0, 18000)}

JSON形式のみ返答:
{
  "title": "学習トピック名（20文字以内）",
  "summary": "このトピックの概要（2〜3文）",
  "key_concepts": ["重要概念1", "重要概念2", "重要概念3", "重要概念4", "重要概念5"],
  "mode": "whynot|vocabulary|concept|procedure のいずれか",
  "core_text": "学習の核心内容・重要ポイントを詳しく（800〜1500文字）",
  "first_prompt": "最初の入口となる一番やさしい問い（例: 「○○ってそもそも何なの？一言で教えて！」）",
  "question_seeds": [
    "2ターン目用: 具体例を求める問い（答えやすい）",
    "3ターン目用: 仕組み・理由を掘り下げる問い",
    "4ターン目用: 概念間のつながりを問う問い",
    "5ターン目用: 全体を統合する総仕上げの問い"
  ]
}

modeの選択基準: whynot=なぜそうなるか/問題解決, vocabulary=専門用語/定義, concept=概念/理論の理解, procedure=手順/プロセス/How-to`;
}

const SYSTEM_PROMPT = `あなたは学習コンテンツ設計の専門家です。与えられたコンテンツから学習トピックを抽出し、指定のJSON形式で返します。JSONのみを出力してください。前置き・後置き・コードブロック不要。`;

// ─── Main handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let step = "start";
  try {
    step = "parse_body";
    const body = await req.json();
    const { apiKey = "", url = "", text = "", file } = body as {
      apiKey: string; url: string; text: string;
      file?: { name: string; base64: string; mimeType: string };
    };

    step = "validate_key";
    if (!apiKey?.length) return NextResponse.json({ error: "有効なAPIキーを入力してください" }, { status: 400 });

    step = "create_client";
    const provider = detectProvider(apiKey);

    // ── コンテンツ構築 ──
    let rawContent = text;
    let llmContentParts: LLMContentPart[] | null = null; // マルチモーダル用

    if (file?.base64) {
      step = "extract_file";
      const buffer = Buffer.from(file.base64, "base64");
      const name = (file.name || "").toLowerCase();
      const mime = (file.mimeType || "").toLowerCase();

      if (mime.includes("pdf") || name.endsWith(".pdf")) {
        // まずテキスト抽出を試みる
        const pdfText = await extractPDF(buffer);
        if (pdfText && pdfText.length > 50) {
          rawContent = `【PDFファイル: ${file.name}】\n\n${pdfText}`;
        } else if (provider === "anthropic") {
          // Claude: document blockでPDFを直接渡す
          llmContentParts = [
            { type: "pdf", base64: file.base64 },
            { type: "text", text: buildIngestPrompt("（上記PDFの内容を参照してください）").replace("コンテンツ:\n（上記PDFの内容を参照してください）\n\n", "") },
          ];
        } else {
          return NextResponse.json({ error: "PDFのテキスト抽出に失敗しました。Claude APIキーを使用するとPDFを直接解析できます。" }, { status: 400 });
        }
      } else if (mime.includes("officedocument.wordprocessingml") || name.endsWith(".docx") || name.endsWith(".doc")) {
        rawContent = `【Wordドキュメント: ${file.name}】\n\n` + await extractDOCX(buffer);
      } else if (mime.includes("officedocument.spreadsheetml") || name.endsWith(".xlsx") || name.endsWith(".xls")) {
        rawContent = `【Excelファイル: ${file.name}】\n\n` + await extractXLSX(buffer);
      } else if (mime.includes("officedocument.presentationml") || name.endsWith(".pptx") || name.endsWith(".ppt")) {
        rawContent = `【PowerPointファイル: ${file.name}】\n\n` + await extractPPTX(buffer);
      } else if (mime.includes("text") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
        rawContent = buffer.toString("utf-8").slice(0, 20000);
      } else if (mime.startsWith("image/") || name.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
        // 画像: ビジョン対応LLMに直接渡す
        const imageMime = mime || (name.endsWith(".jpg") || name.endsWith(".jpeg") ? "image/jpeg" : name.endsWith(".png") ? "image/png" : name.endsWith(".gif") ? "image/gif" : "image/webp");
        if (provider === "anthropic" || provider === "openai" || provider === "gemini") {
          llmContentParts = [
            { type: "image", mimeType: imageMime, base64: file.base64 },
            { type: "text", text: `この画像の内容から学習トピックを抽出してください。\n\n` + buildIngestPrompt("（上記画像の内容を参照してください）").replace("コンテンツ:\n（上記画像の内容を参照してください）\n\n", "") },
          ];
        } else {
          return NextResponse.json({ error: "画像ファイルはClaude・GPT・Geminiのみ対応しています。" }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: "対応していないファイル形式です（PDF, DOCX, XLSX, PPTX, TXT, JPG, PNG, GIF, WebPに対応）" }, { status: 400 });
      }
    } else if (url.trim()) {
      step = "fetch_url";
      const ytId = extractYouTubeId(url);
      if (ytId) {
        rawContent = await fetchYouTubeContent(ytId);
      } else {
        rawContent = await fetchWebContent(url);
      }
    }

    if (!llmContentParts && (!rawContent || rawContent.length < 20)) {
      return NextResponse.json({ error: "コンテンツを取得できませんでした" }, { status: 400 });
    }

    // ── LLM呼び出し ──
    step = "call_api";
    const llmRes = await callLLM({
      provider,
      apiKey,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: llmContentParts ?? buildIngestPrompt(rawContent),
      }],
      maxTokens: 2000,
    });

    step = "parse_response";
    const raw = llmRes.text;
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: `解析失敗: ${cleaned.slice(0, 100)}` }, { status: 500 });

    const data = JSON.parse(match[0]);

    return NextResponse.json({
      title: data.title || "学習トピック",
      summary: data.summary || "",
      key_concepts: Array.isArray(data.key_concepts) ? data.key_concepts : [],
      mode: data.mode || "concept",
      core_text: data.core_text || rawContent.slice(0, 1500),
      first_prompt: data.first_prompt || `${data.title || "このトピック"}って、一言でいうとどんなもの？`,
      question_seeds: Array.isArray(data.question_seeds) ? data.question_seeds : [],
      source_url: url || null,
      word_count: rawContent.length,
      provider,
    }, { headers: CORS_HEADERS });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? (e.stack || "").split("\n").slice(0, 4).join(" | ") : "";
    console.error(`[ingest] step=${step} error=${msg}`);
    return NextResponse.json({ error: `[${step}] ${msg}`, detail: stack }, { status: 500 });
  }
}

export async function OPTIONS() { return corsResponse(); }
