/**
 * Test environments.
 * Moved to a separate file to avoid bundling node built-in modules in the browser bundle.
 */
export const TestEnvironment = {
    /**
     * No test environment
     */
    None: 'none',

    /**
     * Baseline test environment
     */
    Baseline: 'baseline',

    /**
     * DNS blocking test environment
     */
    DNS: 'dns',

    /**
     * Extension blocking test environment
     */
    Extension: 'extension',
} as const;

// Type for TestEnvironment values
export type TestEnvironmentType = typeof TestEnvironment[keyof typeof TestEnvironment];
