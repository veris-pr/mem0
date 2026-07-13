---
name: remember
description: Stores a memory verbatim from user input with appropriate category classification. Use when the user says remember this, save this, store this, note that, or explicitly asks to record a preference, decision, goal, or lesson.
---

# Remember

Store a fact, preference, or learning directly into Mem0.

## Execution

### Step 1: Extract the content

The user provides the content as an argument: `/mem0-remember <text>`

If no text was provided, ask: "What should I remember?"

### Step 2: Classify the memory

Based on the content, pick the best category value:

| Content signal | Category |
|---|---|
| "I prefer...", "I like...", "use X instead of Y" | `preferences` |
| "we decided...", "always use...", "never..." | `decisions` |
| "I learned...", "figured out...", "don't try..." | `lessons` |
| "my goal is...", "I want to...", "working toward..." | `goals` |
| "I work at...", "my role is...", "my team..." | `work` |
| "every day I...", "my workflow is..." | `routines` |
| "I'm working on...", "the project involves..." | `projects` |
| "John is...", "my manager...", "the team..." | `relationships` |
| "my name is...", "I'm from...", "I studied..." | `identity` |
| setup, tools, config, environment | `technical` |
| anything else | `lessons` |

This table is a starting point — if a more specific value fits the content, use it, but reuse values consistently so they stay useful for filtering later.

### Step 3: Store

Use the `mem0_memory` tool with:
- `action="add"`
- `content="<the user's text>"` (stored verbatim — no inference)
- `metadata={"category": "<chosen category>"}` — this is what makes the classification stick and show up as a `[category:<value>]` badge. Add extra `key:value` tags too if they'd help you find it later (e.g. `"area":"auth"`).

### Step 4: Confirm

```
Remembered [category:<chosen>]: "<content, first 80 chars>"
```

Append `...` only if content was truncated (longer than 80 chars).
