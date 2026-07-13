---
name: search
description: Searches memories and displays compact one-liner results, or looks up a specific memory by ID. Use for quick memory lookups, checking if something was recorded, resolving [mem0:id] citations, or browsing memories without full category detail.
---

# Search / Peek

Quick semantic search with compact output. Lighter than `/mem0-tour`.

## Execution

### Step 1: Parse query

The user provides a search query: `/mem0-search favorite restaurants`

If no query provided, ask: "What should I search for?"

**Memory ID detection:** If the query matches a UUID pattern (`^[a-f0-9-]{20,}$`), treat it as a direct memory lookup instead of a search.

### Step 2: Search

Use `mem0_memory` tool with `action="search"`, `query=<user's query>`.

To narrow to a category, also pass `metadata` — e.g. `metadata={"category":"preferences"}` — which filters to memories whose tags match every given key/value (in addition to the semantic query).

### Step 3: Display

Show compact results. Each memory is two lines: the text + age, then its category badges and id:

```
## mem0 search: "<query>" (<N> results)

1. Prefers window seats on flights (2026-05-15)
   [category:preferences] [mem0:a3f8b2c1]
2. Wants to visit Japan in 2027 (2026-05-10)
   [category:goals] [mem0:7e2d9f4a]
3. Lives in San Francisco (2026-05-08)
   [mem0:c4d5e6f7]
```

Format per memory:
- Line 1: `<number>. <content, 80 chars> (<date>)`
- Line 2: `   <[key:val] badges from metadata> [mem0:<short_id>]`

A memory with no tags (e.g. auto-captured) simply shows no badges on line 2.

If no results:
```
No memories matching "<query>".
```
