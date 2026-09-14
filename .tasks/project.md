# Project Brief: kproc Production-Grade Modernization

## Overview
`kproc` is an advanced, zero-dependency, cross-platform Node.js process and port management utility. It allows developers to reliably terminate processes by PID, port, port range, or name across Windows, Linux, and macOS.

## Goals
1. **World-Class Reliability & Accuracy:**
   - Fix port lookup logic on Windows (`netstat -ano`) to prevent false substring matches (e.g., port 80 matching 8080 or outbound connections).
   - Add fallbacks on Unix when `lsof` is absent (`ss -tulpn`, `fuser`).
   - Prevent accidental self-termination (`process.pid`) or killing system critical PIDs unless explicitly opted in (`allowCurrentProcess: true`).
2. **Sub-millisecond Performance:**
   - Replace slow subprocess polling in `isProcessAlive` with native `process.kill(pid, 0)` syscalls.
   - Use native `process.kill(pid, signal)` for Unix signal dispatch instead of shell spawning.
3. **Clean Code & Strict Quality:**
   - Comply with the `< 300` lines per file rule by modularizing into single-concern files.
   - Ban all `any` types; replace with `unknown` and proper narrowing.
   - Explicit signatures and return types on all functions.
4. **Modern Package Standards:**
   - Add conditional `"exports"` for ESM, CJS, and TypeScript typings.
   - Add `"sideEffects": false` for bundler tree-shaking.
   - Add automated test suite with Node.js built-in `node:test`.
5. **International-Grade README:**
   - Modern badges, comparison matrix vs alternatives (`fkill`, `kill-port`, `tree-kill`), quickstart, security guidelines, Docker setup, and complete API reference.
