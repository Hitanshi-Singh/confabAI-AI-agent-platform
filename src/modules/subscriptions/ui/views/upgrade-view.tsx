"use client";

import { useRouter } from "next/navigation";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";

const freeFeatures = [
  "5 agents",
  "10 meetings",
  "Voice + chat with the agent",
  "Auto summaries",
];

const premiumFeatures = [
  "Unlimited agents",
  "Unlimited meetings",
  "Everything in Free",
  "Priority support (mock)",
];

export const UpgradeView = () => {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: usage } = useSuspenseQuery(
    trpc.subscriptions.getUsage.queryOptions(),
  );

  const upgrade = useMutation(
    trpc.subscriptions.upgrade.mutationOptions({
      onSuccess: async () => {
        toast.success("You're now on Premium!");
        await queryClient.invalidateQueries(
          trpc.subscriptions.getUsage.queryOptions(),
        );
        router.push("/");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const isPremium = usage.tier === "premium";

  return (
    <div className="flex-1 py-6 px-4 md:px-8 flex flex-col gap-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Choose your plan</h1>
        <p className="text-sm text-muted-foreground">
          Mock checkout for demo purposes — no real payment is processed.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
        <div className="bg-white rounded-lg border p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Free</h2>
            <p className="text-2xl font-bold mt-2">
              ₹0{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / month
              </span>
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {freeFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <CheckIcon className="size-4 text-muted-foreground" />
                {f}
              </li>
            ))}
          </ul>
          <Button variant="outline" disabled className="mt-auto">
            {!isPremium ? "Current plan" : "Free"}
          </Button>
        </div>

        <div className="bg-white rounded-lg border-2 border-primary p-6 flex flex-col gap-4 relative">
          <span className="absolute -top-3 right-4 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <SparklesIcon className="size-3" /> Recommended
          </span>
          <div>
            <h2 className="text-lg font-semibold">Premium</h2>
            <p className="text-2xl font-bold mt-2">
              ₹499{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / month
              </span>
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {premiumFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <CheckIcon className="size-4 text-primary" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            onClick={() => upgrade.mutate()}
            disabled={isPremium || upgrade.isPending}
            className="mt-auto"
          >
            {isPremium
              ? "You're on Premium"
              : upgrade.isPending
                ? "Upgrading…"
                : "Subscribe"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const UpgradeViewLoading = () => (
  <LoadingState
    title="Loading plans"
    description="This may take a few seconds"
  />
);

export const UpgradeViewError = () => (
  <ErrorState
    title="Failed to load plans"
    description="Please try again later"
  />
);
