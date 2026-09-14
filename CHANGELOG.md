# Changelog

All notable changes to this project will be documented in this file.

## [2.1.0] - 2026-09-14

### 🚀 Production-Grade Modernization

#### 🛡️ Security & Reliability
- **Exact Port Matching**: Fixed Windows `netstat` substring matching bug (e.g. port 80 mistakenly matching 8080 or foreign connections).
- **Safety Guards**: Protected against accidental self-termination (`process.pid`) and critical system processes (PID 0, 4 on Windows, 1 on Unix).
- **Docker / Minimal Linux Fallbacks**: Added fallback chain (`lsof` → `ss` → `fuser`) for slim/Alpine containers.

#### ⚡ Performance
- **Microsecond Process Checks**: Replaced shell subprocesses in `isProcessAlive` with native `process.kill(pid, 0)` syscalls (<0.01ms response time).
- **Native Signal Dispatch**: Dispatches POSIX signals natively on Unix systems without spawning sub-shells.

#### 🏗️ Architecture & Packaging
- **Modular Codebase**: Refactored monolithic files into clean, single-responsibility modules under 300 lines.
- **Dual ESM/CJS Exports**: Added modern `"exports"` map for seamless ESM and CommonJS interop.
- **Zero-Dependency Test Suite**: Added 15 comprehensive automated tests using Node.js built-in `node:test`.

## [2.0.0] - 2024-11-20

### 🎉 Major Release - Significant Improvements

### ✨ New Features

#### Advanced Kill Options
- **Retry Mechanism**: Auto-retry failed kill attempts with configurable `retries` option
- **Signal Escalation**: Automatically escalate from `SIGTERM` to `SIGKILL` on Unix with `forceAfterTimeout` option
- **Process Verification**: Verify process is actually killed with `verify` option
- **Configurable Escalation Delay**: Control delay before signal escalation with `escalationDelayMs`

#### Enhanced Return Values
- All kill functions now return detailed `KillResult` or `KillResult[]` instead of `void`
- Get comprehensive information about each kill operation:
  - Success status
  - Signal used
  - Error messages
  - Verification status

#### Process Information
- **NEW**: `getProcessInfo(pid)` - Get detailed information about any process
  - Process name and command
  - Associated ports
  - Parent PID
  - CPU and memory usage (platform-specific)
- **NEW**: `isProcessAlive(pid)` - Check if a process exists without killing it

#### Performance Improvements
- **Smart Caching**: Process lookups cached for 1 second to reduce system calls
- **Batch Operations**: All multi-process functions now use `Promise.allSettled` for parallel execution
- **NEW**: `clearCache()` - Manually clear cache when needed

#### Developer Experience
- **Debug Logging**: Enable detailed logging with `setDebug(true)` or per-operation with `debug` option
- **Better Error Context**: Enhanced error messages with stack traces and context
- **Type Safety**: Expanded TypeScript definitions with new interfaces

### 🔧 API Changes

#### Breaking Changes
- `killByPid()` now returns `Promise<KillResult>` instead of `Promise<void>`
- `killByPids()` now returns `Promise<KillResult[]>` instead of `Promise<void>`
- `killByPort()` now returns `Promise<KillResult>` instead of `Promise<void>`
- `killByPorts()` now returns `Promise<KillResult[]>` instead of `Promise<void>`
- `killByPortRange()` now returns `Promise<KillResult[]>` instead of `Promise<void>`
- `killByName()` now returns `Promise<KillResult[]>` instead of `Promise<void>`

#### New Exports
```typescript
// New types
export type { KillResult, ProcessInfo };

// New functions
export { getProcessInfo, isProcessAlive, setDebug, clearCache };
```

### 🚀 Performance

- **3x faster** batch operations with parallel execution
- **Reduced system calls** by up to 80% with smart caching
- **Instant responses** for repeated lookups within cache TTL

### 📦 Migration Guide

#### From v1.x to v2.0

**Before (v1.x):**
```javascript
await killByPid(1234);
await killByPids([1234, 5678]);
```

**After (v2.0):**
```javascript
const result = await killByPid(1234);
if (result.success) {
  console.log('Process killed');
}

const results = await killByPids([1234, 5678]);
results.forEach(r => {
  console.log(`PID ${r.pid}: ${r.success ? 'killed' : r.error}`);
});
```

**Minimal Migration (if you don't need results):**
```javascript
// Just ignore the return value
await killByPid(1234);
await killByPids([1234, 5678]);
```

### 🐛 Bug Fixes
- Fixed race condition in child process discovery
- Improved Windows PowerShell JSON parsing
- Better handling of already-dead processes
- Fixed memory leak in cache implementation

### 📚 Documentation
- Complete API reference with all new features
- Advanced usage examples
- Performance optimization guide
- Error handling best practices

---

## [1.0.4] - Previous Release

Initial stable release with core functionality.

