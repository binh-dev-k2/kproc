/**
 * Process name search and metadata lookup functions
 * @module lookup/process
 */

import { getCached } from '../cache';
import { CommandExecutionError, InvalidInputError, ProcessNotFoundError } from '../errors';
import { log } from '../logger';
import type { FindByNameOptions, ProcessInfo } from '../types';
import { buildMatcher, execText, isWindows, parseWindowsPsJson } from '../utils';
import { findPortsByPid } from './port';

/**
 * Find PIDs matching a process name or command line pattern
 */
export const findPidsByName = async (
    nameOrPattern: string,
    opts: FindByNameOptions = {},
    timeoutMs?: number
): Promise<number[]> => {
    if (!nameOrPattern || typeof nameOrPattern !== 'string') {
        throw new InvalidInputError('Name or pattern must be a non-empty string');
    }

    const { useRegex = false } = opts;
    const effectiveTimeout = opts.timeoutMs ?? timeoutMs;
    const matcher = buildMatcher(nameOrPattern, useRegex);

    return await getCached(`name:${nameOrPattern}:${useRegex}`, async () => {
        try {
            if (isWindows) {
                const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"`;
                const out = await execText(psCmd, effectiveTimeout);
                const arr = parseWindowsPsJson(out);

                return arr
                    .filter((p) => matcher(p.Name) || matcher(p.CommandLine || ''))
                    .map((p) => p.ProcessId);
            } else {
                const out = await execText('ps -A -o pid=,comm=,args=', effectiveTimeout);
                const lines = out.split(/\r?\n/).filter(Boolean);
                const pids: number[] = [];

                for (const line of lines) {
                    const match = line.match(/^\s*(\d+)\s+([^\s]+)\s+(.+)$/);
                    if (!match) continue;

                    const pid = Number(match[1]);
                    const comm = match[2];
                    const args = match[3];

                    if (matcher(comm) || matcher(args)) {
                        pids.push(pid);
                    }
                }

                return pids;
            }
        } catch (error: unknown) {
            if (error instanceof CommandExecutionError) {
                throw new ProcessNotFoundError(`Failed to find processes by name: ${error.message}`, { cause: error });
            }
            throw error;
        }
    });
};

/**
 * Get comprehensive metadata about a running process
 */
export const getProcessInfo = async (pid: number, timeoutMs?: number): Promise<ProcessInfo> => {
    if (!Number.isInteger(pid) || pid <= 0) {
        throw new InvalidInputError(`Invalid PID: ${pid}. Must be a positive integer.`);
    }

    log.debug(`Getting info for PID ${pid}`);
    const info: ProcessInfo = { pid };

    try {
        if (isWindows) {
            const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\" | Select-Object ProcessId,Name,CommandLine,ParentProcessId,@{Name='Memory';Expression={$_.WorkingSetSize}} | ConvertTo-Json -Compress"`;
            const out = await execText(psCmd, timeoutMs);
            const data = JSON.parse(out);

            if (data) {
                info.name = data.Name || undefined;
                info.command = data.CommandLine || undefined;
                info.parentPid = data.ParentProcessId || undefined;

                if (typeof data.Memory === 'number') {
                    const memMB = Math.round(data.Memory / 1024 / 1024);
                    info.memoryUsage = `${memMB} MB`;
                }
            }
        } else {
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

        // Fetch associated listening/bound ports
        info.ports = await findPortsByPid(pid, timeoutMs);
        return info;
    } catch (error: unknown) {
        if (error instanceof CommandExecutionError) {
            throw new ProcessNotFoundError(`Process ${pid} not found or inaccessible: ${error.message}`, { cause: error });
        }
        throw error;
    }
};
