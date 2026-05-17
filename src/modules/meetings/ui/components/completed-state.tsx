"use client";

import { format } from "date-fns";
import { BookOpenTextIcon, FileTextIcon, MessageSquareIcon, VideoIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TranscriptChat } from "./transcript-chat";

interface Props {
  meetingId: string;
  summary: string | null;
}

export const CompletedState = ({ meetingId, summary }: Props) => {
  const trpc = useTRPC();
  const { data: transcript } = useSuspenseQuery(
    trpc.meetings.getTranscript.queryOptions({ id: meetingId }),
  );
  const recordingQuery = useQuery({
    ...trpc.meetings.getRecording.queryOptions({ id: meetingId }),
    staleTime: 0,
    gcTime: 0,
  });

  return (
    <div className="bg-white rounded-lg p-4">
      <Tabs defaultValue="summary" className="gap-4">
        <TabsList>
          <TabsTrigger value="summary">
            <BookOpenTextIcon /> Summary
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <FileTextIcon /> Transcript
          </TabsTrigger>
          <TabsTrigger value="recording">
            <VideoIcon /> Recording
          </TabsTrigger>
          <TabsTrigger value="ask">
            <MessageSquareIcon /> Ask
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          {summary ? (
            <div className="text-sm leading-relaxed">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => (
                    <h2 className="text-base font-semibold mt-4 mb-2 first:mt-0">
                      {children}
                    </h2>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 space-y-1 mb-2">
                      {children}
                    </ul>
                  ),
                  li: ({ children }) => <li>{children}</li>,
                  p: ({ children }) => (
                    <p className="leading-relaxed mb-2">{children}</p>
                  ),
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No summary was generated for this meeting.
            </div>
          )}
        </TabsContent>

        <TabsContent value="transcript">
          {transcript.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No conversation was recorded for this meeting.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {transcript.map((m) => (
                <div key={m.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">
                      {m.role === "user" ? "User" : "Agent"}
                    </span>
                    <span>{format(new Date(m.createdAt), "HH:mm:ss")}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recording">
          {recordingQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">
              Loading recording...
            </div>
          ) : recordingQuery.data?.url ? (
            <video
              controls
              src={recordingQuery.data.url}
              className="w-full rounded"
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              Recording is not available.
            </div>
          )}
        </TabsContent>

        <TabsContent value="ask">
          <TranscriptChat meetingId={meetingId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
