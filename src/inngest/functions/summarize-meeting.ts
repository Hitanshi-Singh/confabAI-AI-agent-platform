import { asc, eq } from "drizzle-orm";
import OpenAI from "openai";

import { db } from "@/db";
import { meetings, messages } from "@/db/schema";
import { inngest } from "@/inngest/client";

const openai = new OpenAI();

export const summarizeMeeting = inngest.createFunction(
  { id: "summarize-meeting", triggers: [{ event: "meeting/summarize" }] },
  async ({ event, step }) => {
    const { meetingId } = event.data as { meetingId: string };

    const conversation = await step.run("load-conversation", async () => {
      return db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.meetingId, meetingId))
        .orderBy(asc(messages.createdAt));
    });

    if (conversation.length === 0) {
      await step.run("mark-completed-empty", async () => {
        await db
          .update(meetings)
          .set({ status: "completed", summary: "" })
          .where(eq(meetings.id, meetingId));
      });
      return { skipped: true };
    }

    const transcript = conversation
      .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.content}`)
      .join("\n");

    const summary = await step.run("summarize", async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        reasoning_effort: "low",
        max_completion_tokens: 2048,
        messages: [
          {
            role: "system",
            content:
              "You summarize meeting transcripts between a user and an AI agent. Produce a concise summary covering the main topics discussed, decisions made, and any action items. Use markdown.",
          },
          {
            role: "user",
            content: `Summarize this conversation:\n\n${transcript}`,
          },
        ],
      });
      return response.choices[0]?.message?.content ?? "";
    });

    await step.run("save-summary", async () => {
      await db
        .update(meetings)
        .set({ status: "completed", summary })
        .where(eq(meetings.id, meetingId));
    });

    return { meetingId, summary };
  },
);
