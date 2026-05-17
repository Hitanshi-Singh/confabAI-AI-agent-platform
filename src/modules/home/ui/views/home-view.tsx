"use client";

import { useState } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRightIcon,
  BotIcon,
  PlusIcon,
  VideoIcon,
} from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { NewMeetingDialog } from "@/modules/meetings/ui/components/new-meeting-dialog";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";

interface Props {
  userName?: string;
}

const statusBadgeStyles: Record<string, string> = {
  upcoming: "bg-yellow-100 text-yellow-800",
  active: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  processing: "bg-gray-100 text-gray-800",
  cancelled: "bg-rose-100 text-rose-800",
};

const HomeView = ({ userName }: Props) => {
  const trpc = useTRPC();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialAgentId, setInitialAgentId] = useState<string | undefined>(undefined);

  const { data: agentsData } = useSuspenseQuery(
    trpc.agents.getMany.queryOptions({}),
  );
  const { data: meetingsData } = useSuspenseQuery(
    trpc.meetings.getMany.queryOptions({}),
  );

  const recentAgents = agentsData.items.slice(0, 4);
  const recentMeetings = meetingsData.items.slice(0, 5);

  const openNewMeeting = (agentId?: string) => {
    setInitialAgentId(agentId);
    setDialogOpen(true);
  };

  const firstName = userName?.split(" ")[0];
  const greeting = firstName
    ? `Welcome back, ${firstName}`
    : "Welcome back";

  return (
    <>
      <NewMeetingDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setInitialAgentId(undefined);
        }}
        initialValues={
          initialAgentId ? { agentId: initialAgentId } : undefined
        }
      />

      <div className="flex-1 py-4 px-4 md:px-8 flex flex-col gap-y-6">
        {/* Section 1: Welcome */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{greeting}</h1>
            <p className="text-sm text-muted-foreground">
              Start a meeting with one of your agents, or create a new one.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/agents">
                <BotIcon className="size-4" />
                New agent
              </Link>
            </Button>
            <Button onClick={() => openNewMeeting()}>
              <PlusIcon className="size-4" />
              New meeting
            </Button>
          </div>
        </div>

        {/* Section 2: Your agents */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Your agents</h2>
            <Link
              href="/agents"
              className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
            >
              View all <ArrowRightIcon className="size-3" />
            </Link>
          </div>
          {recentAgents.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                You don&apos;t have any agents yet.
              </p>
              <Button asChild size="sm">
                <Link href="/agents">
                  <PlusIcon className="size-4" />
                  Create your first agent
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-white rounded-lg border p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <GeneratedAvatar
                      seed={agent.name}
                      variant="botttsNeutral"
                      className="size-10"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {agent.name}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {agent.instructions || "No instructions set."}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openNewMeeting(agent.id)}
                  >
                    <VideoIcon className="size-4" />
                    Start meeting
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 3: Recent meetings */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Recent meetings</h2>
            <Link
              href="/meetings"
              className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
            >
              View all <ArrowRightIcon className="size-3" />
            </Link>
          </div>
          {recentMeetings.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No meetings yet. Start your first one above.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border divide-y">
              {recentMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  href={`/meetings/${meeting.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {meeting.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meeting.agent.name}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${
                      statusBadgeStyles[meeting.status] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {meeting.status}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(meeting.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default HomeView;

export const HomeViewLoading = () => (
  <LoadingState
    title="Loading home"
    description="This may take a few seconds"
  />
);

export const HomeViewError = () => (
  <ErrorState
    title="Failed to load home"
    description="Please try again later"
  />
);
