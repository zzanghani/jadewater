<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git workflow

User is not a developer and doesn't use the terminal directly. After making a code change and confirming it's correct, commit and push it (git add, commit, push) without asking for confirmation each time — no need to check in before pushing.

Once a change is verified on staging, also merge staging into main and push (deploys to production/"블루") automatically, without asking each time.

Exception: SQL/database migrations against Supabase are NOT covered by this auto-apply rule. Always hand these to the user to run themselves in the Supabase SQL Editor (no DB access available here), and never create Supabase Auth accounts — that's always the user's own action.
