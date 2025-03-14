/* eslint-disable no-console */
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Mock any browser APIs that might be missing in the test environment
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

// Suppress console errors during tests
// This is useful for expected errors in tests
const originalConsoleError = console.error;
console.error = (...args) => {
    // Filter out React-specific warnings that we expect in tests
    if (
        typeof args[0] === 'string'
        && (args[0].includes('Warning: ReactDOM.render')
         || args[0].includes('Warning: React.createElement')
         || args[0].includes('Error: Not implemented'))
    ) {
        return;
    }
    originalConsoleError(...args);
};
