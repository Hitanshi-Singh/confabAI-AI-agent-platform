import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import OpenAI from "openai";

import { db } from "@/db";
import { agents, meetings, messages } from "@/db/schema";
import { auth } from "@/lib/auth";

const openai = new OpenAI();

const TUTOR_BEHAVIOR = `- Be encouraging and patient.
- If the student seems stuck, ask one short follow-up question instead of giving the full answer.
- Stay strictly within the subject defined by your persona above.
- Never claim to be an AI or apologize for being one.`;

const VOICE_FORMAT = `- Reply in 1 to 2 short sentences, no more than 30 words.
- Plain text only. No markdown, no asterisks, no bullets, no code fences, no headings.
- Write as natural spoken English; prefer short common words.
- No preamble like "Sure," "Of course," or "Great question."`;

const CONTEXT_NOTE = `Only the most recent turns of the conversation are included below. Earlier turns may have been trimmed; do not refer to them.`;

// Keep the prompt bounded: last 6 user/agent pairs.
// Older context is captured by the post-meeting summary job.
const HISTORY_TURNS = 12;

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meetingId, userText } = (await req.json()) as {
    meetingId?: string;
    userText?: string;
  };
  if (!meetingId || !userText) {
    return NextResponse.json(
      { error: "Missing meetingId or userText" },
      { status: 400 },
    );
  }

  const [meeting] = await db
    .select({ id: meetings.id, agentId: meetings.agentId, status: meetings.status })
    .from(meetings)
    .where(
      and(eq(meetings.id, meetingId), eq(meetings.userId, session.user.id)),
    );
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  if (meeting.status !== "active" && meeting.status !== "upcoming") {
    return NextResponse.json(
      { error: `Meeting is ${meeting.status} — chat is closed.` },
      { status: 409 },
    );
  }

  const [agent] = await db
    .select({ instructions: agents.instructions })
    .from(agents)
    .where(eq(agents.id, meeting.agentId));
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Load prior messages. The current user turn is NOT persisted here — it is
  // appended in-memory below and saved together with the assistant reply only
  // after a successful model call, so a failed call leaves no orphan message.
  const history = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.meetingId, meetingId))
    .orderBy(asc(messages.createdAt));

  const systemText = [
    "[L1 — PERSONA]",
    agent.instructions || "",
    "",
    "[L2 — TUTOR BEHAVIOR]",
    TUTOR_BEHAVIOR,
    "",
    "[L3 — VOICE FORMAT]",
    VOICE_FORMAT,
    "",
    "[L4 — CONTEXT NOTE]",
    CONTEXT_NOTE,
  ].join("\n").trim();

  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemText },
    ...history.slice(-HISTORY_TURNS).map(
      (m): OpenAI.Chat.Completions.ChatCompletionMessageParam =>
        m.role === "user"
          ? { role: "user", content: m.content }
          : { role: "assistant", content: m.content },
    ),
    { role: "user", content: userText },
  ];

  let text = "";
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      reasoning_effort: "none",
      max_completion_tokens: 400,
      messages: chatMessages,
    });

    text = (response.choices[0]?.message?.content ?? "").trim();
  } catch (err) {
    console.error("[agent-chat] openai error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "OpenAI call failed" },
      { status: 502 },
    );
  }

  if (!text) {
    console.warn("[agent-chat] empty response from model");
    return NextResponse.json(
      { error: "Empty response from the model" },
      { status: 502 },
    );
  }

  // Persist both turns now, after a successful generation. Two sequential
  // inserts (not a batch) so each row gets a distinct created_at and the
  // transcript keeps user-before-assistant order.
  await db.insert(messages).values({
    meetingId,
    role: "user",
    content: userText,
  });
  await db.insert(messages).values({
    meetingId,
    role: "assistant",
    content: text,
  });

  return NextResponse.json({ text });
}
