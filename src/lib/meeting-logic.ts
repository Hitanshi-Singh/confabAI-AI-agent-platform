import type { messages } from "@/db/schema";

type MeetingStatus =
  | "upcoming"
  | "active"
  | "completed"
  | "processing"
  | "cancelled";

type ConversationRow = {
  role: (typeof messages.$inferSelect)["role"];
  content: string;
};

/**
 * Post-meeting transcript Q&A is only permitted once a meeting is completed.
 */
export function isMeetingChatAllowed(status: MeetingStatus): boolean {
  return status === "completed";
}

/**
 * The summarizer short-circuits (marks completed with an empty summary,
 * skips the model call) when a meeting has no conversation rows.
 */
export function isConversationEmpty(rows: readonly ConversationRow[]): boolean {
  return rows.length === 0;
}

/**
 * Render conversation rows as a plain-text transcript. Empty input yields
 * an empty string.
 */
export function formatTranscript(rows: readonly ConversationRow[]): string {
  return rows
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n");
}
