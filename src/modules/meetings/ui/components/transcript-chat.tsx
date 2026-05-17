"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

import { useTRPC } from "@/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  meetingId: string;
}

export const TranscriptChat = ({ meetingId }: Props) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");

  const {
    data: history = [],
    isLoading,
    isError,
  } = useQuery(trpc.meetings.getTranscriptChat.queryOptions({ id: meetingId }));

  const ask = useMutation(
    trpc.meetings.askTranscript.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.meetings.getTranscriptChat.queryOptions({ id: meetingId }),
        );
      },
    }),
  );

  const handleSend = () => {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setQuestion("");
    ask.mutate({ id: meetingId, question: q });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : isError ? (
          <div className="text-sm text-muted-foreground">
            Unable to load earlier questions.
          </div>
        ) : history.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Ask a question about this session — answers are based only on its
            transcript and summary.
          </div>
        ) : (
          history.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm max-w-[85%]"
                    : "bg-muted rounded-lg px-3 py-2 text-sm max-w-[85%]"
                }
              >
                {m.role === "user" ? (
                  m.content
                ) : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="leading-relaxed mb-2 last:mb-0">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc pl-5 space-y-1 mb-2 last:mb-0">
                          {children}
                        </ul>
                      ),
                      li: ({ children }) => <li>{children}</li>,
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))
        )}
        {ask.isPending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {ask.isError && (
        <div className="text-sm text-destructive">{ask.error.message}</div>
      )}

      <div className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about this meeting..."
          disabled={ask.isPending}
        />
        <Button
          onClick={handleSend}
          disabled={ask.isPending || question.trim().length === 0}
        >
          Ask
        </Button>
      </div>
    </div>
  );
};
