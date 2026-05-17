import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

import { db } from "@/db";
import { agents, meetings, messages } from "@/db/schema";
import { auth } from "@/lib/auth";

const anthropic = new Anthropic();

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

  await db.insert(messages).values({
    meetingId,
    role: "user",
    content: userText,
  });

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

  let text = "";
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 120,
      system: [
        {
          type: "text",
          text: systemText,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: history.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.content })),
    });

    text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (err) {
    console.error("[agent-chat] anthropic error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Anthropic call failed" },
      { status: 502 },
    );
  }

  if (!text) {
    console.warn("[agent-chat] empty response from Claude");
    return NextResponse.json(
      { error: "Empty response from Claude" },
      { status: 502 },
    );
  }

  await db.insert(messages).values({
    meetingId,
    role: "assistant",
    content: text,
  });

  return NextResponse.json({ text });
}
