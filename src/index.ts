import { exec } from "child_process";

const isWindows = process.platform === "win32";

type UnixSignal =
    | "SIGTERM"
    | "SIGKILL"
    | "SIGINT"
    | "SIGHUP"
    | "SIGQUIT"
    | number;

interface KillOptions {
    /**
     * On Unix, which signal to send. Defaults to "SIGTERM". Ignored on Windows.
     */
    signal?: UnixSignal;
    /**
     * If true, do not actually kill processes. Only resolve as if successful.
     */
    dryRun?: boolean;
    /**
     * Kill the entire process tree (children and descendants).
     * On Windows this uses taskkill /T, on Unix we recursively find child PIDs.
     */
    tree?: boolean;
    /**
     * Maximum time to wait for a single kill command before treating as failed.
     */
    timeoutMs?: number;
}

/** Result of a detailed find operation */
interface FindByNameOptions {
    /**
     * Treat the nameOrPattern as a regular expression (string form).
     * If false, does case-insensitive substring match.
     */
    useRegex?: boolean;
}

// Custom error classes for better error handling
class ProcessNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProcessNotFoundError';
    }
}

class CommandExecutionError extends Error {
    constructor(message: string, public command: string) {
        super(message);
        this.name = 'CommandExecutionError';
    }
}

class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

class InvalidInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidInputError';
    }
}

const withTimeout = (promise: Promise<string>, ms?: number): Promise<string> => {
    if (!ms || ms <= 0) return promise;
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new TimeoutError(`Operation timed out after ${ms} ms`)), ms);
        promise.then((v) => {
            clearTimeout(t);
            resolve(v);
        }).catch((e) => {
            clearTimeout(t);
            reject(e);
        });
    });
};

const execText = async (cmd: string, timeoutMs?: number): Promise<string> => {
    try {
        return await withTimeout(new Promise((resolve, reject) => {
            exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
                if (err) {
                    const errorMsg = stderr?.trim() || err.message;
                    reject(new CommandExecutionError(`Command failed: ${errorMsg}`, cmd));
                    return;
                }
                resolve(stdout || "");
            });
        }), timeoutMs);
    } catch (error) {
        if (error instanceof TimeoutError) {
            throw error;
        }
        throw new CommandExecutionError(`Failed to execute command: ${cmd}`, cmd);
    }
};

/**
 * Find all process IDs (PIDs) that are bound to a given port.
 *
 * Windows: netstat -ano | findstr :<port>
 * Unix: lsof -t -i :<port>
 */
const findPidsByPort = async (port: number, timeoutMs?: number): Promise<number[]> => {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new InvalidInputError(`Invalid port number: ${port}. Must be between 1 and 65535.`);
    }

    try {
        const stdout = await execText(
            isWindows ? `netstat -ano | findstr :${port}` : `lsof -t -i :${port}`,
            timeoutMs
        );

        if (!stdout.trim()) return [];

        const pids = new Set<number>();
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);

        if (isWindows) {
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const pidNum = Number(parts[parts.length - 1]);
                if (!Number.isNaN(pidNum) && pidNum > 0) pids.add(pidNum);
            }
        } else {
            for (const line of lines) {
                const pidNum = Number(line.trim());
                if (!Number.isNaN(pidNum) && pidNum > 0) pids.add(pidNum);
            }
        }

        return [...pids];
    } catch (error) {
        if (error instanceof CommandExecutionError) {
            // If command fails, it might mean no processes on that port
            return [];
        }
        throw error;
    }
};

/**
 * Find the main process ID (parent) that is bound to a given port.
 * Returns the first/main PID found on the port.
 */
const findPidByPort = async (port: number, timeoutMs?: number): Promise<number> => {
    const pids = await findPidsByPort(port, timeoutMs);
    if (pids.length === 0) {
        throw new ProcessNotFoundError(`No process found on port ${port}`);
    }
    return pids[0]; // Return the first/main PID
};

/**
 * Kill a process by its PID.
 */
const killByPid = async (pid: number, options: KillOptions = {}): Promise<void> => {
    if (!Number.isInteger(pid) || pid <= 0) {
        throw new InvalidInputError(`Invalid PID: ${pid}. Must be a positive integer.`);
    }

    const { signal = "SIGTERM", dryRun = false, tree = false, timeoutMs } = options;

    if (dryRun) {
        console.log(`[DRY RUN] Would kill process ${pid} with signal ${signal}${tree ? ' (tree)' : ''}`);
        return;
    }

    try {
        if (isWindows) {
            const flags = tree ? "/T /F" : "/F";
            await execText(`taskkill /PID ${pid} ${flags}`, timeoutMs);
        } else {
            const sig = typeof signal === "number" ? signal : signal.toString();
            if (tree) {
                const descendants = await findDescendantPids(pid, timeoutMs);
                // Kill children first, then the parent
                for (const child of descendants) {
                    try {
                        await execText(`kill -s ${sig} ${child}`, timeoutMs);
                    } catch (error) {
                        console.warn(`Failed to kill child process ${child}: ${(error as Error).message}`);
                    }
                }
            }
            await execText(`kill -s ${sig} ${pid}`, timeoutMs);
        }
    } catch (error) {
        if (error instanceof CommandExecutionError) {
            throw new ProcessNotFoundError(`Failed to kill process ${pid}: ${error.message}`);
        }
        throw error;
    }
};

/**
 * Kill multiple processes by their PIDs.
 * Throws if any process fails to kill.
 */
const killByPids = async (pids: number[], options: KillOptions = {}): Promise<void> => {
    if (!Array.isArray(pids) || pids.length === 0) {
        throw new InvalidInputError("PIDs array must be non-empty");
    }

    const errors: string[] = [];

    for (const pid of pids) {
        try {
            await killByPid(pid, options);
        } catch (error) {
            const errorMsg = `Failed to kill process ${pid}: ${(error as Error).message}`;
            errors.push(errorMsg);
            console.error(errorMsg);
        }
    }

    if (errors.length > 0) {
        throw new ProcessNotFoundError(`Failed to kill ${errors.length} processes: ${errors.join('; ')}`);
    }
};

/**
 * Kill the main process bound to a given port.
 * Throws if none found.
 */
const killByPort = async (port: number, options: KillOptions = {}): Promise<void> => {
    const pid = await findPidByPort(port, options.timeoutMs);
    await killByPid(pid, options);
};

/**
 * Kill all processes bound to any of the given ports.
 */
const killByPorts = async (ports: number[], options: KillOptions = {}): Promise<void> => {
    if (!Array.isArray(ports) || ports.length === 0) {
        throw new InvalidInputError("Ports array must be non-empty");
    }

    const unique = new Set<number>();
    const errors: string[] = [];

    for (const port of ports) {
        try {
            const pids = await findPidsByPort(port, options.timeoutMs);
            for (const pid of pids) unique.add(pid);
        } catch (error) {
            errors.push(`Port ${port}: ${(error as Error).message}`);
        }
    }

    if (unique.size === 0) {
        throw new ProcessNotFoundError(`No processes found on ports: ${ports.join(", ")}. Errors: ${errors.join('; ')}`);
    }

    await killByPids([...unique], options);
};

/**
 * Kill all processes bound to ports within [start, end] inclusive.
 */
const killByPortRange = async (start: number, end: number, options: KillOptions = {}): Promise<void> => {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new InvalidInputError("Start and end must be integers");
    }
    if (end < start) {
        throw new InvalidInputError("Invalid port range: end < start");
    }
    if (start < 1 || end > 65535) {
        throw new InvalidInputError("Port range must be between 1 and 65535");
    }

    const ports: number[] = [];
    for (let p = start; p <= end; p++) ports.push(p);
    await killByPorts(ports, options);
};

/**
 * Find PIDs by process name or command line pattern.
 * - Windows: uses PowerShell (Get-CimInstance) to retrieve Name and CommandLine.
 * - Unix: uses ps to list pid, comm, args.
 */
const findPidsByName = async (nameOrPattern: string, opts: FindByNameOptions = {}, timeoutMs?: number): Promise<number[]> => {
    if (!nameOrPattern || typeof nameOrPattern !== 'string') {
        throw new InvalidInputError("Name or pattern must be a non-empty string");
    }

    const { useRegex = false } = opts;
    let matcher: (s: string) => boolean;

    try {
        matcher = buildMatcher(nameOrPattern, useRegex);
    } catch (error) {
        throw new InvalidInputError(`Invalid pattern: ${(error as Error).message}`);
    }

    try {
        if (isWindows) {
            const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"`;
            const out = await execText(psCmd, timeoutMs);
            const arr = parseWindowsPsJson(out);
            return arr.filter(p => matcher(p.Name) || matcher(p.CommandLine || "")).map(p => p.ProcessId);
        } else {
            const out = await execText(`ps -A -o pid=,comm=,args=`, timeoutMs);
            const lines = out.split(/\r?\n/).filter(Boolean);
            const pids: number[] = [];
            for (const line of lines) {
                const match = line.match(/^\s*(\d+)\s+([^\s]+)\s+(.+)$/);
                if (!match) continue;
                const pid = Number(match[1]);
                const comm = match[2];
                const args = match[3];
                if (matcher(comm) || matcher(args)) pids.push(pid);
            }
            return pids;
        }
    } catch (error) {
        if (error instanceof CommandExecutionError) {
            throw new ProcessNotFoundError(`Failed to find processes by name: ${error.message}`);
        }
        throw error;
    }
};

/** Kill processes by name or command pattern */
const killByName = async (nameOrPattern: string, opts: FindByNameOptions & KillOptions = {}): Promise<void> => {
    const { timeoutMs, ...rest } = opts as KillOptions & FindByNameOptions;
    const pids = await findPidsByName(nameOrPattern, { useRegex: (opts as FindByNameOptions).useRegex }, timeoutMs);
    if (pids.length === 0) {
        throw new ProcessNotFoundError(`No process matched pattern: ${nameOrPattern}`);
    }
    await killByPids(pids, rest as KillOptions);
};

/**
 * Reverse lookup: find all listening/connected ports for a PID.
 */
const findPortsByPid = async (pid: number, timeoutMs?: number): Promise<number[]> => {
    if (!Number.isInteger(pid) || pid <= 0) {
        throw new InvalidInputError(`Invalid PID: ${pid}. Must be a positive integer.`);
    }

    try {
        if (isWindows) {
            const out = await execText(`netstat -ano | findstr ${pid}`, timeoutMs);
            const ports = new Set<number>();
            for (const line of out.split(/\r?\n/)) {
                if (!line.trim()) continue;
                const parts = line.trim().split(/\s+/);
                const last = Number(parts[parts.length - 1]);
                if (last !== pid) continue;
                const local = parts[1];
                const port = parsePortFromAddress(local);
                if (port) ports.add(port);
            }
            return [...ports];
        } else {
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
            throw new ProcessNotFoundError(`Failed to find ports for PID ${pid}: ${error.message}`);
        }
        throw error;
    }
};

// ---------- helpers ----------

const buildMatcher = (pattern: string, useRegex: boolean): ((s: string) => boolean) => {
    if (useRegex) {
        let re: RegExp;
        try {
            re = new RegExp(pattern, "i");
        } catch (e) {
            throw new InvalidInputError(`Invalid regex pattern: ${(e as Error).message}`);
        }
        return (s: string) => re.test(s || "");
    }
    const lowered = pattern.toLowerCase();
    return (s: string) => (s || "").toLowerCase().includes(lowered);
};

const parseWindowsPsJson = (jsonText: string): Array<{ ProcessId: number; Name: string; CommandLine?: string }> => {
    const text = jsonText.trim();
    if (!text) return [];
    try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) return data;
        return [data];
    } catch (error) {
        throw new CommandExecutionError(`Failed to parse PowerShell JSON output: ${(error as Error).message}`, "PowerShell");
    }
};

const parsePortFromAddress = (addr: string): number | null => {
    // Handles IPv4 like 127.0.0.1:3000 and IPv6 like [::]:3000
    const ipv6 = addr.match(/\[(.*)\]:(\d+)/);
    if (ipv6) return Number(ipv6[2]);
    const ipv4 = addr.match(/:(\d+)$/);
    return ipv4 ? Number(ipv4[1]) : null;
};

const parsePortFromLsof = (line: string): number | null => {
    // lsof lines often contain host:port-> or host:port (LISTEN)
    const m = line.match(/:(\d+)(?:->|\s)/);
    return m ? Number(m[1]) : null;
};

const findChildPidsOnce = async (ppid: number, timeoutMs?: number): Promise<number[]> => {
    if (!Number.isInteger(ppid) || ppid <= 0) {
        throw new InvalidInputError(`Invalid parent PID: ${ppid}. Must be a positive integer.`);
    }

    try {
        if (isWindows) {
            const out = await execText(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${ppid} } | Select-Object ProcessId | ConvertTo-Json -Compress"`, timeoutMs);
            const arr = parseWindowsPsJson(out);
            return arr.map(a => a.ProcessId).filter((n) => Number.isFinite(n));
        } else {
            const out = await execText(`ps -o pid= --ppid ${ppid}`, timeoutMs);
            return out.split(/\r?\n/).map(s => Number(s.trim())).filter(n => !Number.isNaN(n) && n > 0);
        }
    } catch (error) {
        if (error instanceof CommandExecutionError) {
            throw new ProcessNotFoundError(`Failed to find child processes of PID ${ppid}: ${error.message}`);
        }
        throw error;
    }
};

const findDescendantPids = async (pid: number, timeoutMs?: number): Promise<number[]> => {
    const result: number[] = [];
    const queue: number[] = [pid];
    const visited = new Set<number>();

    while (queue.length) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        try {
            const children = await findChildPidsOnce(current, timeoutMs);
            for (const c of children) {
                if (!visited.has(c)) {
                    result.push(c);
                    queue.push(c);
                }
            }
        } catch (error) {
            console.warn(`Failed to find children of PID ${current}: ${(error as Error).message}`);
        }
    }

    // Exclude the root pid itself; caller decides order
    return result.filter((p) => p !== pid);
};

export {
    CommandExecutionError, findPidByPort, findPidsByName,
    // core lookups
    findPidsByPort, findPortsByPid, InvalidInputError, killByName,
    // kill primitives
    killByPid,
    killByPids,
    killByPort, killByPortRange, killByPorts,
    // types
    KillOptions,
    // error classes
    ProcessNotFoundError, TimeoutError
};
