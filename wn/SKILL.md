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

### 2. Determine the active project
- If `$ARGUMENTS` names a project, use it.
- Otherwise use the Linear project of the work just merged. In this repo that has been **"Rapports & Stats V1"** (team **Jexplore**) — default to it unless the recent branch/commits clearly belong elsewhere.

### 3. List the available tasks (Linear)
Use the Linear MCP tools (`mcp__claude_ai_Linear__list_issues`). If they aren't loaded, load them first via ToolSearch (`select:mcp__claude_ai_Linear__list_issues,mcp__claude_ai_Linear__get_issue`).
```
list_issues(project: "<active project>", state: "Todo", includeArchived: false, limit: 30)
```
Cross-check against `main`: an issue whose PR just merged may still show as Todo for a moment — don't offer something already done.

### 4. Report + ask
- One line confirming the merge (`✅ #<n> merged, now on main`).
- The open tasks grouped by **size / priority / relevance** (recently-created recette tickets and anything continuing in-context work first; call out blocked ones like "dépend de tous les autres lots" and pure-docs/DX).
- A clear **recommendation** for the best next pick, with a one-line rationale.
- Then **ask the user which to start** (or whether to run `/next` to auto-pick).

## Important
- Report and ask only — never create a branch or write code in this skill.
- Keep it tight: the merge line, the grouped task list, the recommendation, the question. No filler.
- Match the user's language (they work in French).
