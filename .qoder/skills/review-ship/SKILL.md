---
name: review-ship
description: Reviews recent commits with a code review pass, implements fixes for confirmed findings, then deploys to Vercel staging and asks before promoting to production. Use when invoked as /review-ship, or when the user asks to review commits and deploy, review and ship changes, or run the review → fix → deploy pipeline for this repository.
---

# Review → Fix → Deploy

Pipeline for this repo: review pending commits → implement confirmed fixes → deploy to Vercel staging → verify → ask before promoting to production.

Copy this checklist and track progress:

```
- [ ] Step 0: Establish scope
- [ ] Step 1: Review commits
- [ ] Step 2: Implement fixes
- [ ] Step 3: Security gate + push
- [ ] Step 4: Deploy to staging
- [ ] Step 5: Verify staging
- [ ] Step 6: Promote (user-confirmed) or stop
```

## Environment rules (mandatory)

- Every Node command that does TLS (Vercel CLI, Atlas, https fetch) must run with `$env:NODE_OPTIONS='--use-system-ca'` on this machine.
- PowerShell: use `;` as separator, never `&&`. For quote-sensitive Node snippets, write a `.cjs` file into `.vercel-tmp/` and run it instead of `node -e`.
- Deploy helper: `node .vercel-tmp/vercel-deploy.cjs --yes --preview` = staging, `--yes --prod` = production. It runs `npm run build` itself.
- Preview and production share the same Atlas database and env-var values (production and preview scopes are both configured).
- Test account for browser verification: `demo@example.com` / `demopass123`.
- Production URL: `https://modular-resume-builder-iota.vercel.app`.

## Step 0 — Establish scope

1. `git status --short` and `git log --oneline @{u}..HEAD` to find unpushed commits.
   - If the branch has no upstream, fall back to the last 5 commits (`git log --oneline -5`) and confirm the range with the user.
2. If there are uncommitted working-tree changes, ask the user whether to include them: commit first (separate commit, clear message) before continuing.
3. Run `npm run build` once to establish a clean baseline. Stop if it fails.

## Step 1 — Review commits

Launch the CodeReview subagent (Agent tool, `subagent_type: "CodeReview"`) targeting the commit range from Step 0. Ask for findings by severity with file/line references.

Present the findings summary to the user:
- **Critical / High**: must fix before shipping.
- **Medium / Low**: list as suggestions.
- No findings: say so and skip to Step 3.

## Step 2 — Implement fixes

1. Use AskUserQuestion: "Fix the findings now, or continue without fixing?" with choices **Fix now** and **Continue without fixing**.
2. If fixing: implement only the approved fixes, keep changes minimal, re-run `npm run build` until green, then commit the fixes as their own commit (do not amend reviewed commits).
3. Never proceed to deploy with a failing build.

## Step 3 — Security gate + push

1. Before any push or deploy, invoke the `security-scan` skill so its handoff gate runs (L3 deep review offer if enabled). Respect the user's choice there.
2. After the gate: `git push origin <current-branch>`.

## Step 4 — Deploy to staging

```powershell
$env:NODE_OPTIONS='--use-system-ca'; node .vercel-tmp/vercel-deploy.cjs --yes --preview
```

Capture the unique preview URL from the output. Production is untouched at this point.

## Step 5 — Verify staging

Using the browser-use MCP tools:

1. `navigate_page` to the preview URL.
   - If it redirects to `vercel.com/login`, Vercel Authentication deployment protection is active. Tell the user to set Project Settings → Deployment Protection → Vercel Authentication to "Only Production Deployments", then retry. Do not log into Vercel on their behalf.
2. `evaluate_script`: POST `/api/auth/login` with the test account, store the token in `localStorage` (`auth-token`) and user in `auth-user`; expect status 200.
3. `navigate_page` to `/dashboard`; assert resumes and blocks render (e.g., body text contains "My Resumes").
4. `list_console_messages`: confirm no errors.
5. Report pass/fail. On failure: diagnose, fix, recommit, and redeploy staging (repeat Steps 4–5) — do not offer promotion.

## Step 6 — Promote (confirm gate)

Only after staging verification passes. Use AskUserQuestion: "Staging verified. Promote to production?" with choices **Promote now** and **Keep staging only**.

If promoting:

```powershell
$env:NODE_OPTIONS='--use-system-ca'; node .vercel-tmp/vercel-deploy.cjs --yes --prod
```

Then run the same smoke test from Step 5 against the production URL and report the final state (staging URL, production URL, commits shipped, findings fixed).

If keeping staging only: report the staging URL and stop.
