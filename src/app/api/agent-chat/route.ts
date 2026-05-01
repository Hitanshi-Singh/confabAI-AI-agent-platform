import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

import { db } from "@/db";
import { agents, meetings, messages } from "@/db/schema";
import { auth } from "@/lib/auth";

const anthropic = new Anthropic();

const BREVITY_RULE =
  "Respond in 1-2 short sentences. Be direct and to the point. No preamble, no filler. " +
  "Plain text only — no markdown, no asterisks, no hashtags, no bullet points, no code blocks. " +
  "Your response will be spoken aloud, so write it as natural spoken language.";

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

  const systemText = `${agent.instructions || ""}\n\n${BREVITY_RULE}`.trim();

  let text = "";
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system: [
        {
          type: "text",
          text: systemText,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: history.map((m) => ({ role: m.role, content: m.content })),
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
