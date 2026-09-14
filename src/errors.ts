/**
 * Custom error hierarchy for kproc
 * @module errors
 */

/**
 * Base error class for all kproc errors
 */
export class KProcError extends Error {
    /** Machine-readable error code */
    public readonly code: string;

    constructor(message: string, code: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'KProcError';
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, new.target);
        }
    }
}

/**
 * Error thrown when a process or port target cannot be found
 */
export class ProcessNotFoundError extends KProcError {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, 'PROCESS_NOT_FOUND', options);
        this.name = 'ProcessNotFoundError';
        Object.setPrototypeOf(this, ProcessNotFoundError.prototype);
    }
}

/**
 * Error thrown when a system command fails execution
 */
export class CommandExecutionError extends KProcError {
    /** The command that failed to execute */
    public readonly command: string;

    constructor(message: string, command: string, options?: { cause?: unknown }) {
        super(message, 'COMMAND_EXECUTION_FAILED', options);
        this.name = 'CommandExecutionError';
        this.command = command;
        Object.setPrototypeOf(this, CommandExecutionError.prototype);
    }
}

/**
 * Error thrown when an operation exceeds its configured timeout
 */
export class TimeoutError extends KProcError {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, 'OPERATION_TIMEOUT', options);
        this.name = 'TimeoutError';
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}

/**
 * Error thrown when invalid or hazardous input parameters are provided
 */
export class InvalidInputError extends KProcError {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, 'INVALID_INPUT', options);
        this.name = 'InvalidInputError';
        Object.setPrototypeOf(this, InvalidInputError.prototype);
    }
}
