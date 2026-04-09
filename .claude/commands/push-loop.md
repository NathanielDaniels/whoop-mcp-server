---
allowed-tools: Bash(git branch:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git checkout:*), Bash(git switch:*), Bash(npx tsc:*), Bash(coderabbit:*)
description: Safe commit-and-push workflow. Checks branch first, runs CodeRabbit review and TypeScript checks before pushing.
---

## Context

- Current branch: !`git branch --show-current`
- Current git status: !`git status`
- Current git diff (staged and unstaged): !`git diff HEAD --stat`

## Your task

Follow this workflow EXACTLY in order. Do NOT skip steps.

### Step 1: Branch Check (MANDATORY FIRST)

Check the current branch from the context above.

- If on `main` or `master`: **STOP IMMEDIATELY.** Ask the user which feature branch to use. Do NOT proceed until switched to a feature branch.
- If on a feature branch: continue.

### Step 2: CodeRabbit Review

Run: `coderabbit review --plain -t uncommitted`

Review the findings. If there are issues, fix them before continuing.

### Step 3: TypeScript Check

Run: `npx tsc --noEmit`

Must pass clean. Fix any errors before continuing.

### Step 4: Commit

Stage only the relevant files (never use `git add -A` or `git add .`). Write a descriptive commit message.

### Step 5: Push

Run: `git push`

If the push fails because there is no upstream tracking branch, push again with:
`git push --set-upstream origin $(git branch --show-current)`

Report the result to the user.
