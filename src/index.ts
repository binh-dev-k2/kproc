import { exec } from "child_process";

const isWindows = process.platform === "win32";

/**
 * Find all process IDs (PIDs) that are bound to a given port.
 * 
 * Windows: uses `netstat -ano | findstr :<port>`
 * Unix-based (Linux/macOS): uses `lsof -t -i :<port>`
 */
const findPidsByPort = (port: number): Promise<number[]> => {
    return new Promise((resolve) => {
        const cmd = isWindows
            ? `netstat -ano | findstr :${port}`
            : `lsof -t -i :${port}`;

        exec(cmd, (err, stdout) => {
            if (err || !stdout) return resolve([]);

            const pids = new Set<number>();

            if (isWindows) {
                const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pidNum = Number(parts[parts.length - 1]);
                    if (!Number.isNaN(pidNum)) pids.add(pidNum);
                }
            } else {
                const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
                for (const line of lines) {
                    const pidNum = Number(line.trim());
                    if (!Number.isNaN(pidNum)) pids.add(pidNum);
                }
            }

            resolve([...pids]);
        });
    });
};

/**
 * Kill a process by its PID.
 * 
 * Windows: uses `taskkill /PID <pid> /T /F`
 * Unix-based (Linux/macOS): uses `kill -9 <pid>`
 */
const killByPid = (pid: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const cmd = isWindows
            ? `taskkill /PID ${pid} /T /F`
            : `kill -9 ${pid}`;

        exec(cmd, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};

/**
 * Kill multiple processes by their PIDs.
 * 
 * Logs any errors that occur while killing processes.
 */
const killByPids = async (pids: number[]): Promise<void> => {
    await Promise.all(pids.map((pid) => killByPid(pid).catch(() => {
        console.log(`Failed to kill process ${pid}`);
    })));
};

/**
 * Kill all processes bound to a given port.
 * 
 * Throws an error if no processes are found on the port.
 */
const killByPort = async (port: number): Promise<void> => {
    const pids = await findPidsByPort(port);
    if (pids.length === 0) {
        throw new Error(`No process found on port ${port}`);
    }
    await Promise.all(pids.map((pid) => killByPid(pid).catch(() => { })));
};

export { findPidsByPort, killByPid, killByPids, killByPort };

