---
name: push-loop
description: Safe commit-and-push workflow that checks branch safety, runs CodeRabbit review and TypeScript checks before pushing. Use this skill whenever the user says "push-loop", "push my changes", "commit and push", "safe push", or wants to commit and push code with pre-push validation. Also use when the user wants to run CodeRabbit review before pushing.
allowed-tools: Bash(git branch:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git checkout:*), Bash(git switch:*), Bash(npx tsc:*), Bash(coderabbit:*)
---

# Push Loop

A safe commit-and-push workflow that protects `main`/`master`, validates code quality, and ensures clean pushes.

Follow these steps **exactly in order**. Do not skip steps.

## Step 1: Branch Check (MANDATORY FIRST)

Check the current branch:

```bash
git branch --show-current
```

- If on `main` or `master`: **STOP IMMEDIATELY.** Ask the user which feature branch to use. Do NOT proceed until switched to a feature branch.
- If on a feature branch: continue.

This step exists because pushing directly to main can break CI, bypass review, and cause pain for every collaborator. Always work on a feature branch.

## Step 2: CodeRabbit Review

Run CodeRabbit on uncommitted changes:

```bash
coderabbit review --plain -t uncommitted
```

Review the findings carefully. If there are substantive issues (bugs, security concerns, logic errors), fix them before continuing. Style nits can be noted but shouldn't block the push.

## Step 3: TypeScript Check

Run the TypeScript compiler in check-only mode:

```bash
npx tsc --noEmit
```

This must pass clean with zero errors. Fix any type errors before continuing. Type errors that reach the remote branch will block CI and waste reviewer time.

## Step 4: Commit

Stage only the relevant changed files individually (never use `git add -A` or `git add .` — these risk committing secrets, build artifacts, or unrelated changes).

Write a descriptive commit message that explains the **why**, not just the what.

## Step 5: Push

```bash
git push
```

If the branch has no upstream yet, use `git push -u origin <branch-name>`.

Report the result to the user.
