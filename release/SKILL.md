---
name: release
description: Open a dated release PR from main → production on the repo itself. For repos with no upstream remote — if an upstream remote exists, use release-upstream instead.
---

Open a release PR from `main` → `production` **within the same repo**.

This is the sibling of `release-upstream`. Use this one when the repo releases to itself: there is no separate downstream repo, `production` is just another branch on `origin`.

## Steps

### 0. Check this is the right skill

```bash
git remote -v
```

- If an `upstream` remote **exists**, stop: this repo releases to a separate repo, so `release-upstream` is the correct skill. Tell the user and do nothing else.
- If there is no `origin` remote, stop and list the remotes that do exist — do not guess which one to release on.

Extract `owner/repo` from the `origin` URL (handles both `git@github.com:owner/repo.git` and `https://github.com/owner/repo.git`). Call it `<repo>` below.

### 1. Sync main

```bash
git checkout main
git pull origin main
```

Then make sure nothing local is unpushed:

```bash
git log origin/main..main --oneline
```

If that lists commits, push them with `git push origin main`. If the push is rejected (e.g. branch protection), stop and tell the user — never force-push.

### 2. Compute the commit delta

```bash
git fetch origin
git log origin/production..main --oneline --no-merges
```

If `production` does not exist on the remote, stop and ask the user which branch to release to — do not pick one.

If there are no commits ahead of `origin/production`, tell the user and stop — nothing to release. Check whether the work they expect is still sitting in an unmerged PR, and say so.

### 3. Build the PR body

- **Title**: `chore(release): YYYY-MM-DD` where the date is today in local time (use `date +%Y-%m-%d`)

  **Several releases on the same day** — the date alone is then ambiguous, so the title must carry an index. Count the release PRs already titled with today's date, whatever their state:

  ```bash
  gh pr list --repo <repo> --state all \
    --search "\"chore(release): $(date +%Y-%m-%d)\" in:title" --json number --jq 'length'
  ```

  - count `0` → no index, the title stays `chore(release): YYYY-MM-DD`
  - count `N >= 1` → title becomes `chore(release): YYYY-MM-DD - <N+1>`

  The first release of the day never carries an index; the second is ` - 2`, the third ` - 3`, and so on. If the user passed an explicit index as an argument, use it verbatim and skip the count.

- **Commits section**: list every commit from step 2 as a bullet: `- <subject> (#<PR number if present>)`
- **Test plan**: derive 3–5 checklist items from the commit subjects (focus on `feat` and `fix` entries; skip `chore`/`refactor`/`ci` unless they have user-visible impact)

### 4. Open the PR

```bash
gh pr create \
  --repo <repo> \
  --base production \
  --head main \
  --title "<title from step 3, with its index if any>" \
  --body "$(cat <<'EOF'
## Commits

<bullet list from step 3>

## Test plan

<checklist from step 3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If a PR from `main` to `production` already exists on `<repo>`, print the existing URL instead of creating a new one.

### 5. Report

Print the PR URL. Done.

## Important

- Always target `<repo>` as resolved in step 0 — never open PRs on another repo in this step.
- Never force-push.
- If the repo has an `upstream` remote, this is the wrong skill — see step 0.
- If `gh` is not authenticated for the repo owner's org, stop and tell the user.
