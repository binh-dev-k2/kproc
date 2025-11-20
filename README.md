# kproc

> Lightweight Node.js utility để kill processes theo PID hoặc port - Cross-platform, TypeScript, zero dependencies.

[![npm version](https://img.shields.io/npm/v/kproc.svg)](https://www.npmjs.com/package/kproc)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🚀 Kill process theo PID, port, port range, hoặc tên
- 🔄 Retry mechanism với signal escalation (SIGTERM → SIGKILL)
- ✅ Process verification (xác nhận process đã chết)
- 🌳 Kill entire process tree (parent + children)
- 📊 Detailed results với status, error, verification
- ⚡ Smart caching và parallel operations
- 🐛 Debug logging
- 💻 Cross-platform (Windows, Linux, macOS)
- 📦 Zero dependencies

## 📦 Installation

```bash
npm install kproc
```

## 🚀 Quick Start

### Kill process on port (most common)

```typescript
import { killByPort } from 'kproc';

// Free up port 3000
await killByPort(3000);
```

### Kill by PID

```typescript
import { killByPid } from 'kproc';

// Simple kill
await killByPid(1234);

// Kill with verification
const result = await killByPid(1234, {
    verify: true,    // Confirm process is dead
    retries: 3,      // Retry up to 3 times
    tree: true       // Kill all children too
});

if (result.success) {
    console.log('✓ Process killed');
}
```

### Find process on port

```typescript
import { findPidsByPort, getProcessInfo } from 'kproc';

// Find PIDs
const pids = await findPidsByPort(8080);

// Get detailed info
const info = await getProcessInfo(pids[0]);
console.log(info);
// { pid, name, command, ports, parentPid, memoryUsage }
```

### Kill multiple processes

```typescript
import { killByPids, killByPorts, killByPortRange } from 'kproc';

// Kill multiple PIDs in parallel
const results = await killByPids([1234, 5678, 9012]);

// Kill multiple ports
await killByPorts([3000, 3001, 8080]);

// Kill port range
await killByPortRange(3000, 3010);
```

### Kill by name

```typescript
import { killByName } from 'kproc';

// Kill all Chrome processes
await killByName('chrome', { tree: true });

// Kill with regex
await killByName('node.*--inspect', { 
    useRegex: true,
    tree: true 
});
```

## 🎯 Advanced Options

```javascript
await killByPid(1234, {
    // Unix signal (ignored on Windows)
    signal: 'SIGTERM',              // default
    
    // Auto-escalate to SIGKILL if process won't die (Unix)
    forceAfterTimeout: true,
    escalationDelayMs: 3000,        // wait 3s before SIGKILL
    
    // Verify process is actually dead
    verify: true,
    
    // Retry on failure
    retries: 3,
    
    // Kill entire process tree
    tree: true,
    
    // Command timeout
    timeoutMs: 5000,
    
    // Debug logging
    debug: true
});
```

## 📚 API Reference

### Kill Functions

```typescript
killByPid(pid: number, options?: KillOptions): Promise<KillResult>
killByPids(pids: number[], options?: KillOptions): Promise<KillResult[]>
killByPort(port: number, options?: KillOptions): Promise<KillResult>
killByPorts(ports: number[], options?: KillOptions): Promise<KillResult[]>
killByPortRange(start: number, end: number, options?: KillOptions): Promise<KillResult[]>
killByName(pattern: string, options?: FindByNameOptions & KillOptions): Promise<KillResult[]>
```

### Lookup Functions

```typescript
findPidsByPort(port: number): Promise<number[]>
findPidByPort(port: number): Promise<number>
findPidsByName(pattern: string, options?: FindByNameOptions): Promise<number[]>
findPortsByPid(pid: number): Promise<number[]>
getProcessInfo(pid: number): Promise<ProcessInfo>
isProcessAlive(pid: number): Promise<boolean>
```

### Utilities

```typescript
setDebug(enabled: boolean): void           // Enable debug logs
clearCache(): void                         // Clear process cache
getCacheStats(): { size: number, oldestAge: number | null }
```

### Types

```typescript
interface KillOptions {
    signal?: UnixSignal;              // 'SIGTERM' | 'SIGKILL' | 'SIGINT' | number
    dryRun?: boolean;
    tree?: boolean;
    timeoutMs?: number;
    forceAfterTimeout?: boolean;
    escalationDelayMs?: number;
    verify?: boolean;
    retries?: number;
    debug?: boolean;
}

interface KillResult {
    pid: number;
    success: boolean;
    signal?: string | number;
    error?: string;
    verified?: boolean;
}

interface ProcessInfo {
    pid: number;
    name?: string;
    command?: string;
    ports?: number[];
    parentPid?: number;
    cpuUsage?: string;              // Unix only
    memoryUsage?: string;
}
```

### Error Classes

```typescript
import {
    ProcessNotFoundError,    // Process not found
    CommandExecutionError,   // Command failed
    TimeoutError,           // Operation timed out
    InvalidInputError       // Invalid parameters
} from 'kproc';
```

## 🐛 Debug

Enable debug logging để troubleshoot:

```typescript
import { setDebug, killByPort } from 'kproc';

setDebug(true);

// Sẽ log chi tiết: finding PID, kill command, verification, etc.
await killByPort(3000);
```

## 💡 Common Use Cases

### Free development port

```typescript
import { killByPort } from 'kproc';

try {
    await killByPort(3000, { tree: true });
    console.log('✓ Port 3000 freed');
} catch (error) {
    console.log('No process on port 3000');
}
```

### Clean up before starting server

```typescript
import { killByPort } from 'kproc';

// Kill old server before starting new one
await killByPort(3000, { tree: true }).catch(() => {});
// Start new server
startServer();
```

### Kill stubborn process

```typescript
import { killByPid } from 'kproc';

// Auto-escalate to SIGKILL if SIGTERM doesn't work
await killByPid(1234, {
    forceAfterTimeout: true,
    escalationDelayMs: 2000,
    verify: true
});
```

### Batch cleanup

```typescript
import { killByPorts } from 'kproc';

// Clean up all development ports
const ports = [3000, 3001, 8080, 8081];
const results = await killByPorts(ports, { tree: true });

console.log(`Cleaned ${results.filter(r => r.success).length} processes`);
```

## 📖 TypeScript & JavaScript

### ES Modules (TypeScript/Modern JS)

```typescript
import { 
    killByPort, 
    type KillResult,
    type KillOptions 
} from 'kproc';

const options: KillOptions = {
    tree: true,
    verify: true,
    retries: 3
};

const result: KillResult = await killByPort(3000, options);
```

### CommonJS (Node.js)

```javascript
const { killByPort } = require('kproc');

(async () => {
    await killByPort(3000);
})();
```

## 🔄 Migration from v1.x

v2.0 is mostly backward compatible. Main changes:

- Kill functions now return `KillResult` instead of `void`
- Can ignore return value if you don't need it

```typescript
// v1.x - still works in v2.0
await killByPid(1234);

// v2.0 - can use detailed results
const result = await killByPid(1234);
if (result.success) {
    console.log('Killed successfully');
}
```

## 📝 Platform Support

### Windows
- Uses `taskkill` and PowerShell `Get-CimInstance`
- Force flag (`/F`) always applied
- Tree flag (`/T`) for process tree

### Unix (Linux/macOS)
- Uses `kill`, `ps`, and `lsof`
- Configurable signals (SIGTERM, SIGKILL, etc.)
- Signal escalation support

## ⚠️ Error Handling

```typescript
import { 
    killByPid, 
    ProcessNotFoundError,
    InvalidInputError 
} from 'kproc';

try {
    const result = await killByPid(1234, { verify: true });
    
    if (!result.success) {
        console.error('Kill failed:', result.error);
    }
} catch (error) {
    if (error instanceof ProcessNotFoundError) {
        console.log('Process not found');
    } else if (error instanceof InvalidInputError) {
        console.log('Invalid PID');
    }
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © [binh-dev-k2](https://github.com/binh-dev-k2)

## 🔗 Links

- [GitHub Repository](https://github.com/binh-dev-k2/kproc)
- [npm Package](https://www.npmjs.com/package/kproc)
- [Issues](https://github.com/binh-dev-k2/kproc/issues)

---

**Made with ❤️ by binh-dev-k2**
