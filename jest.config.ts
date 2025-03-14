/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    // Use projects to set different environments for different test types
    projects: [
        {
            // Node environment for .ts tests
            displayName: 'node',
            testMatch: ['<rootDir>/tests/**/*.test.ts'],
            testEnvironment: 'node',
            transform: {
                '^.+\\.tsx?$': ['ts-jest', {}],
            },
        },
        {
            // jsdom environment for .tsx React component tests
            displayName: 'jsdom',
            testMatch: ['<rootDir>/tests/**/*.test.tsx'],
            testEnvironment: 'jsdom',
            transform: {
                '^.+\\.tsx?$': ['ts-jest', {}],
            },
            setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
        },
    ],

    // Default transform configuration
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {}],
    },
};
