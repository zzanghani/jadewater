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

Exception: SQL/database migrations against Supabase are NOT covered by this auto-apply rule. Always hand these to the user to run themselves in the Supabase SQL Editor (no DB access available here), and never create Supabase Auth accounts — that's always the user's own action. If a change requires a matching SQL migration, remind the user it also needs to be run against blue's Supabase project before/after that merge.
