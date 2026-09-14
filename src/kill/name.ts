/**
 * Process name-based termination functions
 * @module kill/name
 */

import { ProcessNotFoundError } from '../errors';
import { log } from '../logger';
import { findPidsByName } from '../lookup/process';
import type { FindByNameOptions, KillOptions, KillResult } from '../types';
import { killByPids } from './pid';

/**
 * Terminate all processes matching an executable name or command pattern
 */
export const killByName = async (
    nameOrPattern: string,
    opts: FindByNameOptions & KillOptions = {}
): Promise<KillResult[]> => {
    const { timeoutMs, useRegex, ...killOptions } = opts;

    log.debug(`Searching for processes matching pattern: ${nameOrPattern}`);
    const pids = await findPidsByName(nameOrPattern, { useRegex, timeoutMs });

    if (pids.length === 0) {
        throw new ProcessNotFoundError(`No processes matched pattern: "${nameOrPattern}"`);
    }

    log.debug(`Found ${pids.length} processes matching "${nameOrPattern}"`);
    return await killByPids(pids, killOptions);
};
