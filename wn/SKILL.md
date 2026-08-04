---
name: wn
description: What's next — the PR you just opened has been merged. Sync main, list the available (Todo) Linear tasks for the active project, recommend the best pick, and ask the user which to start.
argument-hint: [project-name]
---

The PR from the current branch has just been **merged**. Find the available follow-up work and let the user choose. Do NOT start a task in this skill — `wn` reports and asks; `/next` is the variant that picks and starts autonomously.

## Steps

### 1. Sync main
```bash
git checkout main
git pull origin main
git log --oneline -3
```
The just-merged commit should now be on `main`. Note it in the report (so the user sees the merge landed).

### 2. Determine the active team and project
No project is hardcoded — derive it, in this order:

1. If `$ARGUMENTS` names a project, use it.
2. Otherwise identify the **team** from the merged work: the Linear issue key in the branch name or recent commit messages (`git log --oneline -10`) carries it — a key like `ABC-131` belongs to the team that owns the `ABC` prefix. A repo usually maps to one team.
3. Within that team, take the project of the issue just merged. If the branch carried no key, list the team's projects and prefer one that is **In Progress** or **Planned** and recently updated.

Never fall back to another team's project: a report full of another product's tickets is worse than no report.

### 3. List the available tasks (Linear)
Use the Linear MCP tools (`mcp__claude_ai_Linear__list_issues`). If they aren't loaded, load them first via ToolSearch (`select:mcp__claude_ai_Linear__list_issues,mcp__claude_ai_Linear__get_issue,mcp__claude_ai_Linear__list_projects`).
```
list_issues(team: "<team>", state: "Todo", includeArchived: false, limit: 30,
            fields: ["title", "priority", "estimate", "project", "team", "url"])
```
Scope to the active project when one is clear; keep the team-wide list when it isn't, so nothing relevant is hidden. Cross-check against `main`: an issue whose PR just merged may still show as Todo for a moment — don't offer something already done.

### 4. Report + ask
- One line confirming the merge (`✅ #<n> merged, now on main`).
- The open tasks grouped by **size / priority / relevance** (recently-created QA/acceptance tickets and anything continuing in-context work first; call out the blocked ones — those whose description says they depend on other batches — and pure-docs/DX chores).
- A clear **recommendation** for the best next pick, with a one-line rationale.
- Then **ask the user which to start** (or whether to run `/next` to auto-pick).

## Important
- Report and ask only — never create a branch or write code in this skill.
- Keep it tight: the merge line, the grouped task list, the recommendation, the question. No filler.
- Match the user's language (they work in French).
