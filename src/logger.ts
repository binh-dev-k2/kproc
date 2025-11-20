/**
 * Debug logging system with configurable levels
 * @module logger
 */

/**
 * Global debug flag
 * Can be toggled using setDebug() function
 */
let debugEnabled = false;

/**
 * Logger interface with different log levels
 * All logs are prefixed with [kproc:level] for easy filtering
 * 
 * @example
 * ```typescript
 * import { log } from './logger';
 * 
 * log.debug('Detailed debug info');  // Only shown if debug enabled
 * log.info('General information');   // Always shown
 * log.warn('Warning message');       // Always shown
 * log.error('Error occurred');       // Always shown
 * ```
 */
export const log = {
    /**
     * Debug level logging - only shown when debug is enabled
     * Use for detailed troubleshooting information
     * 
     * @param args - Any values to log
     */
    debug: (...args: any[]): void => {
        if (debugEnabled) {
            console.log('[kproc:debug]', ...args);
        }
    },

    /**
     * Info level logging - always shown
     * Use for general informational messages
     * 
     * @param args - Any values to log
     */
    info: (...args: any[]): void => {
        console.log('[kproc:info]', ...args);
    },

    /**
     * Warning level logging - always shown
     * Use for non-critical issues that should be noted
     * 
     * @param args - Any values to log
     */
    warn: (...args: any[]): void => {
        console.warn('[kproc:warn]', ...args);
    },

    /**
     * Error level logging - always shown
     * Use for critical errors and failures
     * 
     * @param args - Any values to log
     */
    error: (...args: any[]): void => {
        console.error('[kproc:error]', ...args);
    },
};

/**
 * Enable or disable debug logging globally
 * When enabled, all log.debug() calls will output to console
 * 
 * @param enabled - True to enable debug logs, false to disable
 * 
 * @example
 * ```typescript
 * import { setDebug } from 'kproc';
 * 
 * // Enable debug logging for development
 * setDebug(true);
 * 
 * // Disable for production
 * setDebug(false);
 * ```
 */
export const setDebug = (enabled: boolean): void => {
    debugEnabled = enabled;
    log.info(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
};

/**
 * Check if debug logging is currently enabled
 * 
 * @returns True if debug logging is enabled
 */
export const isDebugEnabled = (): boolean => debugEnabled;

