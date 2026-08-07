---
name: tour
description: Browses all stored memories (most recent first, with their key:value tags) and full content display. Use when reviewing all memories, exploring stored knowledge, onboarding to a new session, or getting an overview of what the agent remembers.
---

# Memory Tour

Show the user what Mem0 has stored — a full walkthrough of all memories, most recent first, with their key:value tags.

## Cross-project mode

When invoked with `--all-projects` (e.g., `/mem0-tour --all-projects`), search across ALL projects:

1. Use `mem0_memory` tool with `action="get_all"`, `scope="global"` — no project filter.
2. Group results by project (the `app_id` entity). List memories flat within each project, most recent first.
3. Display:
   ```
   ## <project_1> (<N> memories) <- current
   - <memory content> [key:val]…
   ...

   ## <project_2> (<N> memories)
   ...

   <N> memories across <M> projects
   ```
4. Mark the current project with `<- current` in the heading.

If `--all-projects` is NOT present, use the standard single-project flow below.

## Search mode

When `/mem0-tour` receives a search query argument (e.g., `/mem0-tour cooking recipes`), run in **search mode** — compact one-liner results:

1. Use `mem0_memory` tool with `action="search"`, `query=<query>`.
2. Display compact results (same format as the search skill).
3. If no results: `No memories matching "<query>".`

If no query argument and no `--all-projects` flag, use the full tour flow below.

## Execution

### Step 1: Fetch ALL memories

Use `mem0_memory` tool with `action="get_all"`.

### Step 2: Order

Sort memories most-recent-first. There is no fixed category taxonomy — memories carry only the `key:value` tags the agent chose (many, e.g. auto-captured ones, have none), so do not try to bucket them into predefined categories.

Optionally, if many memories share a common tag key (e.g. most have a `category:` or `type:` tag), you MAY group by the distinct values of that one key and put untagged memories under a final `## Untagged` group. Otherwise present a single flat list.

### Step 3: Display results

Show the **full memory text** for each entry — do NOT truncate — with its tags and age:

```
## Memories (<N>)
- <full_memory_content> (<date>) [key:val]…
- <full_memory_content> (<date>)
- ...
```

If there are more than 20 entries, show the top 20 by recency and note `... and <N> more`.

### Step 4: Print totals

```
<N> memories
```

### Step 5: Empty state

If zero memories found:
```
No memories stored yet. Start a conversation — Mem0 captures learnings automatically, or use /mem0-remember to store something manually.
```
