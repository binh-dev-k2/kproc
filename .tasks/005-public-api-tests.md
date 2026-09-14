# Task 005: Public API & Automated Test Suite

## Status: DONE
## Skills: quality, backend
## Dependencies: 004
## Layer: BACKEND

## Description
Assemble public API in `src/index.ts`, configure package exports in `package.json`, and build a zero-dependency automated test suite using Node.js built-in `node:test`.

## Affected Files
- `src/index.ts`
- `package.json`
- `test/utils.test.mjs` (NEW)
- `test/port.test.mjs` (NEW)
- `test/pid.test.mjs` (NEW)
- `test/kill-port.test.mjs` (NEW)

## Acceptance Criteria
- [x] `src/index.ts` cleanly re-exports all public functions, classes, and types
- [x] `package.json` has modern `"exports"`, `"sideEffects": false`, `"engines"`, and test scripts
- [x] Test suite runs and passes cleanly with `pnpm test`
- [x] Bundle build passes cleanly with `pnpm run build`

## Sub-tasks
- [x] Update `src/index.ts` public interface
- [x] Configure `package.json` exports and scripts
- [x] Create automated unit and integration tests in `test/`
- [x] Verify build and test execution

## Technical Notes
- `node:test` and `node:assert/strict` allow writing tests with zero third-party dependencies.
