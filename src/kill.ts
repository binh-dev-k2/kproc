/**
 * Process termination module (Re-export entrypoint)
 * @module kill
 */

export {
    killByName,
} from './kill/name';

export {
    killByPid,
    killByPids,
} from './kill/pid';

export {
    killByPort,
    killByPortRange,
    killByPorts,
} from './kill/port';
