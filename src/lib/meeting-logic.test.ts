import { describe, it, expect } from "vitest";
import {
  isMeetingChatAllowed,
  isConversationEmpty,
  formatTranscript,
} from "./meeting-logic";

describe("isMeetingChatAllowed", () => {
  it("allows Q&A for a completed meeting", () => {
    expect(isMeetingChatAllowed("completed")).toBe(true);
  });

  it("rejects Q&A for every non-completed status", () => {
    expect(isMeetingChatAllowed("upcoming")).toBe(false);
    expect(isMeetingChatAllowed("active")).toBe(false);
    expect(isMeetingChatAllowed("processing")).toBe(false);
    expect(isMeetingChatAllowed("cancelled")).toBe(false);
  });
});

describe("isConversationEmpty", () => {
  it("is true when there are no conversation rows", () => {
    expect(isConversationEmpty([])).toBe(true);
  });

  it("is false when at least one row exists", () => {
    expect(
      isConversationEmpty([{ role: "user", content: "hello" }]),
    ).toBe(false);
  });
});

describe("formatTranscript", () => {
  it("renders rows with Student/Tutor labels joined by newlines", () => {
    const result = formatTranscript([
      { role: "user", content: "What is recursion?" },
      { role: "assistant", content: "A function that calls itself." },
    ]);
    expect(result).toBe(
      "Student: What is recursion?\nTutor: A function that calls itself.",
    );
  });

  it("returns an empty string for no rows", () => {
    expect(formatTranscript([])).toBe("");
  });
});
