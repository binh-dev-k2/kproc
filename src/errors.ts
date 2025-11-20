/**
 * Custom error classes for better error handling and categorization
 * @module errors
 */

/**
 * Error thrown when a process is not found or doesn't exist
 * 
 * @example
 * ```typescript
 * try {
 *   await killByPort(3000);
 * } catch (error) {
 *   if (error instanceof ProcessNotFoundError) {
 *     console.log('No process found on port 3000');
 *   }
 * }
 * ```
 */
export class ProcessNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProcessNotFoundError';
        // Maintains proper stack trace for where error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ProcessNotFoundError);
        }
    }
}

/**
 * Error thrown when a system command fails to execute
 * Contains the command that failed for debugging purposes
 * 
 * @example
 * ```typescript
 * try {
 *   await execText('invalid-command');
 * } catch (error) {
 *   if (error instanceof CommandExecutionError) {
 *     console.log(`Command failed: ${error.command}`);
 *   }
 * }
 * ```
 */
export class CommandExecutionError extends Error {
    /** The command that failed to execute */
    public readonly command: string;

    constructor(message: string, command: string) {
        super(message);
        this.name = 'CommandExecutionError';
        this.command = command;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CommandExecutionError);
        }
    }
}

/**
 * Error thrown when an operation exceeds the specified timeout
 * 
 * @example
 * ```typescript
 * try {
 *   await killByPid(1234, { timeoutMs: 1000 });
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     console.log('Operation took too long');
 *   }
 * }
 * ```
 */
export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TimeoutError);
        }
    }
}

/**
 * Error thrown when invalid input parameters are provided
 * 
 * @example
 * ```typescript
 * try {
 *   await killByPort(99999); // Invalid port
 * } catch (error) {
 *   if (error instanceof InvalidInputError) {
 *     console.log('Invalid port number');
 *   }
 * }
 * ```
 */
export class InvalidInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidInputError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, InvalidInputError);
        }
    }
}

