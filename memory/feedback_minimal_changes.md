---
name: minimal-changes-only
description: User wants edits scoped tightly to the task — no incidental refactors, abstractions, or surrounding cleanup
type: feedback
---

Make changes only where strictly necessary to complete the task.

**Why:** User explicitly said "do changes only wherever necessary" mid-implementation. They want surgical edits, not opportunistic improvements.

**How to apply:** Touch the minimum number of files and lines required. Don't extract helpers, rename neighbors, fix unrelated typos, add comments, or "improve" surrounding code while you're there. If something tangential looks wrong, mention it as an aside but don't fix it unless asked.
