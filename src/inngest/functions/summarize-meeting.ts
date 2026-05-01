import { asc, eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

import { db } from "@/db";
import { meetings, messages } from "@/db/schema";
import { inngest } from "@/inngest/client";

const anthropic = new Anthropic();

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

    const summary = await step.run("claude-summarize", async () => {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system:
          "You summarize meeting transcripts between a user and an AI agent. Produce a concise summary covering the main topics discussed, decisions made, and any action items. Use markdown.",
        messages: [
          {
            role: "user",
            content: `Summarize this conversation:\n\n${transcript}`,
          },
        ],
      });
      return response.content
        .filter(
          (b): b is Anthropic.TextBlock => b.type === "text",
        )
        .map((b) => b.text)
        .join("");
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
