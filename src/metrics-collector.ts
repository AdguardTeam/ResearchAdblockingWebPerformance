import fs from 'fs/promises';
import fsExtra from 'fs-extra';
import * as path from 'node:path';

import { getUrlByDomain } from './utils/url';
import { getErrorMessage } from './utils/error';
import { PuppeteerResults, PuppeteerRunner } from './puppeteer-runner';
import { logger } from './utils/logger';
import { TestEnvironmentType } from './types';

interface ProcessOptionsBase {
    testEnvironment: TestEnvironmentType;
    proxyServer?: string;
    harPath?: string;
    withExtension?: boolean;
    outputFile: string;
}

type ProcessDomainOptions = ProcessOptionsBase;

type ProcessDomainsOptions = ProcessOptionsBase & {
    domainsFile: string;
    limit?: number;
};

export interface Metrics {
    url: string;
    domain: string;
    measureTime: string;
    testEnv: TestEnvironmentType;
    method: string;
    domContentLoadTimeMs: number | undefined;
    loadTimeMs: number | undefined;
    weight: {
        totalBytes: number;
        thirdPartyBytes?: number;
    };
    requests: {
        totalRequests: number;
        blockedRequests: number;
        notBlockedRequests: number;
        thirdPartyRequests: number;
        thirdPartyBlockedRequests: number;
        thirdPartyNotBlockedRequests: number;
        hostnames: Record<string, number>;
        etldPlus1s: Record<string, number>;
    };
}

export type MetricsData = {
    [domain: string]: Metrics[];
};

/**
 * Collects and processes metrics from web page loads using Puppeteer
 */
export class MetricsCollector {
    private puppeteerRunner: PuppeteerRunner;

    constructor(verbose = false) {
        this.puppeteerRunner = new PuppeteerRunner(verbose);
    }

    /**
     * Stores metrics data for a domain in a JSON file
     * @param metrics - Collected metrics for a single run
     * @param domain - Domain being tested
     * @param outputFile - Base name for the output file
     */
    async storeMetrics(metrics: Metrics, domain: string, outputFile: string) {
        const metricsDir = path.resolve(__dirname, '../dist/metrics');
        const metricsFilename = path.join(metricsDir, `${outputFile}.json`);
        await fsExtra.ensureFile(metricsFilename);
        const existingMetrics = (await fs.readFile(metricsFilename, 'utf-8').catch(() => '{}')) || '{}';
        const existingMetricsJson: MetricsData = JSON.parse(existingMetrics);
        if (existingMetricsJson[domain]) {
            existingMetricsJson[domain].push(metrics);
        } else {
            existingMetricsJson[domain] = [metrics];
        }
        await fs.writeFile(metricsFilename, JSON.stringify(existingMetricsJson, null, 2));
    }

    /**
     * Extracts standardized metrics from Puppeteer results
     * @param puppeteerResults - Raw results from Puppeteer run
     * @param url - URL that was tested
     * @param domain - Domain being tested
     * @param testEnv - Test environment configuration
     * @returns Standardized metrics object
     */
    extractMetricsFromPuppeteer(
        puppeteerResults: PuppeteerResults,
        url: string,
        domain: string,
        testEnv: TestEnvironmentType,
    ): Metrics {
        return {
            url,
            domain,
            domContentLoadTimeMs: puppeteerResults.domContentLoadTimeMs,
            loadTimeMs: puppeteerResults.loadTimeMs,
            weight: {
                totalBytes: puppeteerResults.weight.totalBytes,
                thirdPartyBytes: puppeteerResults.weight.thirdPartyBytes,
            },
            requests: puppeteerResults.requests,
            measureTime: new Date().toISOString(),
            testEnv,
            method: 'puppeteer',
        };
    }

    /**
     * Calculates average for numeric metrics, handling undefined values
     * @param metrics - Array of metrics objects
     * @param selector - Function to select the value to average
     * @returns Average value, or 0 if no valid values exist
     */
    private calculateAverage(metrics: Metrics[], selector: (m: Metrics) => number | undefined): number {
        const validMetrics = metrics.filter((m) => selector(m) !== undefined);
        if (validMetrics.length === 0) {
            return 0;
        }
        const sum = validMetrics.reduce((acc, metric) => acc + (selector(metric) || 0), 0);
        return Number((sum / validMetrics.length).toFixed(2));
    }

    /**
     * Computes average hostnames across multiple test runs
     * @param metricsArray - Array of metrics from multiple runs
     * @returns Record of hostnames with their average counts
     */
    private computeHostnameAverages(metricsArray: Metrics[]): Record<string, number> {
        const allHostnames = this.collectUniqueKeys(metricsArray, (m) => m.requests.hostnames);
        return this.computeAveragesForKeys(metricsArray, allHostnames, (m, key) => m.requests.hostnames[key]);
    }

    /**
     * Computes average etldPlus1s across multiple test runs
     * @param metricsArray - Array of metrics from multiple runs
     * @returns Record of etldPlus1s with their average counts
     */
    private computeEtldPlusOneAverages(metricsArray: Metrics[]): Record<string, number> {
        const allEtlds = this.collectUniqueKeys(metricsArray, (m) => m.requests.etldPlus1s);
        return this.computeAveragesForKeys(metricsArray, allEtlds, (m, key) => m.requests.etldPlus1s[key]);
    }

    /**
     * Collects unique keys from an array of items
     * @param array - Array of items to analyze
     * @param selector - Function to extract keys from each item
     * @returns Set of unique keys
     */
    private collectUniqueKeys<T>(array: T[], selector: (item: T) => Record<string, number>): Set<string> {
        const keys = new Set<string>();
        array.forEach((item) => {
            Object.keys(selector(item)).forEach((key) => keys.add(key));
        });
        return keys;
    }

    private computeAveragesForKeys(
        metricsArray: Metrics[],
        keys: Set<string>,
        valueSelector: (metric: Metrics, key: string) => number | undefined,
    ): Record<string, number> {
        const averages: Record<string, number> = {};
        keys.forEach((key) => {
            const sum = metricsArray.reduce((acc, metric) => acc + (valueSelector(metric, key) || 0), 0);
            const average = Number((sum / metricsArray.length).toFixed(2));
            if (average > 0) {
                averages[key] = average;
            }
        });
        return averages;
    }

    /**
     * Computes average metrics across multiple test runs
     * @param metricsArray - Array of metrics from multiple runs
     * @returns Single metrics object with averaged values
     * @throws Error if metricsArray is empty
     */
    computeAverageMetrics(metricsArray: Metrics[]): Metrics {
        if (metricsArray.length === 0) {
            throw new Error('Cannot compute average of empty metrics array');
        }

        const hostnamesAvg = this.computeHostnameAverages(metricsArray);
        const etldPlus1sAvg = this.computeEtldPlusOneAverages(metricsArray);

        return {
            ...metricsArray[0],
            domContentLoadTimeMs: this.calculateAverage(metricsArray, (m) => m.domContentLoadTimeMs),
            loadTimeMs: this.calculateAverage(metricsArray, (m) => m.loadTimeMs),
            weight: {
                totalBytes: this.calculateAverage(metricsArray, (m) => m.weight.totalBytes),
                thirdPartyBytes: this.calculateAverage(metricsArray, (m) => m.weight.thirdPartyBytes),
            },
            requests: {
                ...metricsArray[0].requests,
                totalRequests: this.calculateAverage(metricsArray, (m) => m.requests.totalRequests),
                blockedRequests: this.calculateAverage(metricsArray, (m) => m.requests.blockedRequests),
                notBlockedRequests: this.calculateAverage(metricsArray, (m) => m.requests.notBlockedRequests),
                thirdPartyRequests: this.calculateAverage(metricsArray, (m) => m.requests.thirdPartyRequests),
                thirdPartyBlockedRequests: this.calculateAverage(
                    metricsArray,
                    (m) => m.requests.thirdPartyBlockedRequests,
                ),
                thirdPartyNotBlockedRequests: this.calculateAverage(
                    metricsArray,
                    (m) => m.requests.thirdPartyNotBlockedRequests,
                ),
                hostnames: hostnamesAvg,
                etldPlus1s: etldPlus1sAvg,
            },
        };
    }

    /**
     * Processes a single domain using Puppeteer with multiple runs
     * @param domain - Domain to test
     * @param opts - Processing options
     */
    async processDomainPuppeteer(domain: string, opts: ProcessDomainOptions) {
        const {
            testEnvironment,
            harPath,
            outputFile,
        } = opts;
        try {
            const url = await getUrlByDomain(domain);
            if (!url) {
                logger.error(`Could not get URL for ${domain}`);
                return;
            }

            // Launch the browser once
            await this.puppeteerRunner.warmUp(url);

            // Array to hold results from each run
            const puppeteerResultsArray = [];

            // Perform multiple runs for statistical significance
            const RUN_TIMES = 3;
            for (let i = 0; i < RUN_TIMES; i += 1) {
                logger.info(`Starting Puppeteer run ${i + 1} of ${RUN_TIMES}`);
                const puppeteerResults = await this.puppeteerRunner.run({
                    environment: testEnvironment,
                    url,
                    domain,
                    harPath,
                });
                if (!puppeteerResults) {
                    throw new Error(`No results received on iteration ${i + 1}`);
                }
                puppeteerResultsArray.push(puppeteerResults);
            }

            // Extract metrics from each run
            const metricsArray = puppeteerResultsArray.map((puppeteerResults) => {
                return this.extractMetricsFromPuppeteer(
                    puppeteerResults,
                    url,
                    domain,
                    testEnvironment,
                );
            });

            // Compute average metrics
            const averagedMetrics = this.computeAverageMetrics(metricsArray);

            logger.info(JSON.stringify(averagedMetrics, null, 2));

            await this.storeMetrics(averagedMetrics, domain, outputFile);
        } catch (e) {
            logger.error(`Error processing ${domain}: ${getErrorMessage(e)}`);
        }
    }

    async processSingleDomainPuppeteer(domain: string, opts: ProcessDomainOptions) {
        const { proxyServer, withExtension } = opts;

        await this.puppeteerRunner.launchBrowser(proxyServer, withExtension);

        await this.processDomainPuppeteer(domain, opts);

        await this.puppeteerRunner.closeBrowser();
    }

    async processDomainsPuppeteer(options: ProcessDomainsOptions) {
        const {
            domainsFile,
            testEnvironment,
            limit,
            proxyServer,
            harPath,
            withExtension,
            outputFile,
        } = options;

        await this.puppeteerRunner.launchBrowser(proxyServer, withExtension);

        // Read and split domains within the logic module
        const domainsString = await fs.readFile(path.resolve(domainsFile), 'utf-8');
        const domains = domainsString.split('\n').filter((domain) => domain.trim() !== '');

        const domainsToProcess = limit ? domains.slice(0, limit) : domains;

        for (const domain of domainsToProcess) {
            await this.processDomainPuppeteer(domain, {
                testEnvironment,
                proxyServer,
                harPath,
                withExtension,
                outputFile,
            });
        }

        await this.puppeteerRunner.closeBrowser();
    }
}
