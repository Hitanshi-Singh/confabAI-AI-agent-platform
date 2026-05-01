import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "confabai",
  isDev: process.env.NODE_ENV !== "production",
});
