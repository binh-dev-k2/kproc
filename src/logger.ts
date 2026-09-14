/**
 * Logging system with configurable levels and custom sinks
 * @module logger
 */

let debugEnabled = false;

/**
 * Log sink function signature
 */
export type LogSink = (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: unknown[]) => void;

let customSink: LogSink | null = null;

/**
 * Default logger interface
 */
export const log = {
    /**
     * Debug level logging - only shown when debug is enabled
     */
    debug: (message: string, ...args: unknown[]): void => {
        if (!debugEnabled) return;
        if (customSink) {
            customSink('debug', message, ...args);
        } else {
            console.log(`[kproc:debug] ${message}`, ...args);
        }
    },

    /**
     * Info level logging
     */
    info: (message: string, ...args: unknown[]): void => {
        if (customSink) {
            customSink('info', message, ...args);
        } else {
            console.log(`[kproc:info] ${message}`, ...args);
        }
    },

    /**
     * Warning level logging
     */
    warn: (message: string, ...args: unknown[]): void => {
        if (customSink) {
            customSink('warn', message, ...args);
        } else {
            console.warn(`[kproc:warn] ${message}`, ...args);
        }
    },

    /**
     * Error level logging
     */
    error: (message: string, ...args: unknown[]): void => {
        if (customSink) {
            customSink('error', message, ...args);
        } else {
            console.error(`[kproc:error] ${message}`, ...args);
        }
    },
};

/**
 * Enable or disable debug logging globally
 */
export const setDebug = (enabled: boolean): void => {
    debugEnabled = enabled;
    log.info(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
};

/**
 * Check if debug logging is enabled
 */
export const isDebugEnabled = (): boolean => debugEnabled;

/**
 * Set a custom logger sink for testing or enterprise logging integration
 */
export const setLogSink = (sink: LogSink | null): void => {
    customSink = sink;
};
