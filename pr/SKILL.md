---
name: pr
description: Create a new branch from the current changes and open a pull request. Use when the user wants to submit their work as a PR.
argument-hint: [branch-name]
---

Create a new git branch, commit the staged/unstaged changes, and open a pull request.

## Steps

1. **Analyse the current state** — run these in parallel:
   - `git status` to see all modified/untracked files (never use `-uall`)
   - `git diff` to see staged and unstaged changes
   - `git log --oneline -5` to see recent commit message style

2. **Create the branch** from the current branch:
   - If `$ARGUMENTS` is provided, use it as branch name
   - Otherwise, infer a short descriptive branch name from the changes (e.g. `feat/add-login-page`, `fix/cart-total`)
   - Use the conventional prefix: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `ci/`, `test/`
   - Run `git checkout -b <branch-name>`

3. **Stage and commit**:
   - Stage relevant files (prefer naming files explicitly over `git add -A`)
   - Do NOT commit files that likely contain secrets (.env, credentials, etc.)
   - Write a concise commit message following the repo's existing style (check the git log output)
   - End the commit message body with: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
   - Use a HEREDOC for the commit message

4. **Choose the target remote**:
   - Run `git remote -v` to list all remotes
   - If there is only one remote, use it
   - If there are multiple remotes (forks, upstream, etc.), **ask the user** which remote/repo to target before pushing or creating the PR
   - Use the chosen remote for both `git push` and `gh pr create --repo`

5. **Push and create the PR**:
   - `git push -u <remote> <branch-name>`
   - Create the PR with `gh pr create` using this format:

```
gh pr create --repo <owner/repo> --title "<short title under 70 chars>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points describing the changes>

## Test plan
<bulleted checklist of testing steps>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

6. **Return the PR URL** to the user.

## Important

- If the commit fails due to pre-commit hooks, fix the issues and create a NEW commit (do not amend).
- If `gh` is not installed, push the branch and provide the GitHub URL to create the PR manually.
- Write the PR title and description in the same language as the commit messages in the repo.
- Never force push or use `--no-verify`.
