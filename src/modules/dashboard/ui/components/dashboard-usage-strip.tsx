"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";

const barColor = (used: number, limit: number) => {
  const pct = (used / limit) * 100;
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
};

export const DashboardUsageStrip = () => {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.subscriptions.getUsage.queryOptions());

  if (!data) {
    return (
      <div className="mx-3 mb-2 mt-auto rounded-lg bg-white/5 border border-white/10 p-3 animate-pulse">
        <div className="h-3 w-20 bg-white/10 rounded mb-3" />
        <div className="h-1.5 w-full bg-white/10 rounded-full mb-3" />
        <div className="h-1.5 w-full bg-white/10 rounded-full" />
      </div>
    );
  }

  if (data.tier === "premium") {
    return (
      <div className="mx-3 mb-2 mt-auto rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 p-3 flex items-center gap-2">
        <SparklesIcon className="size-4 text-amber-400" />
        <span className="text-sm font-medium text-white">Premium plan</span>
      </div>
    );
  }

  const meetingPct = Math.min(
    100,
    (data.meetingCount / data.limits.meetings) * 100,
  );
  const agentPct = Math.min(
    100,
    (data.agentCount / data.limits.agents) * 100,
  );

  return (
    <div className="mx-3 mb-2 mt-auto rounded-lg bg-white/5 border border-white/10 p-3 flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-wide text-white/60">
        Free plan
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-white/80">
          <span>Meetings</span>
          <span className="tabular-nums">
            {data.meetingCount} / {data.limits.meetings}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full transition-all ${barColor(data.meetingCount, data.limits.meetings)}`}
            style={{ width: `${meetingPct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-white/80">
          <span>Agents</span>
          <span className="tabular-nums">
            {data.agentCount} / {data.limits.agents}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full transition-all ${barColor(data.agentCount, data.limits.agents)}`}
            style={{ width: `${agentPct}%` }}
          />
        </div>
      </div>

      <Button asChild size="sm" className="w-full">
        <Link href="/upgrade">Upgrade</Link>
      </Button>
    </div>
  );
};
