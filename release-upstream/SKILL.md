---
name: release-upstream
description: Pull main from origin, push to upstream (jexplore-co/frontend), and open a dated release PR from main → production on the upstream repo.
---

Sync `sakuga-software/jexplore-web` main to `jexplore-co/frontend` and open a release PR.

## Steps

### 1. Pull and push

Run in parallel:
```bash
git checkout main
git pull origin main
```
Then:
```bash
git push upstream main
```

If `git push upstream main` is rejected (e.g. branch protection), stop and tell the user — do not force-push.

### 2. Compute the commit delta

```bash
git fetch upstream
git log upstream/production..main --oneline --no-merges
```

If there are no commits ahead of `upstream/production`, tell the user and stop — nothing to release.

### 3. Build the PR body

- **Title**: `chore(release): YYYY-MM-DD` where the date is today in local time (use `date +%Y-%m-%d`)
- **Commits section**: list every commit from step 2 as a bullet: `- <subject> (#<PR number if present>)`
- **Test plan**: derive 3–5 checklist items from the commit subjects (focus on `feat` and `fix` entries; skip `chore`/`refactor`/`ci` unless they have user-visible impact)

### 4. Open the PR

```bash
gh pr create \
  --repo jexplore-co/frontend \
  --base production \
  --head main \
  --title "chore(release): $(date +%Y-%m-%d)" \
  --body "$(cat <<'EOF'
## Commits

<bullet list from step 3>

## Test plan

<checklist from step 3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If a PR from `main` to `production` already exists on `jexplore-co/frontend`, print the existing URL instead of creating a new one.

### 5. Report

Print the PR URL. Done.

## Important

- Always use `--repo jexplore-co/frontend` — never push or open PRs on other repos in this step.
- Never force-push to upstream.
- The upstream remote is named `upstream` in this repo.
- If `gh` is not authenticated for the `jexplore-co` org, stop and tell the user.
