# Task 003: Accurate Port & Process Lookup

## Status: DONE
## Skills: quality, backend
## Dependencies: 001, 002
## Layer: BACKEND

## Description
Separate the oversized lookup module into modular, highly accurate port and process lookup handlers. Fix substring matching bugs on Windows `netstat` and add Unix `lsof` fallbacks.

## Affected Files
- `src/lookup/port.ts` (NEW)
- `src/lookup/process.ts` (NEW)
- `src/lookup.ts` (REFACTOR / RE-EXPORT)

## Acceptance Criteria
- [x] Windows netstat parser checks Local Address column specifically for exact target port
- [x] Filter excludes outbound foreign connections and false substring matches (e.g. 80 vs 8080)
- [x] Unix lookup supports `lsof` with graceful fallback (`ss` / `fuser`)
- [x] `findPortsByPid` and `getProcessInfo` normalized across platforms
- [x] All files strictly under 300 lines

## Sub-tasks
- [x] Implement `src/lookup/port.ts` with strict port extraction
- [x] Implement `src/lookup/process.ts` for process search and metadata
- [x] Re-export via `src/lookup.ts` for complete backward compatibility

## Technical Notes
- Windows `netstat -ano -p tcp` provides protocol-specific listening and bound sockets.
