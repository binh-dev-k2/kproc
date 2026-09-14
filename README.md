# kproc

<div align="center">

**Production-grade, cross-platform process and port management for Node.js.**  
*Kill processes by PID, port, port range, or pattern with process tree cleanup, retry escalation, and zero dependencies.*

[![npm version](https://img.shields.io/npm/v/kproc.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/kproc)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg?style=flat-square)](https://www.npmjs.com/package/kproc)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-15%20passed-brightgreen.svg?style=flat-square)](https://github.com/binh-dev-k2/kproc)

</div>

---

## ⚡ Highlights

- **📦 Zero Runtime Dependencies** — No bloated `node_modules`, zero supply chain attack surface.
- **🚀 Sub-Millisecond Speed** — Microsecond process existence checks using native `process.kill(pid, 0)` syscalls rather than launching slow sub-shells (`tasklist` / `kill -0`).
- **🎯 Exact Port Matching** — Eliminates false-positive substring matches on Windows (e.g. port `80` will never mistakenly match `8080` or outbound TCP sockets).
- **🛡️ Built-in Safety Guards** — Protects against accidental suicide of the calling process (`process.pid`) or critical OS kernel processes (PID `0`, `4` on Windows, PID `1` on Unix) unless explicitly overridden.
- **🌳 Process Tree Termination** — Recursively discovers and terminates parent and all child/descendant processes (via `taskkill /T` on Windows and BFS process tree traversal on Unix).
- **🔄 Signal Escalation & Verification** — Graceful `SIGTERM` with automatic escalation to `SIGKILL` if a stubborn process refuses to exit, plus optional cryptographic/kernel death verification.
- **🐳 Docker & Minimal Linux Ready** — Automated fallback chain: `lsof` → `ss` → `fuser` for minimal Alpine/distroless containers.
- **💎 Modern Dual Package** — Full ESM and CommonJS exports with complete TypeScript declaration files (`.d.ts` / `.d.mts`).

---

## 📊 Feature Comparison

| Feature | `kproc` | `fkill` | `kill-port` | `tree-kill` |
|:---|:---:|:---:|:---:|:---:|
| **Runtime Dependencies** | **0** | 10+ | 1 | 0 |
| **Kill by Port** | ✅ | ✅ | ✅ | ❌ |
| **Kill by Port Range** | ✅ | ❌ | ❌ | ❌ |
| **Kill by PID** | ✅ | ✅ | ❌ | ✅ |
| **Kill by Name / Regex** | ✅ | ✅ | ❌ | ❌ |
| **Process Tree Cleanup** | ✅ | ✅ | ❌ | ✅ |
| **Host Suicide Safety Guard** | ✅ | ❌ | ❌ | ❌ |
| **Native Microsecond Checks** | ✅ | ❌ | ❌ | ❌ |
| **Retry & Signal Escalation** | ✅ | ❌ | ❌ | ❌ |
| **Zero Substring False-Positives** | ✅ | ❌ | ❌ | N/A |
| **ESM + CJS Dual Export** | ✅ | ESM only | CJS only | CJS only |

---

## 📦 Installation

```bash
# pnpm
pnpm add kproc

# npm
npm install kproc

# yarn
yarn add kproc

# bun
bun add kproc
```

---

## 🚀 Quick Start

### 1. Free Up a Port (Most Common)

```typescript
import { killByPort } from 'kproc';

// Terminate whichever process is listening on port 3000
const result = await killByPort(3000, { tree: true, verify: true });

if (result.success) {
    console.log(`Port 3000 freed! (Killed PID: ${result.pid})`);
}
```

### 2. Kill by PID with Verification & Tree Cleanup

```typescript
import { killByPid } from 'kproc';

const result = await killByPid(14820, {
    tree: true,     // Terminate all descendant child processes
    verify: true,   // Confirm kernel has removed process from table
    retries: 3      // Auto-retry up to 3 times on transient failure
});

console.log(result);
// { pid: 14820, success: true, verified: true, signal: 'SIGTERM' }
```

### 3. Kill Multiple Ports & Port Ranges

```typescript
import { killByPorts, killByPortRange } from 'kproc';

// Kill specific development ports in parallel
await killByPorts([3000, 3001, 8080, 8081]);

// Kill an entire range of ports
await killByPortRange(4000, 4010, { tree: true });
```

### 4. Kill by Name or Regex

```typescript
import { killByName } from 'kproc';

// Kill all processes named "chrome"
await killByName('chrome', { tree: true });

// Kill using regular expressions
await killByName('node.*--inspect', {
    useRegex: true,
    tree: true
});
```

### 5. Inspect Process & Port Metadata

```typescript
import { findPidsByPort, getProcessInfo } from 'kproc';

// Discover PIDs bound to port 8080
const [pid] = await findPidsByPort(8080);

if (pid) {
    const info = await getProcessInfo(pid);
    console.log(info);
    // {
    //   pid: 14208,
    //   name: "node.exe",
    //   command: "node server.js",
    //   ports: [8080],
    //   parentPid: 9812,
    //   memoryUsage: "48 MB"
    // }
}
```

---

## 🛡️ Safety Guards

`kproc` includes production safeguards to prevent accidental self-termination or catastrophic system crashes:

```typescript
import { killByPid, InvalidInputError } from 'kproc';

try {
    // ❌ By default, kproc blocks attempts to kill the current Node process:
    await killByPid(process.pid);
} catch (error) {
    if (error instanceof InvalidInputError) {
        console.error('Safety guard triggered:', error.message);
        // "Refusing to kill current process (PID: ...). Set allowCurrentProcess: true if this is intentional."
    }
}

// ✅ Explicit opt-in when self-termination is intended:
await killByPid(process.pid, { allowCurrentProcess: true });
```

Similarly, system-critical PIDs (PID `0` and `4` on Windows, PID `1` on Unix) are protected unless `{ force: true }` is supplied.

---

## 📚 API Reference

### Process Termination

| Function | Parameters | Return Type | Description |
|:---|:---|:---|:---|
| `killByPort(port, options?)` | `port: number, options?: KillOptions` | `Promise<KillResult>` | Terminate process listening on given port |
| `killByPorts(ports, options?)` | `ports: number[], options?: KillOptions` | `Promise<KillResult[]>` | Terminate processes on multiple ports in parallel |
| `killByPortRange(start, end, options?)` | `start: number, end: number, options?: KillOptions` | `Promise<KillResult[]>` | Terminate all processes bound to ports in range |
| `killByPid(pid, options?)` | `pid: number, options?: KillOptions` | `Promise<KillResult>` | Terminate process by PID with retry and escalation |
| `killByPids(pids, options?)` | `pids: number[], options?: KillOptions` | `Promise<KillResult[]>` | Terminate multiple PIDs in parallel |
| `killByName(pattern, options?)` | `pattern: string, options?: FindByNameOptions & KillOptions` | `Promise<KillResult[]>` | Terminate processes matching substring or regex |

### Inspection & Lookup

| Function | Parameters | Return Type | Description |
|:---|:---|:---|:---|
| `findPidsByPort(port, options?)` | `port: number, options?: PortLookupOptions \| number` | `Promise<number[]>` | Get array of PIDs bound to a port |
| `findPidByPort(port, options?)` | `port: number, options?: PortLookupOptions \| number` | `Promise<number>` | Get main PID on port (throws `ProcessNotFoundError` if none) |
| `findPortsByPid(pid, timeoutMs?)` | `pid: number, timeoutMs?: number` | `Promise<number[]>` | Reverse lookup: list ports opened by PID |
| `findPidsByName(pattern, options?)` | `pattern: string, options?: FindByNameOptions` | `Promise<number[]>` | Find PIDs matching name or regex |
| `getProcessInfo(pid, timeoutMs?)` | `pid: number, timeoutMs?: number` | `Promise<ProcessInfo>` | Retrieve process name, command, parent PID, ports, memory |
| `isProcessAlive(pid)` | `pid: number` | `Promise<boolean>` | Microsecond check if process exists in OS table |

### Options Interfaces

```typescript
export interface KillOptions {
    /** Signal to send on Unix systems (ignored on Windows). Default: "SIGTERM" */
    signal?: UnixSignal;

    /** Simulate kill without actually terminating the process. Default: false */
    dryRun?: boolean;

    /** Kill process tree (parent and all descendant children). Default: false */
    tree?: boolean;

    /** Maximum time in milliseconds to wait for system operations */
    timeoutMs?: number;

    /** Auto-escalate from SIGTERM to SIGKILL if process won't exit (Unix). Default: false */
    forceAfterTimeout?: boolean;

    /** Delay before escalating to SIGKILL. Default: 3000ms */
    escalationDelayMs?: number;

    /** Verify process is dead after kill attempt. Default: false */
    verify?: boolean;

    /** Retry attempts if kill command fails. Default: 0 */
    retries?: number;

    /** Enable verbose debug logging for this operation. Default: false */
    debug?: boolean;

    /** Safety guard: Allow killing process.pid. Default: false */
    allowCurrentProcess?: boolean;

    /** Force kill, bypassing checks on critical system PIDs (0, 4 on Windows, 1 on Unix). Default: false */
    force?: boolean;
}
```

---

## ⚠️ Error Hierarchy

All custom errors inherit from `KProcError`, featuring machine-readable `code` properties and error cause chains:

```typescript
import {
    KProcError,
    ProcessNotFoundError,     // code: "PROCESS_NOT_FOUND"
    CommandExecutionError,    // code: "COMMAND_EXECUTION_FAILED"
    TimeoutError,             // code: "OPERATION_TIMEOUT"
    InvalidInputError         // code: "INVALID_INPUT"
} from 'kproc';

try {
    await killByPort(3000);
} catch (error) {
    if (error instanceof ProcessNotFoundError) {
        console.log('Port 3000 is already free.');
    } else if (error instanceof KProcError) {
        console.error(`kproc failed [${error.code}]:`, error.message);
    }
}
```

---

## 🐳 Docker & Minimal Linux Environments

In stripped-down Docker images (such as `node:alpine` or `node:slim`), the standard `lsof` tool might not be pre-installed. 

`kproc` automatically handles this:
1. Attempts `lsof -t -i :<port>`
2. Falls back to `ss -lntp '( sport = :<port> )'`
3. Falls back to `fuser <port>/tcp`

If using Alpine Linux and you want maximum speed, you can optionally install `lsof`:
```dockerfile
RUN apk add --no-cache lsof
```

---

## 📄 License

MIT © [binh-dev-k2](https://github.com/binh-dev-k2)
