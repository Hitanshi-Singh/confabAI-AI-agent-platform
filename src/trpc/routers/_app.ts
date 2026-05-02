import { agentsRouter } from "@/modules/agents/server/procedures";

import { createTRPCRouter } from "../init";
import { meetingsRouter } from "@/modules/meetings/server/procedure";
import { subscriptionsRouter } from "@/modules/subscriptions/server/procedures";



export const appRouter = createTRPCRouter({
  agents: agentsRouter,
  meetings: meetingsRouter,
  subscriptions: subscriptionsRouter,
});

export type AppRouter = typeof appRouter;
