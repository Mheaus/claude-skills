---
name: simplify-comments
description: Rewrite code comments in ASD-STE100 simplified technical English — short sentences, one idea each, active voice, no narrative. Consolidates overlapping comments, deletes the ones that restate the code, and fixes the ones that outlived what they described. Use before opening a PR, or when asked to simplify/consolidate comments.
argument-hint: [paths]
---

Rewrite the comments of a change so a future editor finds the constraint in one sentence. Same
information, fewer words. **Comments only — no code changes.**

Comments that carry a reason are worth keeping. What this pass removes is the prose around the
reason.

## 1. Set the scope

Default to the files the current branch changed:

```bash
git diff --name-only "$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master)...HEAD"
```

Use `$ARGUMENTS` instead when paths are given. Do not widen the scope on your own — a comment pass
across untouched files buries the diff a reviewer has to read.

## 2. Measure before judging

```bash
for f in <files>; do
  awk -v n="$f" 'BEGIN{c=0;t=0} /^[[:space:]]*(\*|\/\/|#|--)/{c++} {t++} \
    END{printf "%-44s %3d/%3d (%2.0f%%)\n",n,c,t,100*c/t}' "$f"
done
```

POSIX classes, **not `\s`**: macOS awk does not know `\s` and reports 3% where the answer is 25%. A
check that lies is worse than no check.

## 3. Find what to fix

A comment needs work when it trips one of these:

- a docstring longer than **8 lines**, or one carrying a markdown heading (`##`) — it is explaining
  history rather than a constraint;
- a sentence longer than **20 words**;
- comments over **~35%** of a file's lines;
- a figure of speech: "a lie", "reads as", "the whole point", "nobody could find", "worse than";
- an em-dash aside carrying a second idea;
- a sentence that restates the line under it.

```bash
# Comment sentences over 20 words.
grep -nE '^[[:space:]]*(\*|//)' <file> \
  | awk -F'[.;]' '{for(i=1;i<=NF;i++){n=split($i,w," "); if(n>20) print substr($0,1,100)}}'
```

## 4. Rewrite

- Short sentences. One idea each. Active voice, present tense.
- Simple words. No metaphor, no narrative, no rhetorical question.
- State the constraint, then stop. "The gate stopped every deduction on 2026-08-05" becomes "the
  gate must not run on a replayed line".
- Keep the ticket reference. That is where the story belongs.
- Merge two comments that say the same thing. Keep the one beside the code that depends on it.
- Delete a comment that repeats the code.

Keep exactly two kinds of comment:

1. why a non-obvious choice was made;
2. a limit that breaks something if a future editor changes it.

## 5. Fix a wrong comment, do not shorten it

A comment can outlive what it described, and a shorter version of a false statement is still false.
Both of these have shipped:

- a comment left above the step **after** the one it documented, once that step was removed;
- a comment stating a cause that later measurements **disproved**.

Delete them, or replace them with what the code now does. Say which in the report — a reviewer who
believed the old comment needs to know it was wrong, not just shorter.

## 6. Verify

A comment pass can break a build: a mangled `/* */`, a lost `oxlint-disable` or `eslint-disable`, a
JSDoc that no longer attaches to its declaration, a docstring a test asserts on.

Read `package.json` (or the project's task file) and run its own checks — typically typecheck, lint,
format and tests. Then measure again and report before/after per file.

## 7. Commit

Type `docs`, and say what went rather than what stayed:

```
docs: rewrite the comments in simplified technical English

The comments had drifted into narrative: metaphors and sentences of forty
words. They now follow ASD-STE100 — short sentences, one idea each, active
voice.

Same information, 40 fewer lines of it. What went is the storytelling, not the
reasons.
```

## Important

- Comments only. If you find a real defect while reading, report it — do not fix it in this commit.
- Never invent a reason to fill a comment. When the reason for a line is not knowable, delete the
  comment rather than guess at it.
- Keep the project's language rules (see any `CLAUDE.md`): comments usually in English, UI copy and
  commit messages as the repository already writes them.
- Do not touch generated files, migrations, vendored code, or licence headers.
- Verbatim quotes from a spec or an RFC stay verbatim. Simplifying those changes their meaning.
