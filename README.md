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

### Kill process by PID

```javascript
import { killByPid } from 'kproc';

// Kill a single process by PID
try {
  await killByPid(1234);
  console.log('Process killed successfully');
} catch (error) {
  console.error('Failed to kill process:', error.message);
}
```

### Kill multiple processes by PIDs

```javascript
import { killByPids } from 'kproc';

// Kill multiple processes
const pids = [1234, 5678, 9012];
await killByPids(pids);
// Any failures will be logged to console
```

### Kill process by port

```javascript
import { killByPort } from 'kproc';

// Kill all processes using port 3000
try {
  await killByPort(3000);
  console.log('All processes on port 3000 killed');
} catch (error) {
  console.error('No process found on port 3000');
}
```

### Find PIDs by port

```javascript
import { findPidsByPort } from 'kproc';

// Find all PIDs using port 8080
const pids = await findPidsByPort(8080);
console.log('Processes on port 8080:', pids);
```

## API Reference

### `killByPid(pid: number): Promise<void>`

Kills a single process by its PID.

**Parameters:**
- `pid` (number): The process ID to kill

**Returns:** Promise that resolves when the process is killed

**Throws:** Error if the process cannot be killed

### `killByPids(pids: number[]): Promise<void>`

Kills multiple processes by their PIDs. Logs any failures to console but doesn't throw errors.

**Parameters:**
- `pids` (number[]): Array of process IDs to kill

**Returns:** Promise that resolves when all kill attempts are complete

### `killByPort(port: number): Promise<void>`

Kills all processes bound to a specific port.

**Parameters:**
- `port` (number): The port number to kill processes from

**Returns:** Promise that resolves when all processes are killed

**Throws:** Error if no processes are found on the specified port

### `findPidsByPort(port: number): Promise<number[]>`

Finds all process IDs bound to a specific port.

**Parameters:**
- `port` (number): The port number to search

**Returns:** Promise that resolves to an array of PIDs

## Platform Support

### Windows
- Uses `netstat -ano | findstr :<port>` to find processes by port
- Uses `taskkill /PID <pid> /T /F` to kill processes

### Unix-based (Linux/macOS)
- Uses `lsof -t -i :<port>` to find processes by port
- Uses `kill -9 <pid>` to kill processes

## Examples

### Kill a development server

```javascript
import { killByPort } from 'kproc';

// Kill your React/Vue/Node.js dev server
await killByPort(3000);
```

### Clean up multiple processes

```javascript
import { killByPids } from 'kproc';

// Kill specific processes
const processesToKill = [1234, 5678];
await killByPids(processesToKill);
```

### Find and kill processes

```javascript
import { findPidsByPort, killByPids } from 'kproc';

// Find all processes on port 8080 and kill them
const pids = await findPidsByPort(8080);
if (pids.length > 0) {
  await killByPids(pids);
  console.log(`Killed ${pids.length} processes on port 8080`);
} else {
  console.log('No processes found on port 8080');
}
```

## Error Handling

The package provides graceful error handling:

- `killByPid()` throws errors if the process cannot be killed
- `killByPids()` logs failures but doesn't throw errors
- `killByPort()` throws an error if no processes are found on the port
- `findPidsByPort()` returns an empty array if no processes are found

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

- **Email**: binhcoder02@gmail.com
- **GitHub**: [binh-dev-k2](https://github.com/binh-dev-k2)
