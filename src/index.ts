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

const withTimeout = (promise: Promise<string>, ms?: number): Promise<string> => {
    if (!ms || ms <= 0) return promise;
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`Operation timed out after ${ms} ms`)), ms);
        promise.then((v) => {
            clearTimeout(t);
            resolve(v);
        }).catch((e) => {
            clearTimeout(t);
            reject(e);
        });
    });
};

const execText = (cmd: string, timeoutMs?: number): Promise<string> => {
    return withTimeout(new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr?.trim() || err.message));
            resolve(stdout || "");
        });
    }), timeoutMs);
};

/**
 * Find all process IDs (PIDs) that are bound to a given port.
 *
 * Windows: netstat -ano | findstr :<port>
 * Unix: lsof -t -i :<port>
 */
const findPidsByPort = (port: number, timeoutMs?: number): Promise<number[]> => {
    return execText(isWindows ? `netstat -ano | findstr :${port}` : `lsof -t -i :${port}`, timeoutMs)
        .then((stdout) => {
            if (!stdout) return [];
            const pids = new Set<number>();
            const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
            if (isWindows) {
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pidNum = Number(parts[parts.length - 1]);
                    if (!Number.isNaN(pidNum)) pids.add(pidNum);
                }
            } else {
                for (const line of lines) {
                    const pidNum = Number(line.trim());
                    if (!Number.isNaN(pidNum)) pids.add(pidNum);
                }
            }
            return [...pids];
        })
        .catch(() => []);
};

/**
 * Find the main process ID (parent) that is bound to a given port.
 * Returns the first/main PID found on the port.
 */
const findPidByPort = async (port: number, timeoutMs?: number): Promise<number> => {
    const pids = await findPidsByPort(port, timeoutMs);
    if (pids.length === 0) {
        throw new Error(`No process found on port ${port}`);
    }
    return pids[0]; // Return the first/main PID
};

/**
 * Kill a process by its PID.
 */
const killByPid = async (pid: number, options: KillOptions = {}): Promise<void> => {
    const { signal = "SIGTERM", dryRun = false, tree = false, timeoutMs } = options;
    if (dryRun) return;
    if (isWindows) {
        const flags = tree ? "/T /F" : "/F";
        await execText(`taskkill /PID ${pid} ${flags}`, timeoutMs);
        return;
    }
    const sig = typeof signal === "number" ? signal : signal.toString();
    if (tree) {
        const descendants = await findDescendantPids(pid, timeoutMs);
        // Kill children first, then the parent
        for (const child of descendants) {
            await execText(`kill -s ${sig} ${child}`, timeoutMs).catch(() => { /* ignore child failures */ });
        }
    }
    await execText(`kill -s ${sig} ${pid}`, timeoutMs);
};

/**
 * Kill multiple processes by their PIDs.
 * Logs failures individually without throwing.
 */
const killByPids = async (pids: number[], options: KillOptions = {}): Promise<void> => {
    await Promise.all(pids.map(async (pid) => {
        try {
            await killByPid(pid, options);
        } catch (e) {
            console.log(`Failed to kill process ${pid}: ${(e as Error).message}`);
        }
    }));
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
    const unique = new Set<number>();
    for (const port of ports) {
        const pids = await findPidsByPort(port, options.timeoutMs);
        for (const pid of pids) unique.add(pid);
    }
    if (unique.size === 0) throw new Error(`No process found on ports: ${ports.join(", ")}`);
    await killByPids([...unique], options);
};

/**
 * Kill all processes bound to ports within [start, end] inclusive.
 */
const killByPortRange = async (start: number, end: number, options: KillOptions = {}): Promise<void> => {
    if (end < start) throw new Error("Invalid port range: end < start");
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
    const { useRegex = false } = opts;
    const matcher = buildMatcher(nameOrPattern, useRegex);
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
    } catch {
        return [];
    }
};

/** Kill processes by name or command pattern */
const killByName = async (nameOrPattern: string, opts: FindByNameOptions & KillOptions = {}): Promise<void> => {
    const { timeoutMs, ...rest } = opts as KillOptions & FindByNameOptions;
    const pids = await findPidsByName(nameOrPattern, { useRegex: (opts as FindByNameOptions).useRegex }, timeoutMs);
    if (pids.length === 0) throw new Error(`No process matched pattern: ${nameOrPattern}`);
    await killByPids(pids, rest as KillOptions);
};

/**
 * Reverse lookup: find all listening/connected ports for a PID.
 */
const findPortsByPid = async (pid: number, timeoutMs?: number): Promise<number[]> => {
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
    } catch {
        return [];
    }
};

// ---------- helpers ----------

const buildMatcher = (pattern: string, useRegex: boolean): ((s: string) => boolean) => {
    if (useRegex) {
        let re: RegExp;
        try {
            re = new RegExp(pattern, "i");
        } catch (e) {
            throw new Error(`Invalid regex pattern: ${(e as Error).message}`);
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
    } catch {
        return [];
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
    if (isWindows) {
        // On Windows, taskkill with /T handles tree killing, but we still support discovery for parity.
        // Use PowerShell to query child processes by ParentProcessId
        try {
            const out = await execText(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${ppid} } | Select-Object ProcessId | ConvertTo-Json -Compress"`, timeoutMs);
            const arr = parseWindowsPsJson(out);
            return arr.map(a => a.ProcessId).filter((n) => Number.isFinite(n));
        } catch {
            return [];
        }
    }
    // Unix
    try {
        const out = await execText(`ps -o pid= --ppid ${ppid}`, timeoutMs);
        return out.split(/\r?\n/).map(s => Number(s.trim())).filter(n => !Number.isNaN(n) && n > 0);
    } catch {
        return [];
    }
};

const findDescendantPids = async (pid: number, timeoutMs?: number): Promise<number[]> => {
    const result: number[] = [];
    const queue: number[] = [pid];
    while (queue.length) {
        const current = queue.shift()!;
        const children = await findChildPidsOnce(current, timeoutMs);
        for (const c of children) {
            result.push(c);
            queue.push(c);
        }
    }
    // Exclude the root pid itself; caller decides order
    return result.filter((p) => p !== pid);
};

export {
    findPidByPort, findPidsByName,
    // core lookups
    findPidsByPort, findPortsByPid, killByName,
    // kill primitives
    killByPid,
    killByPids,
    killByPort, killByPortRange, killByPorts,
    // types
    KillOptions
};

