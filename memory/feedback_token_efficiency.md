---
name: token-efficiency
description: User wants Claude API used minimally; prefer scripts/deterministic logic, cache aggressively, never call AI when code can do it
type: feedback
---

Use the Anthropic API as little as possible. Prefer deterministic scripts/logic over AI calls whenever feasible.

**Why:** User said "api tokens should not get used in vain" and later, more directly: "the api should not be used. run scripts and all wherever possible. use ai very minimally." They have a paid Claude subscription but treat every call as something to justify, not the default tool to reach for.

**How to apply:**
- **Default to scripts.** If a task can be done with regex, parsing, deterministic transformation, or a query, do that — don't call Claude.
- **Justify every Claude call.** Before adding a new `anthropic.messages.create(...)` site, ask whether this genuinely needs LLM reasoning or whether code suffices.
- **Cache stable context.** When Claude is needed in multi-turn flows, mark system prompts and stable history with `cache_control: { type: "ephemeral" }` so they aren't re-billed every turn.
- **Cap unbounded growth.** Don't send the full transcript every turn — slice to recent N turns or summarize older content.
- **Right-size models.** For non-critical paths use Haiku; reserve Sonnet/Opus for what actually benefits.
- **Don't proactively re-architect for token cost.** Flag the issue, propose the fix, get confirmation. Combine with the minimal-changes rule.
