---
name: status
description: Diagnoses Mem0 connectivity, API key validity, and memory read/write functionality. Use when memory operations fail, searches return empty, or to verify the plugin is working correctly.
---

# Health Check / Status

Run a diagnostic check on the Mem0 plugin. Useful for troubleshooting.

## Execution

Run ALL checks, then display a single summary. Do not stop on the first failure.

### Check 1: Connection

Verify a Mem0 connection is configured. The plugin connects to either **Mem0 Cloud** (`MEM0_API_KEY`) or a **self-hosted instance** (`MEM0_HOST`). Config comes from env vars or `~/.pi/agent/mem0-config.json`.

- If `MEM0_HOST` is set: PASS — self-hosted, show the host URL. No API key is required (only sent if the instance enforces one).
- Else if `MEM0_API_KEY` is set: PASS — Mem0 Cloud, show first 6 chars followed by `...`.
- If neither is set: FAIL — "No Mem0 connection configured (set MEM0_API_KEY for Cloud or MEM0_HOST for self-hosted)."

### Check 2: Identity resolution

Report the resolved identity:
- `user_id`: from config, env, or system user
- `app_id` (project): auto-detected from the current git repo / directory
- `run_id` (session): current session identifier

PASS if user_id and app_id are non-empty. WARN if any falls back to defaults.

### Check 3: Connectivity

Use `mem0_memory` tool with `action="search"`, `query="health check"`.

- If returns successfully (even empty): PASS
- If errors: FAIL — show the error message

### Check 4: Memory write capability

Use `mem0_memory` tool with `action="add"`, `content="Health check probe — safe to delete."`.

- If succeeds: PASS — then clean up by deleting the probe memory.
- If errors: FAIL — show the error.

### Display

```
## mem0 health

PASS  Connection       self-hosted http://localhost:8888   (or Cloud: m0-dVe...)
PASS  Identity         user=kartik, app=my-app, session=abc123
PASS  Connectivity     142ms
PASS  Write/Read       write + delete OK

All checks passed.
```

If any check fails, add a `## Troubleshooting` section with specific fix steps.

## Extended mode: Memory Quality Analysis

When invoked with `--deep` (e.g., `/mem0-status --deep`), run the standard checks above **plus** a memory quality scan.

### Quality Check 1: Duplicates

Fetch all memories with `mem0_memory` `action="get_all"`. Compare pairs for high textual overlap (shared nouns > 60%). If memories carry `key:value` tags, prefer comparing within the same tag values; otherwise compare across the whole set. Report:

```
Potential duplicates: <N> pairs
  [mem0:<id1>] ~ [mem0:<id2>] — both about "<shared topic>"
```

### Quality Check 2: Stale memories

Flag memories older than 180 days that haven't been accessed recently.

### Quality Check 3: Contradictions

Flag pairs that assert opposing facts (compare within shared tags when present, otherwise across all memories).

### Quality summary

```
## Memory Quality

Duplicates: <N> · Stale: <N> · Contradictions: <N>
```

If all counts are 0: `Memory quality: clean.`
If any non-zero: append `Run /mem0-dream to fix.`
