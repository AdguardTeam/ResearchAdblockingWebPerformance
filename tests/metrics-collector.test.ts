import { MetricsCollector, Metrics } from '../src/metrics-collector';
import { TestEnvironment } from '../src/types';

describe('MetricsCollector', () => {
    describe('computeAverageMetrics', () => {
        const collector = new MetricsCollector();
        const baseMetric: Metrics = {
            url: 'http://example.com',
            domain: 'example.com',
            domContentLoadTimeMs: 100,
            loadTimeMs: 200,
            weight: {
                totalBytes: 1000,
                thirdPartyBytes: 500,
            },
            requests: {
                totalRequests: 10,
                blockedRequests: 2,
                notBlockedRequests: 8,
                thirdPartyRequests: 5,
                thirdPartyBlockedRequests: 1,
                thirdPartyNotBlockedRequests: 4,
                hostnames: {},
                etldPlus1s: {},
            },
            measureTime: '2024-01-01T00:00:00Z',
            testEnv: TestEnvironment.Extension,
            method: 'puppeteer',
        };

        it('should calculate average counts for hostnames across multiple runs', () => {
            const metricsArray: Metrics[] = [
                {
                    ...baseMetric,
                    requests: {
                        ...baseMetric.requests,
                        hostnames: { 'google.com': 1, 'example.org': 1 },
                        etldPlus1s: { 'google.com': 1, 'example.org': 1 },
                    },
                },
                {
                    ...baseMetric,
                    requests: {
                        ...baseMetric.requests,
                        hostnames: { 'google.com': 1, 'example.org': 1 },
                        etldPlus1s: { 'google.com': 1, 'example.org': 1 },
                    },
                },
                {
                    ...baseMetric,
                    requests: {
                        ...baseMetric.requests,
                        hostnames: { 'new-site.com': 1, 'google.com': 1 },
                        etldPlus1s: { 'new-site.com': 1, 'google.com': 1 },
                    },
                },
            ];

            const result = collector.computeAverageMetrics(metricsArray);

            // Verify average counts are calculated correctly
            expect(result.requests.hostnames).toEqual({
                'google.com': 1, // Present in all runs
                'example.org': 0.67, // Present in 2/3 runs
                'new-site.com': 0.33, // Present in 1/3 runs
            });

            expect(result.requests.etldPlus1s).toEqual({
                'google.com': 1,
                'example.org': 0.67,
                'new-site.com': 0.33,
            });
        });

        it('should calculate correct averages when hostnames are present in some runs but absent in others', () => {
            // Test with mixed presence/absence to verify averaging behavior
            const metricsArray: Metrics[] = [
                {
                    ...baseMetric,
                    requests: {
                        ...baseMetric.requests,
                        hostnames: { 'tracker.com': 3 }, // Initial presence
                        etldPlus1s: { 'tracker.com': 3 }, // Add matching etldPlus1s
                    },
                },
                {
                    ...baseMetric,
                    requests: {
                        ...baseMetric.requests,
                        hostnames: {}, // Intentionally empty for testing absence
                        etldPlus1s: {}, // Add matching empty etldPlus1s
                    },
                },
            ];

            const result = collector.computeAverageMetrics(metricsArray);

            expect(result.requests.hostnames).toEqual({
                'tracker.com': 1.5,
            });

            expect(result.requests.etldPlus1s).toEqual({
                'tracker.com': 1.5,
            });
        });

        it('should correctly average loadTimeMs across multiple runs', () => {
            // Test with sequential load times to verify averaging
            const metricsArray: Metrics[] = [
                { ...baseMetric, loadTimeMs: 100 }, // Base case
                { ...baseMetric, loadTimeMs: 200 }, // Middle value
                { ...baseMetric, loadTimeMs: 300 }, // Upper bound
            ];

            const result = collector.computeAverageMetrics(metricsArray);
            expect(result.loadTimeMs).toBe(200); // Average of sequential values
        });

        it('should handle empty input gracefully', () => {
            expect(() => collector.computeAverageMetrics([])).toThrow();
        });

        it('should exclude hostnames that only have zero values', () => {
            const metricsArray: Metrics[] = [
                {
                    ...baseMetric,
                    requests: {
                        ...baseMetric.requests,
                        hostnames: { 'absent.com': 0 },
                        etldPlus1s: { 'absent.com': 0 },
                    },
                },
            ];

            const result = collector.computeAverageMetrics(metricsArray);
            expect(result.requests.hostnames).toEqual({});
            expect(result.requests.etldPlus1s).toEqual({});
        });

        it('should correctly average totalRequests, blockedRequests, and thirdPartyRequests', () => {
            const metricsArray: Metrics[] = [
                {
                    ...baseMetric,
                    requests: {
                        ...baseMetric.requests,
                        totalRequests: 10,
                        blockedRequests: 5,
                        thirdPartyRequests: 8,
                    },
                },
                {
                    ...baseMetric,
                    requests: {
                        ...baseMetric.requests,
                        totalRequests: 20,
                        blockedRequests: 15,
                        thirdPartyRequests: 12,
                    },
                },
            ];

            const result = collector.computeAverageMetrics(metricsArray);
            expect(result.requests.totalRequests).toBe(15); // (10+20)/2
            expect(result.requests.blockedRequests).toBe(10); // (5+15)/2
            expect(result.requests.thirdPartyRequests).toBe(10); // (8+12)/2
        });

        it('should handle undefined optional values', () => {
            const metricsArray: Metrics[] = [
                {
                    ...baseMetric,
                    domContentLoadTimeMs: 100,
                    loadTimeMs: undefined,
                },
                {
                    ...baseMetric,
                    domContentLoadTimeMs: undefined,
                    loadTimeMs: 200,
                },
            ];

            const result = collector.computeAverageMetrics(metricsArray);
            expect(result.domContentLoadTimeMs).toBe(100); // Only one valid value
            expect(result.loadTimeMs).toBe(200); // Only one valid value
        });

        it('should handle all undefined optional values', () => {
            const metricsArray: Metrics[] = [
                {
                    ...baseMetric,
                    domContentLoadTimeMs: undefined,
                    loadTimeMs: undefined,
                },
                {
                    ...baseMetric,
                    domContentLoadTimeMs: undefined,
                    loadTimeMs: undefined,
                },
            ];

            const result = collector.computeAverageMetrics(metricsArray);
            expect(result.domContentLoadTimeMs).toBe(0);
            expect(result.loadTimeMs).toBe(0);
        });

        it('should correctly average hostname counts when values vary across runs', () => {
            // Test averaging with varying counts across runs
            const metricsArray: Metrics[] = [
                {
                    ...baseMetric,
                    requests: {
                        ...baseMetric.requests,
                        hostnames: {
                            'tracker1.com': 3,
                            'tracker2.com': 1,
                        },
                    },
                },
                {
                    ...baseMetric,
                    requests: {
                        ...baseMetric.requests,
                        hostnames: {
                            'tracker1.com': 1,
                            'tracker3.com': 2,
                        },
                    },
                },
            ];

            const result = collector.computeAverageMetrics(metricsArray);
            expect(result.requests.hostnames).toEqual({
                'tracker1.com': 2, // Average of varying counts
                'tracker2.com': 0.5, // Average including absence
                'tracker3.com': 1, // Average with single presence
            });
        });
    });
});
