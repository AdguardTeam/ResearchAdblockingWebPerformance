/**
 * Sleeps for a given number of milliseconds.
 *
 * @param ms - The number of milliseconds to sleep.
 * @returns A promise that resolves after the given number of milliseconds.
 */
export function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
