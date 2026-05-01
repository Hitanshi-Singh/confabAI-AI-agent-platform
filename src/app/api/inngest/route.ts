import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { summarizeMeeting } from "@/inngest/functions/summarize-meeting";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [summarizeMeeting],
});
