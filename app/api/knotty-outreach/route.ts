import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type OutreachInput = {
  message?: unknown;
  history?: unknown;
  linkAlreadySent?: unknown;
};

type KnottyResult = {
  action: "reply" | "stop";
  reply: string;
  linkSent?: boolean;
  mode?: "ai" | "fallback";
};

const ALLOWED_ORIGIN = /^https:\/\/(?:[a-z0-9-]+\.)*sniffies\.com$/i;
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 30;
const MAX_HISTORY_TURNS = 8;
const MAX_MESSAGE_CHARS = 1200;
const MAX_REPLY_CHARS = 320;

const rate = new Map<string, { count: number; resetAt: number }>();

function originHeaders(origin: string | null) {
  if (!origin || !ALLOWED_ORIGIN.test(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
}

function clientKey(request: NextRequest) {
  const ip = (request.headers.get("x-forwarded-for") || "")
    .split(",")[0]
    ?.trim();
  return ip || "unknown";
}

function allowRequest(key: string) {
  const now = Date.now();
  const current = rate.get(key);

  if (!current || now >= current.resetAt) {
    rate.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  current.count += 1;
  return current.count <= MAX_PER_WINDOW;
}

function cleanText(value: unknown, max = MAX_MESSAGE_CHARS) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function safeHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => {
      const raw = turn as { role?: unknown; content?: unknown };
      const role = raw.role === "assistant" ? "assistant" : "user";
      return {
        role,
        content: cleanText(raw.content, 600),
      } satisfies ChatTurn;
    })
    .filter((turn) => Boolean(turn.content));
}

function wantsStop(message: string) {
  return /\b(stop|not interested|no thanks|no thank you|leave me alone|don't message|do not message|don't contact|do not contact|unsubscribe|fuck off|go away)\b/i.test(
    message,
  );
}

function needsHumanStop(message: string) {
  return /\b(minor|underage|police|lawyer|attorney|lawsuit|sue you|harassment|harassing|report you|threat|threaten)\b/i.test(
    message,
  );
}

function asksWho(message: string) {
  return /\b(who are you|are you a bot|are you ai|is this ai|what are you|who's this|who is this)\b/i.test(
    message,
  );
}

function showsProductInterest(message: string) {
  return /\b(piroka|what app|which app|send.*link|what's the link|whats the link|tell me more|interested|privacy|fake profiles?|scammers?|scam|nearby|alternative|something new)\b/i.test(
    message,
  );
}

function deterministicFallback(
  message: string,
  linkAlreadySent: boolean,
): KnottyResult {
  if (wantsStop(message) || needsHumanStop(message)) {
    return { action: "stop", reply: "", mode: "fallback" };
  }

  if (asksWho(message)) {
    return {
      action: "reply",
      reply: "I'm Knotty, PIROKA's AI assistant. I can tell you what the app is about or send the link if you want.",
      mode: "fallback",
    };
  }

  if (showsProductInterest(message)) {
    const reply = linkAlreadySent
      ? "Yeah — PIROKA is focused on nearby discovery with more privacy control. What do you wanna know?"
      : "That's why I mentioned PIROKA 👀 It's built around nearby discovery + more privacy control: https://www.pirokaapp.com";

    return {
      action: "reply",
      reply,
      linkSent: !linkAlreadySent,
      mode: "fallback",
    };
  }

  return {
    action: "reply",
    reply: "Got you 😈 What do you usually look for when you're checking who's nearby?",
    mode: "fallback",
  };
}

function extractJsonObject(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/i)?.[1] ?? trimmed;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(fenced.slice(start, end + 1)) as {
      action?: unknown;
      reply?: unknown;
      linkSent?: unknown;
    };
  } catch {
    return null;
  }
}

async function anthropicReply(
  message: string,
  history: ChatTurn[],
  linkAlreadySent: boolean,
): Promise<KnottyResult | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const system = [
    "You are Knotty, PIROKA's AI outreach assistant.",
    "This is a reply assistant for ONE already-open conversation. Never initiate a new conversation or suggest mass messaging.",
    "The person already received a short opener. Reply only to the person's actual incoming message.",
    "Style: natural American casual/slang, concise, usually one sentence and never more than two short sentences.",
    "Do not pretend to be a human. If asked who or what you are, clearly say you are Knotty, PIROKA's AI assistant.",
    "Never claim PIROKA eliminates scams or guarantees safety. Never invent verification, user counts, features, availability, or policies.",
    "Do not pressure or repeatedly pitch. If they say no, stop, not interested, leave me alone, or similar, return action=stop and an empty reply.",
    "If they raise threats, police, lawyers, harassment, minors, or underage topics, return action=stop and an empty reply.",
    "Do not engage in explicit sexual roleplay or explicit sexual instructions. Keep the conversation focused on the app.",
    "Mention PIROKA only when relevant to what they said or when they ask what this is.",
    linkAlreadySent
      ? "The PIROKA link has already been sent. Do not send it again."
      : "If there is a natural opening and they show interest, you may send this link once: https://www.pirokaapp.com",
    "Never disparage Sniffies. You may acknowledge the person's own frustration without making unsupported claims about another service.",
    "Return STRICT JSON only with this shape: {\"action\":\"reply\"|\"stop\",\"reply\":\"...\",\"linkSent\":true|false}.",
    `Keep reply under ${MAX_REPLY_CHARS} characters.`,
  ].join("\n");

  const messages = [
    ...history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user" as const, content: message },
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
        max_tokens: 180,
        temperature: 0.45,
        system,
        messages,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error("[knotty-outreach] anthropic error", response.status);
      return null;
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };

    const raw = (data.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("")
      .trim();

    const parsed = extractJsonObject(raw);
    if (!parsed) return null;

    if (parsed.action === "stop") {
      return { action: "stop", reply: "", mode: "ai" };
    }

    const reply = cleanText(parsed.reply, MAX_REPLY_CHARS);
    if (!reply) return null;

    return {
      action: "reply",
      reply,
      linkSent:
        parsed.linkSent === true ||
        /https?:\/\/(?:www\.)?pirokaapp\.com/i.test(reply),
      mode: "ai",
    };
  } catch (error) {
    console.error("[knotty-outreach] anthropic request failed", error);
    return null;
  }
}

export async function OPTIONS(request: NextRequest) {
  const headers = originHeaders(request.headers.get("origin"));
  if (!headers) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
  const headers = originHeaders(request.headers.get("origin"));
  if (!headers) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  if (!allowRequest(clientKey(request))) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers },
    );
  }

  let body: OutreachInput;
  try {
    body = (await request.json()) as OutreachInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  const message = cleanText(body.message);
  if (!message) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400, headers },
    );
  }

  const history = safeHistory(body.history);
  const linkAlreadySent = body.linkAlreadySent === true;

  if (wantsStop(message) || needsHumanStop(message)) {
    return NextResponse.json(
      { action: "stop", reply: "", mode: "fallback" } satisfies KnottyResult,
      { headers },
    );
  }

  const ai = await anthropicReply(message, history, linkAlreadySent);
  const result = ai ?? deterministicFallback(message, linkAlreadySent);

  return NextResponse.json(result, { headers });
}
