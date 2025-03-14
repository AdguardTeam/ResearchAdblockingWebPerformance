/**
 * Utility functions for formatting data
 */

/**
 * Formats a byte value into a human-readable string with appropriate units
 * @param bytes - The number of bytes to format
 * @param decimals - The number of decimal places to include (default: 2)
 * @returns A formatted string with appropriate unit (Bytes, KB, MB, GB, TB)
 */
export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

// Time conversion constants
const SECOND_MS = 1000;
const MINUTE_MS = SECOND_MS * 60;
const HOUR_MS = MINUTE_MS * 60;

/**
 * Formats a time value in milliseconds into a human-readable string with appropriate units
 * @param ms - The number of milliseconds to format
 * @param decimals - The number of decimal places to include (default: 2)
 * @returns A formatted string with appropriate unit (ms, s, min, h)
 */
export function formatTime(ms: number, decimals = 2): string {
    if (ms === 0) return '0 ms';

    const dm = decimals < 0 ? 0 : decimals;

    // Convert to appropriate unit
    if (ms < SECOND_MS) {
        // Less than a second, keep as milliseconds
        return `${ms.toFixed(dm)} ms`;
    }

    if (ms < MINUTE_MS) {
        // Less than a minute, convert to seconds
        return `${(ms / SECOND_MS).toFixed(dm)} s`;
    }

    if (ms < HOUR_MS) {
        // Less than an hour, convert to minutes
        return `${(ms / MINUTE_MS).toFixed(dm)} min`;
    }

    // Convert to hours
    return `${(ms / HOUR_MS).toFixed(dm)} h`;
}
