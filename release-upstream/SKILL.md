---
name: release-upstream
description: Pull main from origin, push it to the upstream remote, and open a dated release PR from main → production on the upstream repo.
---

Sync the working repo's `main` to its `upstream` remote and open a release PR from `main` → `production`.

This skill is repo-agnostic: `origin` is the repo you work in, `upstream` is the repo you release to. Both are read from the local git remotes — nothing is hardcoded.

## Steps

### 0. Resolve the upstream repo

```bash
git remote get-url upstream
```

Extract `owner/repo` from that URL (handles both `git@github.com:owner/repo.git` and `https://github.com/owner/repo.git`). Call it `<upstream-repo>` below.

If there is no `upstream` remote, stop and tell the user which remotes exist — do not guess which one to release to.

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
  --repo <upstream-repo> \
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

If a PR from `main` to `production` already exists on `<upstream-repo>`, print the existing URL instead of creating a new one.

### 5. Report

Print the PR URL. Done.

## Important

- Always target `<upstream-repo>` as resolved in step 0 — never push or open PRs on other repos in this step.
- Never force-push to upstream.
- If the upstream repo has no `production` branch, stop and ask the user for the release branch instead of picking one.
- If `gh` is not authenticated for the upstream owner's org, stop and tell the user.
