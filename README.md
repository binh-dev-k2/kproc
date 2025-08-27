# kproc

A lightweight Node.js utility to kill processes by PID or port number. Cross-platform support for Windows, Linux, and macOS.

## Features

- 🚀 **Cross-platform**: Works on Windows, Linux, and macOS
- ⚡ **Lightweight**: No external dependencies
- 🔧 **TypeScript**: Full TypeScript support with type definitions
- 🎯 **Simple API**: Easy-to-use functions for process management
- 🛡️ **Safe**: Graceful error handling and logging

## Installation

```bash
npm install kproc
```

## Usage

### Kill process by PID (with options)

```javascript
import { killByPid } from 'kproc';

// Kill a single process by PID
await killByPid(1234, {
  signal: 'SIGTERM',   // Unix only; ignored on Windows
  tree: true,          // kill process tree
  dryRun: false,       // set true to simulate
  timeoutMs: 5000
});
```

### Kill multiple processes by PIDs

```javascript
import { killByPids } from 'kproc';

const pids = [1234, 5678, 9012];
await killByPids(pids, { tree: true }); // failures are logged per PID
```

### Kill process by port / ports / port range

```javascript
import { killByPort, killByPorts, killByPortRange } from 'kproc';

await killByPort(3000, { signal: 'SIGKILL' });
await killByPorts([3000, 3001]);
await killByPortRange(3000, 3010);
```

### Find PIDs by port / by name, and reverse lookup ports by PID

```javascript
import { findPidsByPort, findPidsByName, findPortsByPid } from 'kproc';

const pidsOn8080 = await findPidsByPort(8080);
const nodePids = await findPidsByName('node', { useRegex: false });
const portsOfPid = await findPortsByPid(1234);
console.log(pidsOn8080, nodePids, portsOfPid);

// Kill by name/command pattern
import { killByName } from 'kproc';
await killByName('node --inspect', { useRegex: false, tree: true });
```

## API Reference

### `killByPid(pid: number, options?: KillOptions): Promise<void>`

Kills a single process by its PID.

**Parameters:**
- `pid` (number): The process ID to kill
- `options` (KillOptions): `{ signal?, dryRun?, tree?, timeoutMs? }`

**Returns:** Promise that resolves when the process is killed

**Throws:** Error if the process cannot be killed

### `killByPids(pids: number[], options?: KillOptions): Promise<void>`

Kills multiple processes by their PIDs. Logs any failures to console but doesn't throw errors.

**Parameters:**
- `pids` (number[]): Array of process IDs to kill
- `options` (KillOptions)

**Returns:** Promise that resolves when all kill attempts are complete

### `killByPort(port: number, options?: KillOptions): Promise<void>`

Kills all processes bound to a specific port.

**Parameters:**
- `port` (number): The port number to kill processes from
- `options` (KillOptions)

**Returns:** Promise that resolves when all processes are killed

**Throws:** Error if no processes are found on the specified port

### `killByPorts(ports: number[], options?: KillOptions): Promise<void>`

Kills processes bound to any of the given ports.

**Parameters:**
- `ports` (number[]): List of port numbers
- `options` (KillOptions)

### `killByPortRange(start: number, end: number, options?: KillOptions): Promise<void>`

Kills processes bound to ports within the range `[start, end]`.

**Parameters:**
- `start` (number), `end` (number)
- `options` (KillOptions)

### `findPidsByPort(port: number, timeoutMs?: number): Promise<number[]>`

Finds all process IDs bound to a specific port.

**Parameters:**
- `port` (number): The port number to search
- `timeoutMs` (number, optional)

**Returns:** Promise that resolves to an array of PIDs

### `findPidsByName(pattern: string, options?: { useRegex?: boolean }, timeoutMs?: number): Promise<number[]>`

Finds PIDs by process name or full command line.

### `findPortsByPid(pid: number, timeoutMs?: number): Promise<number[]>`

Reverse lookup: find ports used by a PID.

### `killByName(pattern: string, options?: { useRegex?: boolean } & KillOptions): Promise<void>`

Kill processes by name/command pattern.

## Platform Support

### Windows
- Uses `netstat -ano | findstr :<port>` to find processes by port
- Uses PowerShell `Get-CimInstance Win32_Process` for name/command lookups
- Uses `taskkill /PID <pid> /F` (and `/T` for tree) to kill processes

### Unix-based (Linux/macOS)
- Uses `lsof -t -i :<port>` to find processes by port
- Uses `ps` for name/command and child-process discovery
- Uses `kill -s <signal> <pid>` (default `SIGTERM`)

## Examples

### Kill a development server

```javascript
import { killByPort } from 'kproc';
await killByPort(3000, { tree: true });
```

### Clean up multiple processes

```javascript
import { killByPids } from 'kproc';
const processesToKill = [1234, 5678];
await killByPids(processesToKill, { signal: 'SIGTERM' });
```

### Find and kill processes

```javascript
import { findPidsByPort, killByPids } from 'kproc';
const pids = await findPidsByPort(8080);
if (pids.length) await killByPids(pids, { tree: true });
```

## Error Handling

The package provides graceful error handling:

- `killByPid()` throws if the process cannot be killed
- `killByPids()` logs per-PID failures but does not throw
- `killByPort*()` throws if no processes are found
- `find*()` functions return an empty array if commands are unavailable or no matches

## Types

```ts
type UnixSignal = 'SIGTERM' | 'SIGKILL' | 'SIGINT' | 'SIGHUP' | 'SIGQUIT' | number;

interface KillOptions {
  signal?: UnixSignal; // Unix only; default 'SIGTERM'
  dryRun?: boolean;    // simulate without killing
  tree?: boolean;      // kill process tree
  timeoutMs?: number;  // per-command timeout
}
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

- **Email**: binhcoder02@gmail.com
- **GitHub**: [binh-dev-k2](https://github.com/binh-dev-k2)
