param(
    [int]$MaxIterations = 10,
    [int]$SleepSeconds = 2,
    [switch]$Notify
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "Starting Ralph - Max $MaxIterations iterations"
Write-Host ""

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host "==========================================="
    Write-Host "  Iteration $i of $MaxIterations"
    Write-Host "==========================================="

    $prompt = @"
You are Ralph, an autonomous coding agent. Do exactly ONE task per iteration.

## Steps

1. Read PRD.md and find the first task that is NOT complete (marked [ ]).
2. Read progress.txt - check the Learnings section first for patterns from previous iterations.
3. Implement that ONE task only.
4. Run tests/typecheck to verify it works.

## Critical: Only Complete If Tests Pass

- If tests PASS:
  - Update PRD.md to mark the task complete (change [ ] to [x])
  - Commit your changes with message: feat: [task description]
  - Append what worked to progress.txt

- If tests FAIL:
  - Do NOT mark the task complete
  - Do NOT commit broken code
  - Append what went wrong to progress.txt (so next iteration can learn)

## Progress Notes Format

Append to progress.txt using this format:

## Iteration [N] - [Task Name]
- What was implemented
- Files changed
- Learnings for future iterations:
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---

## Update CLAUDE.md (If Applicable)

If you discover a reusable pattern that future work should know about:
- Check if CLAUDE.md exists in the project root
- Add patterns like: 'This codebase uses X for Y' or 'Always do Z when changing W'
- Only add genuinely reusable knowledge, not task-specific details

## End Condition

After completing your task, check PRD.md:
- If ALL tasks are [x], output exactly: <promise>COMPLETE</promise>
- If tasks remain [ ], just end your response (next iteration will continue)
"@

    # Capture stdout+stderr and preserve newlines for reliable printing + COMPLETE token detection
    $result = (& claude --dangerously-skip-permissions -p $prompt 2>&1 | Out-String)

    Write-Host $result
    Write-Host ""

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "claude exited with code $LASTEXITCODE (continuing to next iteration)"
    }

    if ($result -match "<promise>COMPLETE</promise>") {
        Write-Host "==========================================="
        Write-Host "  All tasks complete after $i iterations!"
        Write-Host "==========================================="
        
        # Notify Clawdbot if flag set
        if ($Notify) {
            $taskCount = (Select-String -Path "PRD.md" -Pattern "\[x\]" | Measure-Object).Count
            & clawdbot gateway wake --text "Ralph complete: $taskCount tasks finished in $i iterations. Ready for review." --mode now
        }
        
        exit 0
    }

    Start-Sleep -Seconds $SleepSeconds
}

Write-Host "==========================================="
Write-Host "  Reached max iterations ($MaxIterations)"
Write-Host "==========================================="

# Notify even on max iterations
if ($Notify) {
    $complete = (Select-String -Path "PRD.md" -Pattern "\[x\]" | Measure-Object).Count
    $remaining = (Select-String -Path "PRD.md" -Pattern "\[ \]" | Measure-Object).Count
    & clawdbot gateway wake --text "Ralph hit max iterations: $complete done, $remaining remaining. Needs review." --mode now
}

exit 1
