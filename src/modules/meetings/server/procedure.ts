import { z } from "zod";
import { db } from "@/db";
import { agents, meetings, messages, transcriptChat, user } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { and, asc, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import { FREE_TIER_LIMITS } from "@/constants/subscription";
import { TRPCError } from "@trpc/server";
import { meetingsInsertSchema, meetingsUpdateSchema } from "../schema";
import { MeetingStatus } from "../types";
import { streamVideo } from "@/lib/stream-video";
import { generateAvatarUri } from "@/lib/avatar";
import OpenAI from "openai";
// import { TRPCError } from "@trpc/server";

const openai = new OpenAI();

export const meetingsRouter = createTRPCRouter({
  generateToken: protectedProcedure.mutation(async ({ ctx }) => {
    await streamVideo.upsertUsers([
      {
        id: ctx.auth.user.id,
        name: ctx.auth.user.name,
        role: "user",
        image:
          ctx.auth.user.image ??
          generateAvatarUri({
            seed: ctx.auth.user.name,
            variant: "initials",
          }),
      },
    ]);
    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const issuedAt = Math.floor(Date.now() / 1000) - 60;

    const token = streamVideo.generateUserToken({
      user_id: ctx.auth.user.id,
      exp: expirationTime,
      iat: issuedAt,
    });

    return token;
  }),
  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [removedMeeting] = await db
        .delete(meetings)
        .where(
          and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)),
        )
        .returning();
      if (!removedMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }
      return removedMeeting;
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // A meeting can only be cancelled while it is still upcoming. The
      // status guard makes this safe to call without a separate check:
      // if the meeting has already started, completed, or been cancelled,
      // zero rows match and we throw.
      const [cancelledMeeting] = await db
        .update(meetings)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(meetings.id, input.id),
            eq(meetings.userId, ctx.auth.user.id),
            eq(meetings.status, "upcoming"),
          ),
        )
        .returning();
      if (!cancelledMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found or no longer upcoming",
        });
      }
      return cancelledMeeting;
    }),

  update: protectedProcedure
    .input(meetingsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const [updatedMeeting] = await db
        .update(meetings)
        .set(input)
        .where(
          and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)),
        )
        .returning();
      if (!updatedMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }
      return updatedMeeting;
    }),

  create: protectedProcedure
    .input(meetingsInsertSchema)
    .mutation(async ({ input, ctx }) => {
      const [userRow] = await db
        .select({ tier: user.tier })
        .from(user)
        .where(eq(user.id, ctx.auth.user.id));

      if (userRow?.tier === "free") {
        const [meetingCountRow] = await db
          .select({ value: count() })
          .from(meetings)
          .where(eq(meetings.userId, ctx.auth.user.id));

        if (meetingCountRow.value >= FREE_TIER_LIMITS.meetings) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Free tier limit reached. You can create up to ${FREE_TIER_LIMITS.meetings} meetings.`,
          });
        }
      }

      const [createdMeeting] = await db
        .insert(meetings)
        .values({
          ...input,
          userId: ctx.auth.user.id,
        })
        .returning();
      // TODO: Create stream call, upsert stream users

      const call = streamVideo.video.call("default", createdMeeting.id);
      await call.create({
        data: {
          created_by_id: ctx.auth.user.id,
          custom: {
            meetingId: createdMeeting.id,
            meetingName: createdMeeting.name,
          },
          settings_override: {
            transcription: {
              language: "en",
              mode: "auto-on",
              closed_caption_mode: "auto-on",
            },
            recording: {
              mode: "auto-on",
              quality: "1080p",
            },
          },
        },
      });

      const [existingAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, createdMeeting.agentId));

        if(!existingAgent){
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Agent not found",
          });
        }

      return createdMeeting;
    }),

  getTranscript: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [existingMeeting] = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(
          and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)),
        );
      if (!existingMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }
      return db
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.meetingId, input.id))
        .orderBy(asc(messages.createdAt));
    }),

  getRecording: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [existingMeeting] = await db
        .select({ id: meetings.id, recordingUrl: meetings.recordingUrl })
        .from(meetings)
        .where(
          and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)),
        );
      if (!existingMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      // recording_url is treated only as an existence flag. Stream's stored
      // URL is a signed link that expires after ~2 weeks, so we never serve
      // it directly. If it was never set, the recording_ready webhook never
      // fired -> no recording exists -> skip the Stream API call. (If the
      // webhook is unreliable, fix it there; do not hit Stream on every read
      // of every completed meeting to compensate.)
      if (!existingMeeting.recordingUrl) {
        return { url: null };
      }

      // A recording exists: fetch a freshly-signed URL from Stream on every
      // read. Sort by end_time descending — the SDK does not guarantee
      // ordering of the recordings array.
      try {
        const call = streamVideo.video.call("default", input.id);
        const { recordings } = await call.listRecordings();
        const latest = [...recordings].sort(
          (a, b) => b.end_time.getTime() - a.end_time.getTime(),
        )[0];
        return { url: latest?.url ?? null };
      } catch (err) {
        console.error("[meetings.getRecording] listRecordings failed:", err);
        return { url: null };
      }
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [existingMeeting] = await db
        .select({
          ...getTableColumns(meetings),
          agent: agents,
          duration:
            sql<number>`EXTRACT(EPOCH FROM (${meetings.endedAt} - ${meetings.startedAt}))`.as(
              "duration",
            ),
        })
        .from(meetings)
        .innerJoin(agents, eq(agents.id, meetings.agentId))
        .where(
          and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)),
        );
      if (!existingMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }
      return existingMeeting;
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
        agentId: z.string().nullish(),

        status: z
          .enum([
            MeetingStatus.Upcoming,
            MeetingStatus.Active,
            MeetingStatus.Completed,
            MeetingStatus.Processing,
            MeetingStatus.Cancelled,
          ])
          .nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { search, page, pageSize, status, agentId } = input;

      const data = await db
        .select({
          ...getTableColumns(meetings),
          agent: agents,
          duration:
            sql<number>`EXTRACT(EPOCH FROM (${meetings.endedAt} - ${meetings.startedAt}))`.as(
              "duration",
            ),
        })
        .from(meetings)
        .innerJoin(agents, eq(agents.id, meetings.agentId))
        .where(
          and(
            eq(meetings.userId, ctx.auth.user.id),
            search ? ilike(meetings.name, `%${search}%`) : undefined,
            status ? eq(meetings.status, status) : undefined,
            agentId ? eq(meetings.agentId, agentId) : undefined,
          ),
        )
        .orderBy(desc(meetings.createdAt), desc(meetings.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [total] = await db
        .select({ count: count() })
        .from(meetings)
        .innerJoin(agents, eq(agents.id, meetings.agentId))

        .where(
          and(
            eq(meetings.userId, ctx.auth.user.id),
            search ? ilike(meetings.name, `%${search}%`) : undefined,
            status ? eq(meetings.status, status) : undefined,
            agentId ? eq(meetings.agentId, agentId) : undefined,
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

  getTranscriptChat: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [existingMeeting] = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(
          and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)),
        );
      if (!existingMeeting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      }
      return db
        .select({
          id: transcriptChat.id,
          role: transcriptChat.role,
          content: transcriptChat.content,
          createdAt: transcriptChat.createdAt,
        })
        .from(transcriptChat)
        .where(eq(transcriptChat.meetingId, input.id))
        .orderBy(asc(transcriptChat.createdAt));
    }),

  askTranscript: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        question: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [meeting] = await db
        .select({
          id: meetings.id,
          status: meetings.status,
          summary: meetings.summary,
        })
        .from(meetings)
        .where(
          and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)),
        );
      if (!meeting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      }
      if (meeting.status !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Q&A is only available for completed meetings",
        });
      }

      const transcriptRows = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.meetingId, input.id))
        .orderBy(asc(messages.createdAt));

      const priorQa = await db
        .select({ role: transcriptChat.role, content: transcriptChat.content })
        .from(transcriptChat)
        .where(eq(transcriptChat.meetingId, input.id))
        .orderBy(asc(transcriptChat.createdAt));

      const transcriptText = transcriptRows
        .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
        .join("\n");

      const systemText = [
        "You answer follow-up questions about a completed tutoring session.",
        "Base every answer ONLY on the session summary and transcript below.",
        "If the answer is not contained in them, say you do not have that information from this session.",
        "Be concise. Light markdown is allowed.",
        "",
        "[SESSION SUMMARY]",
        meeting.summary || "(no summary was generated)",
        "",
        "[SESSION TRANSCRIPT]",
        transcriptText || "(no conversation was recorded)",
      ].join("\n");

      let answer = "";
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5.4-mini",
          reasoning_effort: "low",
          max_completion_tokens: 1536,
          messages: [
            { role: "system", content: systemText },
            ...priorQa.map(
              (m): OpenAI.Chat.Completions.ChatCompletionMessageParam =>
                m.role === "user"
                  ? { role: "user", content: m.content }
                  : { role: "assistant", content: m.content },
            ),
            { role: "user", content: input.question },
          ],
        });
        answer = (response.choices[0]?.message?.content ?? "").trim();
      } catch (err) {
        console.error("[meetings.askTranscript] openai error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "OpenAI call failed",
        });
      }

      if (!answer) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Empty response from the model",
        });
      }

      // Persist both turns only after a successful generation, so a failed
      // model call leaves no orphan question row. Two sequential inserts keep
      // distinct created_at values and user-before-assistant order.
      await db.insert(transcriptChat).values({
        meetingId: input.id,
        role: "user",
        content: input.question,
      });
      const [assistantMessage] = await db
        .insert(transcriptChat)
        .values({
          meetingId: input.id,
          role: "assistant",
          content: answer,
        })
        .returning();

      return { answer, assistantMessage };
    }),
});
