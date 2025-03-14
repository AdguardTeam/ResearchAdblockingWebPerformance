import path from 'path';
import fs from 'fs/promises';
import { type MetricsData, type Metrics } from '../src/metrics-collector';
import { TestEnvironment } from '../src/types';
import {
    computeStatistics,
    type TrackersData,
    type CompaniesData,
} from '../src/report-generator/report-generator';

// Add TestMetrics type for test-specific overrides
type TestMetrics = Partial<Metrics> & {
    requests?: Partial<Metrics['requests']>;
    weight?: Partial<Metrics['weight']>;
};

describe('computeStatistics', () => {
    // Helper function to create valid metrics test data
    const createTestMetrics = (overrides: TestMetrics = {}): Metrics => ({
        url: 'https://example.com',
        domain: 'example.com',
        measureTime: new Date().toISOString(),
        testEnv: TestEnvironment.Baseline,
        method: 'puppeteer',
        domContentLoadTimeMs: 1000,
        loadTimeMs: 2000,
        weight: {
            totalBytes: 1000,
            thirdPartyBytes: 500,
        },
        requests: {
            totalRequests: 10,
            blockedRequests: 0,
            notBlockedRequests: 10,
            thirdPartyRequests: 5,
            thirdPartyBlockedRequests: 0,
            thirdPartyNotBlockedRequests: 5,
            hostnames: {},
            etldPlus1s: {},
        },
        ...overrides,
    });

    // Load real trackers and companies data asynchronously for all tests
    let trackersData: TrackersData;
    let companiesData: CompaniesData;

    // Load the data files before running tests
    beforeAll(async () => {
        // Load trackers data
        const trackersJsonPath = path.join(__dirname, '../src/report-generator/trackers.json');
        const trackersJson = await fs.readFile(trackersJsonPath, 'utf-8');
        trackersData = JSON.parse(trackersJson);

        // Load companies data
        const companiesJsonPath = path.join(__dirname, '../src/report-generator/companies.json');
        const companiesJson = await fs.readFile(companiesJsonPath, 'utf-8');
        companiesData = JSON.parse(companiesJson);
    });

    test('should calculate basic statistics correctly', async () => {
        // Create test data with two domains
        const testData: MetricsData = {
            'example.com': [
                createTestMetrics({
                    domContentLoadTimeMs: 1000,
                    loadTimeMs: 2000,
                    weight: {
                        totalBytes: 1500,
                        thirdPartyBytes: 500,
                    },
                    requests: {
                        totalRequests: 20,
                        blockedRequests: 5,
                        notBlockedRequests: 15,
                        thirdPartyRequests: 10,
                        thirdPartyBlockedRequests: 2,
                        thirdPartyNotBlockedRequests: 8,
                        hostnames: {
                            'example.com': 10,
                            'analytics.com': 5,
                            'cdn.example.com': 5,
                        },
                        etldPlus1s: {
                            'example.com': 15,
                            'analytics.com': 5,
                        },
                    },
                }),
            ],
            'test.com': [
                createTestMetrics({
                    domContentLoadTimeMs: 500,
                    loadTimeMs: 1000,
                    weight: {
                        totalBytes: 1000,
                        thirdPartyBytes: 300,
                    },
                    requests: {
                        totalRequests: 10,
                        blockedRequests: 2,
                        notBlockedRequests: 8,
                        thirdPartyRequests: 4,
                        thirdPartyBlockedRequests: 1,
                        thirdPartyNotBlockedRequests: 3,
                        hostnames: {
                            'test.com': 6,
                            'analytics.com': 4,
                        },
                        etldPlus1s: {
                            'test.com': 6,
                            'analytics.com': 4,
                        },
                    },
                }),
            ],
        };

        const result = await computeStatistics(testData, trackersData, companiesData);

        // Check basic statistics
        expect(result.siteCount).toBe(2);
        expect(result.averageDomContentLoadTime).toBe(750); // (1000 + 500) / 2
        expect(result.averageLoadTime).toBe(1500); // (2000 + 1000) / 2
        expect(result.totalBytes).toBe(2500); // 1500 + 1000
        expect(result.averageBytes).toBe(1250); // 2500 / 2
        expect(result.totalRequests).toBe(30); // 20 + 10
        expect(result.averageRequests).toBe(15); // 30 / 2
        expect(result.totalThirdPartyRequests).toBe(14); // 10 + 4
        expect(result.averageThirdPartyRequests).toBe(7); // 14 / 2
        expect(result.totalBlockedRequests).toBe(7); // 5 + 2
        expect(result.averageBlockedRequests).toBe(3.5); // 7 / 2
    });
});
