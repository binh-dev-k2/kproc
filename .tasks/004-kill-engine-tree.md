# Task 004: Safe Kill Engine & Process Tree

## Status: DONE
## Skills: quality, backend
## Dependencies: 001, 002, 003
## Layer: BACKEND

## Description
Refactor the kill engine into focused modules with self-kill safety guards, native Unix signal delivery via `process.kill(pid, sig)`, kernel-level Windows taskkill tree handling, retry logic, signal escalation, and verification.

## Affected Files
- `src/core/tree.ts` (NEW)
- `src/core.ts` (RE-EXPORT)
- `src/kill/pid.ts` (NEW)
- `src/kill/port.ts` (NEW)
- `src/kill/name.ts` (NEW)
- `src/kill.ts` (RE-EXPORT)

## Acceptance Criteria
- [x] Accidental self-killing of `process.pid` is rejected by default unless `allowCurrentProcess: true`
- [x] Accidental killing of system PIDs (0, 4 on Windows, 1 on Unix) is rejected unless `force: true`
- [x] Unix signal delivery uses native `process.kill(pid, sig)` instead of spawning subshells
- [x] Process tree traversal uses BFS with cycle protection
- [x] `killByPort`, `killByPorts`, `killByPortRange`, `killByName` cleanly delegate to `killByPids`
- [x] All files strictly under 300 lines

## Sub-tasks
- [x] Implement `src/core/tree.ts` for process tree hierarchy
- [x] Implement `src/kill/pid.ts` with safety guards and native signals
- [x] Implement `src/kill/port.ts` for port killing
- [x] Implement `src/kill/name.ts` for pattern killing
- [x] Maintain `src/core.ts` and `src/kill.ts` re-exports for backward compatibility

## Technical Notes
- `taskkill /F /T /PID` is utilized on Windows for complete sub-tree destruction.
