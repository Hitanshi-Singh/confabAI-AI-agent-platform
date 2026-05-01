"use client";

import { format } from "date-fns";
import { BookOpenTextIcon, FileTextIcon, VideoIcon } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  meetingId: string;
  summary: string | null;
  recordingUrl: string | null;
}

export const CompletedState = ({ meetingId, summary, recordingUrl }: Props) => {
  const trpc = useTRPC();
  const { data: transcript } = useSuspenseQuery(
    trpc.meetings.getTranscript.queryOptions({ id: meetingId }),
  );

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
        </TabsList>

        <TabsContent value="summary">
          {summary ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {summary}
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
          {recordingUrl ? (
            <video controls src={recordingUrl} className="w-full rounded" />
          ) : (
            <div className="text-sm text-muted-foreground">
              Recording is not available yet.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
