# Task 002: Safe Exec & High-Perf Utils

## Status: DONE
## Skills: quality, backend
## Dependencies: 001
## Layer: BACKEND

## Description
Refactor utility functions with ultra-fast native `process.kill(pid, 0)` existence check, robust port/IP address parsers, and command timeout wrappers.

## Affected Files
- `src/utils.ts`

## Acceptance Criteria
- [x] `isProcessAlive` uses native `process.kill(pid, 0)` with error code checking (`ESRCH` vs `EPERM`)
- [x] `execText` safely executes commands with timeout and error wrapping
- [x] `parsePortFromAddress` strictly extracts IPv4/IPv6 port numbers without false matches
- [x] File length stays under 300 lines

## Sub-tasks
- [x] Update `isProcessAlive` implementation to native syscall
- [x] Enhance port and address parsing logic
- [x] Add explicit return types to all utility helpers

## Technical Notes
- `process.kill(pid, 0)` works across both Windows and Unix in Node.js, yielding instant <0.01ms checks.
