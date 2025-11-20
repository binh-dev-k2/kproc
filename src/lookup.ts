/**
 * Process and port lookup functions
 * Functions for finding PIDs by port/name and reverse lookups
 * @module lookup
 */

import { getCached } from './cache';
import { CommandExecutionError, InvalidInputError, ProcessNotFoundError } from './errors';
import { log } from './logger';
import type { FindByNameOptions, ProcessInfo } from './types';
import { buildMatcher, execText, isWindows, parsePortFromAddress, parsePortFromLsof, parseWindowsPsJson } from './utils';

/**
 * Find all process IDs (PIDs) bound to a specific port
 * 
 * Uses platform-specific commands:
 * - Windows: netstat -ano | findstr :<port>
 * - Unix: lsof -t -i :<port>
 * 
 * Results are cached for 1 second to improve performance when
 * multiple operations query the same port.
 * 
 * @param port - Port number (1-65535)
 * @param timeoutMs - Optional command timeout
 * @returns Array of PIDs bound to the port (empty if none)
 * @throws {InvalidInputError} If port number is invalid
 * 
 * @example
 * ```typescript
 * // Find all processes on port 3000
 * const pids = await findPidsByPort(3000);
 * console.log(`Found ${pids.length} processes on port 3000`);
 * 
 * // With timeout
 * const pids = await findPidsByPort(8080, 5000);
 * ```
 */
export const findPidsByPort = async (port: number, timeoutMs?: number): Promise<number[]> => {
    // Validate port number
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new InvalidInputError(`Invalid port number: ${port}. Must be between 1 and 65535.`);
    }

    // Use cache to reduce redundant system calls
    return await getCached(`port:${port}`, async () => {
        try {
            const stdout = await execText(
                isWindows
                    ? `netstat -ano | findstr :${port}`
                    : `lsof -t -i :${port}`,
                timeoutMs
            );

            if (!stdout.trim()) return [];

            const pids = new Set<number>();
            const lines = stdout.trim().split(/\r?\n/).filter(Boolean);

            if (isWindows) {
                // Parse Windows netstat output
                // Format: TCP  0.0.0.0:3000  0.0.0.0:0  LISTENING  1234
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pidNum = Number(parts[parts.length - 1]);
                    if (!Number.isNaN(pidNum) && pidNum > 0) {
                        pids.add(pidNum);
                    }
                }
            } else {
                // Parse Unix lsof output (already filtered to just PIDs)
                for (const line of lines) {
                    const pidNum = Number(line.trim());
                    if (!Number.isNaN(pidNum) && pidNum > 0) {
                        pids.add(pidNum);
                    }
                }
            }

            return [...pids];
        } catch (error) {
            if (error instanceof CommandExecutionError) {
                // Command failed - likely no processes on that port
                log.debug(`No processes found on port ${port}`);
                return [];
            }
            throw error;
        }
    });
};

/**
 * Find the main (first) process ID bound to a port
 * Convenience function that returns single PID instead of array
 * 
 * @param port - Port number
 * @param timeoutMs - Optional command timeout
 * @returns The first PID found on the port
 * @throws {ProcessNotFoundError} If no process found on port
 * @throws {InvalidInputError} If port number is invalid
 * 
 * @example
 * ```typescript
 * try {
 *   const pid = await findPidByPort(3000);
 *   console.log(`Main process on port 3000: ${pid}`);
 * } catch (error) {
 *   console.log('No process on port 3000');
 * }
 * ```
 */
export const findPidByPort = async (port: number, timeoutMs?: number): Promise<number> => {
    const pids = await findPidsByPort(port, timeoutMs);

    if (pids.length === 0) {
        throw new ProcessNotFoundError(`No process found on port ${port}`);
    }

    return pids[0]; // Return the first/main PID
};

/**
 * Find PIDs by process name or command line pattern
 * 
 * Searches through all running processes and matches against:
 * - Process name (executable name)
 * - Full command line with arguments
 * 
 * Uses platform-specific commands:
 * - Windows: PowerShell Get-CimInstance Win32_Process
 * - Unix: ps -A with pid, comm, args
 * 
 * Results are cached for 1 second.
 * 
 * @param nameOrPattern - String to match (substring or regex)
 * @param opts - Options: { useRegex?: boolean }
 * @param timeoutMs - Optional command timeout
 * @returns Array of matching PIDs
 * @throws {InvalidInputError} If pattern is invalid
 * @throws {ProcessNotFoundError} If lookup command fails
 * 
 * @example
 * ```typescript
 * // Find all node processes (substring match)
 * const nodePids = await findPidsByName('node');
 * 
 * // Find processes with regex (e.g., node with --inspect flag)
 * const debugPids = await findPidsByName('node.*--inspect', { useRegex: true });
 * 
 * // Case-insensitive substring match by default
 * const chromePids = await findPidsByName('chrome');
 * ```
 */
export const findPidsByName = async (
    nameOrPattern: string,
    opts: FindByNameOptions = {},
    timeoutMs?: number
): Promise<number[]> => {
    if (!nameOrPattern || typeof nameOrPattern !== 'string') {
        throw new InvalidInputError("Name or pattern must be a non-empty string");
    }

    const { useRegex = false } = opts;

    // Build matcher function
    let matcher: (s: string) => boolean;
    try {
        matcher = buildMatcher(nameOrPattern, useRegex);
    } catch (error) {
        throw new InvalidInputError(`Invalid pattern: ${(error as Error).message}`);
    }

    // Use cache to reduce expensive process list queries
    return await getCached(`name:${nameOrPattern}:${useRegex}`, async () => {
        try {
            if (isWindows) {
                // Windows: Get all processes with name and command line
                const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"`;
                const out = await execText(psCmd, timeoutMs);
                const arr = parseWindowsPsJson(out);

                // Filter processes where name OR command line matches
                return arr
                    .filter(p => matcher(p.Name) || matcher(p.CommandLine || ""))
                    .map(p => p.ProcessId);
            } else {
                // Unix: Use ps to get all processes
                const out = await execText(`ps -A -o pid=,comm=,args=`, timeoutMs);
                const lines = out.split(/\r?\n/).filter(Boolean);
                const pids: number[] = [];

                // Parse each line: PID COMM ARGS
                for (const line of lines) {
                    const match = line.match(/^\s*(\d+)\s+([^\s]+)\s+(.+)$/);
                    if (!match) continue;

                    const pid = Number(match[1]);
                    const comm = match[2];  // Command name
                    const args = match[3];  // Full arguments

                    // Match against either comm or full args
                    if (matcher(comm) || matcher(args)) {
                        pids.push(pid);
                    }
                }

                return pids;
            }
        } catch (error) {
            if (error instanceof CommandExecutionError) {
                throw new ProcessNotFoundError(`Failed to find processes by name: ${error.message}`);
            }
            throw error;
        }
    });
};

/**
 * Reverse lookup: Find all ports used by a specific PID
 * 
 * Useful for discovering what ports a process is listening on or connected to.
 * 
 * Uses platform-specific commands:
 * - Windows: netstat -ano filtered by PID
 * - Unix: lsof -Pan -p <pid> -i
 * 
 * @param pid - Process ID to lookup
 * @param timeoutMs - Optional command timeout
 * @returns Array of port numbers (empty if process has no network activity)
 * @throws {InvalidInputError} If PID is invalid
 * @throws {ProcessNotFoundError} If lookup fails
 * 
 * @example
 * ```typescript
 * // Find what ports a web server is using
 * const ports = await findPortsByPid(1234);
 * console.log(`Process 1234 is using ports: ${ports.join(', ')}`);
 * 
 * // Get info about current process
 * const myPorts = await findPortsByPid(process.pid);
 * ```
 */
export const findPortsByPid = async (pid: number, timeoutMs?: number): Promise<number[]> => {
    if (!Number.isInteger(pid) || pid <= 0) {
        throw new InvalidInputError(`Invalid PID: ${pid}. Must be a positive integer.`);
    }

    try {
        if (isWindows) {
            // Windows: Filter netstat output by PID
            const out = await execText(`netstat -ano | findstr ${pid}`, timeoutMs);
            const ports = new Set<number>();

            for (const line of out.split(/\r?\n/)) {
                if (!line.trim()) continue;

                const parts = line.trim().split(/\s+/);
                const linePid = Number(parts[parts.length - 1]);

                // Only process lines for our target PID
                if (linePid !== pid) continue;

                // Extract port from local address (column 2)
                const localAddr = parts[1];
                const port = parsePortFromAddress(localAddr);
                if (port) ports.add(port);
            }

            return [...ports];
        } else {
            // Unix: Use lsof to get network connections for this PID
            const out = await execText(`lsof -Pan -p ${pid} -i`, timeoutMs);
            const ports = new Set<number>();

            for (const line of out.split(/\r?\n/)) {
                const port = parsePortFromLsof(line);
                if (port) ports.add(port);
            }

            return [...ports];
        }
    } catch (error) {
        if (error instanceof CommandExecutionError) {
            // Command failed - process might not exist or have no network activity
            log.debug(`No ports found for PID ${pid}`);
            return [];
        }
        throw error;
    }
};

/**
 * Get comprehensive information about a process
 * 
 * Retrieves all available information:
 * - Process name and full command line
 * - Associated ports (via findPortsByPid)
 * - Parent process ID
 * - Resource usage (CPU, memory) - platform dependent
 * 
 * @param pid - Process ID to get info for
 * @param timeoutMs - Optional command timeout
 * @returns ProcessInfo object with all available details
 * @throws {InvalidInputError} If PID is invalid
 * @throws {ProcessNotFoundError} If process doesn't exist
 * 
 * @example
 * ```typescript
 * const info = await getProcessInfo(1234);
 * console.log(`
 *   Name: ${info.name}
 *   Command: ${info.command}
 *   Ports: ${info.ports?.join(', ')}
 *   Memory: ${info.memoryUsage}
 *   Parent: ${info.parentPid}
 * `);
 * ```
 */
export const getProcessInfo = async (pid: number, timeoutMs?: number): Promise<ProcessInfo> => {
    if (!Number.isInteger(pid) || pid <= 0) {
        throw new InvalidInputError(`Invalid PID: ${pid}. Must be a positive integer.`);
    }

    log.debug(`Getting info for PID ${pid}`);

    const info: ProcessInfo = { pid };

    try {
        if (isWindows) {
            // Windows: Get process details via PowerShell
            const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\" | Select-Object ProcessId,Name,CommandLine,ParentProcessId,@{Name='CPU';Expression={$_.UserModeTime}},@{Name='Memory';Expression={$_.WorkingSetSize}} | ConvertTo-Json -Compress"`;
            const out = await execText(psCmd, timeoutMs);
            const data = JSON.parse(out);

            if (data) {
                info.name = data.Name || undefined;
                info.command = data.CommandLine || undefined;
                info.parentPid = data.ParentProcessId || undefined;

                // Convert memory from bytes to MB
                if (data.Memory) {
                    const memMB = Math.round(data.Memory / 1024 / 1024);
                    info.memoryUsage = `${memMB} MB`;
                }
            }
        } else {
            // Unix: Get process details via ps
            const out = await execText(`ps -p ${pid} -o pid=,comm=,args=,ppid=,%cpu=,%mem=`, timeoutMs);
            const match = out.trim().match(/^\s*(\d+)\s+([^\s]+)\s+(.+?)\s+(\d+)\s+([\d.]+)\s+([\d.]+)$/);

            if (match) {
                info.name = match[2];
                info.command = match[3];
                info.parentPid = Number(match[4]);
                info.cpuUsage = `${match[5]}%`;
                info.memoryUsage = `${match[6]}%`;
            }
        }

        // Get associated ports (works on all platforms)
        info.ports = await findPortsByPid(pid, timeoutMs);

        log.debug(`Retrieved info for PID ${pid}: ${info.name}`);
        return info;

    } catch (error) {
        if (error instanceof CommandExecutionError) {
            throw new ProcessNotFoundError(`Process ${pid} not found or inaccessible: ${error.message}`);
        }
        throw error;
    }
};

