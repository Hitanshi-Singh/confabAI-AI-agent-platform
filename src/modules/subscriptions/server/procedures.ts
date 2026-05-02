import { TRPCError } from "@trpc/server";
import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { FREE_TIER_LIMITS } from "@/constants/subscription";

export const subscriptionsRouter = createTRPCRouter({
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    const [userRow] = await db
      .select({ tier: user.tier })
      .from(user)
      .where(eq(user.id, ctx.auth.user.id));

    if (!userRow) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const [agentRow] = await db
      .select({ value: count() })
      .from(agents)
      .where(eq(agents.userId, ctx.auth.user.id));

    const [meetingRow] = await db
      .select({ value: count() })
      .from(meetings)
      .where(eq(meetings.userId, ctx.auth.user.id));

    return {
      tier: userRow.tier,
      agentCount: agentRow.value,
      meetingCount: meetingRow.value,
      limits: FREE_TIER_LIMITS,
    };
  }),

  upgrade: protectedProcedure.mutation(async ({ ctx }) => {
    // Mock subscribe — no real payment. Flips the tier flag.
    const [updated] = await db
      .update(user)
      .set({ tier: "premium" })
      .where(eq(user.id, ctx.auth.user.id))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return { tier: updated.tier };
  }),
});
