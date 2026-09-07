<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git workflow

User is not a developer and doesn't use the terminal directly. Environment naming: "그린" = the `staging` branch (test environment, its own Supabase project), "블루" = the `main` branch (production).

Flow for every code change, without asking for confirmation at each step:
1. Make the change, commit and push to `staging` — this deploys to 그린 automatically.
2. User tests it on 그린.
3. Once the user confirms it works on 그린, merge `staging` into `main` and push — this deploys to 블루 (production) automatically.

## Supabase SQL / DB access

Two Supabase MCP connectors are available (claude.ai connectors; a session must be started after they were added to see them):
- **"Supabase 그린"** — the staging project (`agpkupfkeawhjsfqrycr`), read + write.
- **"Supabase 블루 (읽기전용)"** — the production project (`pqexkkmajbbcdwjinwdz`), read-only.

Rules:
1. Migration SQL still lives in the repo as a file under `supabase/` (idempotent, re-runnable). Commit it with the code change.
2. **그린**: run the migration yourself via the 그린 connector right after pushing to `staging`, without asking. Then verify (e.g. query the new column/policy).
3. **블루**: the connector is read-only, so you cannot run migrations there. Use it to *inspect* (diagnose account/auth issues, confirm whether a migration has been applied). For applying, hand the SQL to the user to run in blue's SQL Editor when they say to merge to main — and confirm afterwards via the read-only connector that it landed.
4. Never create, delete, or modify Supabase Auth accounts — that's always the user's own action in the dashboard.
5. If the connectors are not visible in the current session, fall back to the old behavior: hand the SQL to the user to run themselves.
