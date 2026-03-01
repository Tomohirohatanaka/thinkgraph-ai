/**
 * teachAI Web Content Extractor
 * ─────────────────────────────────────────────────────────────
 * どんなURLからでも学習用テキストを抽出するユーティリティ。
 *
 * 対応:
 *   - YouTube (字幕 / oEmbed)
 *   - 一般Webページ (Readability風のHTMLクリーニング)
 *   - Wikipedia
 *   - note.com / Zenn / Qiita (日本語技術記事)
 *   - テキスト直接入力
 *
 * サーバーサイド専用 (Node.js / Edge Runtime)
 */

export interface ExtractResult {
  title: string;
  text: string;           // メインテキスト（最大20000文字）
  source_url: string;
  type: "youtube" | "web" | "text";
  author?: string;
  published?: string;
  word_count: number;
}

// ─── ディスパッチャー ────────────────────────────────────────

export async function extractContent(input: {
  url?: string;
  text?: string;
}): Promise<ExtractResult> {
  if (input.text?.trim()) {
    return {
      title: input.text.slice(0, 60).trim() + "...",
      text: input.text.slice(0, 20000),
      source_url: "",
      type: "text",
      word_count: input.text.length,
    };
  }

  if (!input.url?.trim()) throw new Error("URLまたはテキストが必要です");

  const url = input.url.trim();

  // YouTube
  const ytId = extractYouTubeId(url);
  if (ytId) return extractYouTube(ytId, url);

  // 一般URL
  return extractWebPage(url);
}

// ─── YouTube ─────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function extractYouTube(videoId: string, url: string): Promise<ExtractResult> {
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

  // youtube-transcript library
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    for (const lang of ["ja", "en"]) {
      try {
        const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        if (items?.length > 0) {
          transcript = items.map((i: { text: string }) => i.text).join(" ").replace(/\s+/g, " ").trim();
          if (transcript.length > 100) break;
        }
      } catch { /* try next */ }
    }
  } catch { /* library unavailable */ }

  // timedtext API fallback
  if (!transcript) {
    for (const lang of ["ja", "en", "ja-JP", "en-US"]) {
      try {
        const r = await fetch(`https://video.google.com/timedtext?lang=${lang}&v=${videoId}`);
        if (r.ok) {
          const xml = await r.text();
          const texts = xml.match(/<text[^>]*>(.*?)<\/text>/g);
          if (texts?.length) {
            transcript = texts.map(t => t.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'").replace(/&amp;/g, "&")).join(" ");
            if (transcript.length > 100) break;
          }
        }
      } catch { /* try next */ }
    }
  }

  const text = [
    `タイトル: ${title}`,
    author ? `チャンネル: ${author}` : "",
    transcript ? `\n字幕テキスト:\n${transcript}` : "\n（字幕が取得できませんでした）",
  ].filter(Boolean).join("\n");

  return {
    title,
    text: text.slice(0, 20000),
    source_url: `https://www.youtube.com/watch?v=${videoId}`,
    type: "youtube",
    author,
    word_count: transcript.length,
  };
}

// ─── 一般Webページ ──────────────────────────────────────────

async function extractWebPage(url: string): Promise<ExtractResult> {
  // まず jina.ai Reader API を試す（最高精度、Markdown変換）
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "markdown",
        "X-Timeout": "10",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const md = await res.text();
      if (md.length > 200) {
        const title = md.match(/^#\s+(.+)/m)?.[1]?.trim()
          ?? md.match(/Title:\s*(.+)/)?.[1]?.trim()
          ?? url;
        return {
          title,
          text: md.slice(0, 20000),
          source_url: url,
          type: "web",
          word_count: md.length,
        };
      }
    }
  } catch { /* fallback */ }

  // 直接fetchしてHTMLをクリーニング
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; teachAI/1.0; +https://teachai.vercel.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const { title, text } = parseHTML(html, url);

    return {
      title,
      text: text.slice(0, 20000),
      source_url: url,
      type: "web",
      word_count: text.length,
    };
  } catch (e) {
    throw new Error(`Webページの取得に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── HTML → テキスト変換 ─────────────────────────────────────

function parseHTML(html: string, url: string): { title: string; text: string } {
  // タイトル抽出
  let title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? url;
  title = decodeHTMLEntities(title);

  // OGP タイトルがあれば優先
  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)?.[1];
  if (ogTitle) title = decodeHTMLEntities(ogTitle);

  // 除去する要素
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  cleaned = decodeHTMLEntities(cleaned);

  // 短い行（ナビ残骸）を除去
  const lines = cleaned.split(/\s{2,}/).filter(l => l.trim().length > 20);
  const text = lines.join("\n").slice(0, 20000);

  return { title, text };
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, "...")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}
