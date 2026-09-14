# Task 001: Foundation: Types, Errors, Logger, and Cache

## Status: DONE
## Skills: quality, backend
## Dependencies: none
## Layer: INFRA

## Description
Establish core types, structured error classes with error codes and causes, type-safe logger without any untyped `any` constructs, and generic TTL cache.

## Affected Files
- `src/types.ts`
- `src/errors.ts`
- `src/logger.ts`
- `src/cache.ts`

## Acceptance Criteria
- [x] `src/types.ts` defines comprehensive options including `allowCurrentProcess?: boolean` and strict signal types
- [x] `src/errors.ts` implements custom errors (`ProcessNotFoundError`, `CommandExecutionError`, `TimeoutError`, `InvalidInputError`) with standard `code` property and `cause` support
- [x] `src/logger.ts` uses `unknown[]` instead of `any[]` and allows custom log sinks
- [x] `src/cache.ts` implements type-safe generic caching without `any`
- [x] Zero TypeScript errors and files strictly under 300 lines

## Sub-tasks
- [x] Update `src/types.ts` with new options and strict types
- [x] Update `src/errors.ts` with machine-readable codes and cause support
- [x] Update `src/logger.ts` with typed arguments and clean interface
- [x] Update `src/cache.ts` with generic typing and cleanup

## Technical Notes
- Retain all exported symbols to ensure 100% backward compatibility for existing consumers.
