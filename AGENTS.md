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

Two Supabase MCP connectors are available to Claude (registered on the user's Claude account, so they are visible in cloud/web/phone sessions as well as on the Mac):
- **그린** — the staging project (`agpkupfkeawhjsfqrycr`), read + write, no approval prompt.
- **블루** — the production project (`pqexkkmajbbcdwjinwdz`), read + write. Read tools are always allowed; **every write tool call (apply_migration / execute_sql that changes data) shows the user an approval prompt** — that prompt is the safety gate.

Rules:
1. Migration SQL still lives in the repo as a file under `supabase/` (idempotent, re-runnable). Commit it with the code change.
2. **그린**: run the migration yourself via the 그린 connector right after pushing to `staging`, without asking. Then verify (e.g. query the new column/policy).
3. **블루**: apply only SQL that is already committed in the repo, only when the user says to merge to `main` (or explicitly asks to apply to 블루). Before applying, inspect 블루 with the read tools (does the table/column/policy already exist? does the seed data precondition hold?) and tell the user in one line what will be applied. Then apply via `apply_migration` (the user approves the prompt) and verify afterwards with a read query. Never run ad-hoc destructive SQL (drop/delete/truncate) on 블루.
4. Never create, delete, or modify Supabase Auth accounts — that's always the user's own action in the dashboard.
5. If the connectors are not visible in the current session, fall back to the old behavior: hand the SQL to the user to run themselves.

## Vercel deploy status

A Vercel connector is available (team `team_teDSOuNReWx5fCNr8gqh7NzS`, project `prj_4oSbHC8g9sRSj16tQt60yAgY4mJY` = jadewater). Deploys take about 1–2 minutes after a push. Whenever a push to `staging` or `main` happens (by you or by the user), wait ~90 seconds, then check the newest deployment for that branch with `list_deployments` / `get_deployment`. If it is READY, tell the user in one line (and send a push notification if they are not watching). If it is ERROR, pull `get_deployment_build_logs` with `errorsOnly`, fix the cause, and push again. `githubCommitSha` on the deployment tells you which commit is live.
