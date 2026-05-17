import { z } from "zod";
import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { agentsInsertSchema, agentsUpdateSchema } from "../schema";
import { and, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { FREE_TIER_LIMITS } from "@/constants/subscription";
import { TRPCError } from "@trpc/server";
// import { TRPCError } from "@trpc/server";

export const agentsRouter = createTRPCRouter({
  update: protectedProcedure
  .input(agentsUpdateSchema)
  .mutation(async({ctx, input})=>{
    const [updatedAgent] = await db 
    .update(agents)
    .set(input)
    .where(and(
      eq(agents.id,input.id),
      eq(agents.userId,ctx.auth.user.id)
    )).returning();
    if(!updatedAgent){
      throw new TRPCError({code:"NOT_FOUND",message:"Agent not found"})
    } 
    return updatedAgent;
  }),
  remove: protectedProcedure
  .input(z.object({id:z.string()}))
  .mutation(async({ctx,input})=>{
    const [removedAgent] = await db
    .delete(agents)
    .where(and(
      eq(agents.id,input.id),
      eq(agents.userId,ctx.auth.user.id)
    )).returning();

    if(!removedAgent){
      throw new TRPCError({code:"NOT_FOUND",message:"Agent not found"})
    }
    return removedAgent;
  }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input,ctx }) => {
      const [existingAgent] = await db
        .select({
          ...getTableColumns(agents),
          meetingCount: sql<number>`(SELECT COUNT(*)::int FROM ${meetings} WHERE ${meetings.agentId} = ${agents.id})`,
        })
        .from(agents)
        .where(and(
          eq(agents.id, input.id),
          eq(agents.userId,ctx.auth.user.id)
          )
        );
        if(!existingAgent){
          throw new TRPCError({code:"NOT_FOUND",message:"Agent not found"})
        }
      return existingAgent;
    }),
  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(MIN_PAGE_SIZE)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { search, page, pageSize } = input;

      const data = await db
        .select({
          ...getTableColumns(agents),
          meetingCount: sql<number>`(SELECT COUNT(*)::int FROM ${meetings} WHERE ${meetings.agentId} = ${agents.id})`,
        })
        .from(agents)
        .where(
          and(
            eq(agents.userId, ctx.auth.user.id),
            search ? ilike(agents.name, `%${search}%`) : undefined,
          ),
        )
        .orderBy(desc(agents.createdAt), desc(agents.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [total] = await db
        .select({ count: count() })
        .from(agents)
        .where(
          and(
            eq(agents.userId, ctx.auth.user.id),
            search ? ilike(agents.name, `%${search}%`) : undefined,
          ),
        );

      const totalPages = Math.ceil(total.count / pageSize);

      return {
        items: data,
        total: total.count,
        totalPages,
      };
      // return data;
    }),
  create: protectedProcedure
    .input(agentsInsertSchema)
    .mutation(async ({ input, ctx }) => {
      const [userRow] = await db
        .select({ tier: user.tier })
        .from(user)
        .where(eq(user.id, ctx.auth.user.id));

      if (userRow?.tier === "free") {
        const [agentCountRow] = await db
          .select({ value: count() })
          .from(agents)
          .where(eq(agents.userId, ctx.auth.user.id));

        if (agentCountRow.value >= FREE_TIER_LIMITS.agents) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Free tier limit reached. You can create up to ${FREE_TIER_LIMITS.agents} agents.`,
          });
        }
      }

      const [createdAgent] = await db
        .insert(agents)
        .values({
          ...input,
          userId: ctx.auth.user.id,
        })
        .returning();

      return createdAgent;
    }),
});
