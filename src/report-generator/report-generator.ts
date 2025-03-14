import path from 'path';
import { readFile } from 'fs/promises';
import fsExtra from 'fs-extra';
import { getDomain } from 'tldts';
import { exec } from 'child_process';
import { promisify } from 'util';
import { format } from 'date-fns';

import { logger } from '../utils/logger';
import { buildApp } from './build-app';
import { type MetricsData, type Metrics } from '../metrics-collector';
import { TestEnvironment, TestEnvironmentType } from '../types';

/* eslint-disable no-param-reassign */

const execAsync = promisify(exec);

// Minimum number of requests to consider a domain in the report,
// we added this threshold to avoid websites which are not loaded or displaying captchas
const MIN_REQUESTS_THRESHOLD = 20;

export interface ReportResult {
    siteCount: number;
    averageDomContentLoadTime: number;
    averageLoadTime: number;
    totalLoadTime: number;
    averageBytes: number;
    totalBytes: number;
    averageRequests: number;
    totalRequests: number;
    averageThirdPartyRequests: number;
    totalThirdPartyRequests: number;
    averageBlockedRequests: number;
    totalBlockedRequests: number;
    averageHostnames: number;
    totalHostnames: number;
    averageEtldPlus1s: number;
    totalEtldPlus1s: number;
    domainsData: MetricsData;
    etldPlus1WebsitesData: {
        [etldPlus1: string]: number;
    };
    companiesWebsitesData: {
        [company: string]: number;
    };
    trackersWebsitesData: {
        [tracker: string]: number;
    };
    type: TestEnvironmentType;
}

export interface TrackerInfo {
    name: string;
    categoryId: number;
    url: string | null;
    companyId: string | null;
    source?: string;
}

export interface TrackersData {
    timeUpdated: string;
    categories: {
        [key: string]: string;
    };
    trackers: {
        [key: string]: TrackerInfo;
    };
    trackerDomains: {
        [key: string]: string;
    };
}

// Interface for companies data
export interface CompanyInfo {
    name: string;
    websiteUrl: string | null;
    description: string | null;
    source?: string;
}

export interface CompaniesData {
    timeUpdated: string;
    companies: {
        [key: string]: CompanyInfo;
    };
}

/**
 * Initialize the aggregated data object with zero values
 */
function initializeAggregatedData() {
    return {
        totalDomContentLoadTime: 0,
        totalLoadTime: 0,
        totalBytes: 0,
        totalRequests: 0,
        totalThirdPartyRequests: 0,
        totalBlockedRequests: 0,
        totalHostnames: 0,
        totalEtldPlus1s: 0,
    };
}

/**
 * Initialize data collection structures
 */
function initializeCollectedData() {
    return {
        hostnamesData: {} as { [hostname: string]: number },
        etldPlus1Data: {} as { [etldPlus1: string]: number },
        trackersData: {} as { [tracker: string]: number },
        companiesData: {} as { [company: string]: number },
        etldPlus1WebsitesData: {} as { [etldPlus1: string]: Set<string> },
        companiesWebsitesData: {} as { [company: string]: Set<string> },
        trackersWebsitesData: {} as { [tracker: string]: Set<string> },
    };
}

/**
 * Aggregate basic metrics from an entry
 */
function aggregateBasicMetrics(
    entry: Metrics,
    aggregatedData: ReturnType<typeof initializeAggregatedData>,
) {
    aggregatedData.totalDomContentLoadTime += entry.domContentLoadTimeMs || 0;
    aggregatedData.totalLoadTime += entry.loadTimeMs || 0;
    aggregatedData.totalBytes += entry.weight.totalBytes || 0;
    aggregatedData.totalRequests += entry.requests.totalRequests || 0;
    aggregatedData.totalThirdPartyRequests += entry.requests.thirdPartyRequests || 0;
    aggregatedData.totalBlockedRequests += entry.requests.blockedRequests || 0;
}

/**
 * Process trackers data
 */
function processTrackers(
    hostnames: { [hostname: string]: number },
    trackersInfo: TrackersData,
    trackersData: { [tracker: string]: number },
    trackersWebsitesData: { [tracker: string]: Set<string> },
    domain: string,
) {
    Object.entries(hostnames).forEach(([hostname, count]) => {
        // Try to find tracker by domain
        const trackerId = trackersInfo.trackerDomains[hostname];
        let trackerName = hostname;

        if (trackerId && trackersInfo.trackers[trackerId]) {
            trackerName = trackersInfo.trackers[trackerId].name;
        } else {
            // Try to match by eTLD+1
            const etldPlus1 = getDomain(hostname);
            if (etldPlus1) {
                const etldTrackerId = trackersInfo.trackerDomains[etldPlus1];
                if (etldTrackerId && trackersInfo.trackers[etldTrackerId]) {
                    trackerName = trackersInfo.trackers[etldTrackerId].name;
                } else {
                    // Skip empty tracker names
                    return;
                }
            }
        }

        // Only add trackers with valid names
        if (trackerName) {
            trackersData[trackerName] = (trackersData[trackerName] || 0) + (count as number);

            // Track websites per tracker
            if (!trackersWebsitesData[trackerName]) {
                trackersWebsitesData[trackerName] = new Set();
            }
            trackersWebsitesData[trackerName].add(domain);
        }
    });
}

/**
 * Process companies data
 */
function processCompanies(
    domain: string,
    hostnames: { [hostname: string]: number },
    trackersInfo: TrackersData,
    companiesInfo: CompaniesData,
    companiesData: { [company: string]: number },
    companiesWebsitesData: { [company: string]: Set<string> },
) {
    Object.entries(hostnames).forEach(([hostname, count]) => {
        let companyName = getDomain(hostname) || hostname;
        let companyId = null;

        // First try direct hostname match
        const trackerId = trackersInfo.trackerDomains[hostname];
        if (trackerId && trackersInfo.trackers[trackerId]) {
            companyId = trackersInfo.trackers[trackerId].companyId;
            if (companyId && companiesInfo.companies[companyId]) {
                companyName = companiesInfo.companies[companyId].name;
            }
        } else {
            // Try to match by eTLD+1
            const etldPlus1 = getDomain(hostname);
            if (etldPlus1) {
                const etldTrackerId = trackersInfo.trackerDomains[etldPlus1];
                if (etldTrackerId && trackersInfo.trackers[etldTrackerId]) {
                    companyId = trackersInfo.trackers[etldTrackerId].companyId;
                    if (companyId && companiesInfo.companies[companyId]) {
                        companyName = companiesInfo.companies[companyId].name;
                    }
                } else {
                    // Try to match directly by etldPlus1 as company ID
                    const domainWithoutTLD = etldPlus1.split('.')[0];
                    if (companiesInfo.companies[domainWithoutTLD]) {
                        companyName = companiesInfo.companies[domainWithoutTLD].name;
                    } else {
                        // Skip empty company names
                        return;
                    }
                }
            }
        }

        // Only add companies with valid names
        if (companyName) {
            companiesData[companyName] = (companiesData[companyName] || 0) + (count as number);

            // Track which websites make requests to each company
            if (!companiesWebsitesData[companyName]) {
                companiesWebsitesData[companyName] = new Set();
            }
            companiesWebsitesData[companyName].add(domain);
        }
    });
}

/**
 * Process hostname data
 */
function processHostnameData(
    domain: string,
    entry: Metrics,
    trackersInfo: TrackersData,
    companiesInfo: CompaniesData,
    aggregatedData: ReturnType<typeof initializeAggregatedData>,
    collectedData: ReturnType<typeof initializeCollectedData>,
) {
    // Add non-null assertion since we check for existence before calling this function
    const hostnameCount = Object.keys(entry.requests.hostnames!).length;
    aggregatedData.totalHostnames += hostnameCount;

    // Aggregate hostname counts
    Object.entries(entry.requests.hostnames!).forEach(([hostname, count]) => {
        if (!collectedData.hostnamesData[hostname]) {
            collectedData.hostnamesData[hostname] = count as number;
        } else {
            collectedData.hostnamesData[hostname] += count as number;
        }
    });

    // Process trackers
    processTrackers(
        entry.requests.hostnames!,
        trackersInfo,
        collectedData.trackersData,
        collectedData.trackersWebsitesData,
        domain,
    );

    // Process companies
    processCompanies(
        domain,
        entry.requests.hostnames!,
        trackersInfo,
        companiesInfo,
        collectedData.companiesData,
        collectedData.companiesWebsitesData,
    );

    // Associate hostnames with eTLD+1s for website tracking
    Object.keys(entry.requests.hostnames!).forEach((hostname) => {
        const etldPlus1 = getDomain(hostname);
        if (etldPlus1) {
            if (!collectedData.etldPlus1WebsitesData[etldPlus1]) {
                collectedData.etldPlus1WebsitesData[etldPlus1] = new Set();
            }
            collectedData.etldPlus1WebsitesData[etldPlus1].add(domain);
        }
    });
}

/**
 * Process eTLD+1 data
 */
function processEtldPlus1Data(
    entry: Metrics,
    aggregatedData: ReturnType<typeof initializeAggregatedData>,
    collectedData: ReturnType<typeof initializeCollectedData>,
) {
    const etldPlus1Count = Object.keys(entry.requests.etldPlus1s!).length;
    aggregatedData.totalEtldPlus1s += etldPlus1Count;

    Object.entries(entry.requests.etldPlus1s!).forEach(([etldPlus1, count]) => {
        if (!collectedData.etldPlus1Data[etldPlus1]) {
            collectedData.etldPlus1Data[etldPlus1] = count as number;
        } else {
            collectedData.etldPlus1Data[etldPlus1] += count as number;
        }
    });
}

/**
 * Process all domains and their entries
 */
function processAllDomains(
    domains: string[],
    data: MetricsData,
    trackersInfo: TrackersData,
    companiesInfo: CompaniesData,
    aggregatedData: ReturnType<typeof initializeAggregatedData>,
    collectedData: ReturnType<typeof initializeCollectedData>,
) {
    domains.forEach((domain) => {
        const entries = data[domain];
        entries.forEach((entry) => {
            // Update basic metrics
            aggregateBasicMetrics(entry, aggregatedData);

            // Process hostname data
            if (entry.requests.hostnames) {
                processHostnameData(
                    domain,
                    entry,
                    trackersInfo,
                    companiesInfo,
                    aggregatedData,
                    collectedData,
                );
            }

            // Process etldPlus1 data
            if (entry.requests.etldPlus1s) {
                processEtldPlus1Data(
                    entry,
                    aggregatedData,
                    collectedData,
                );
            }
        });
    });
}

/**
 * Convert Sets to count maps
 */
function convertSetsToCountMaps(collectedData: ReturnType<typeof initializeCollectedData>) {
    const etldPlus1WebsitesCounts = Object.fromEntries(
        Object.entries(collectedData.etldPlus1WebsitesData).map(([etldPlus1, websites]) => [
            etldPlus1,
            websites.size,
        ]),
    );

    const companiesWebsitesCounts = Object.fromEntries(
        Object.entries(collectedData.companiesWebsitesData).map(([company, websites]) => [
            company,
            websites.size,
        ]),
    );

    const trackersWebsitesCounts = Object.fromEntries(
        Object.entries(collectedData.trackersWebsitesData).map(([tracker, websites]) => [
            tracker,
            websites.size,
        ]),
    );

    return {
        etldPlus1WebsitesCounts,
        companiesWebsitesCounts,
        trackersWebsitesCounts,
    };
}

/**
 * Calculate average metrics
 */
function calculateAverages(
    aggregatedData: ReturnType<typeof initializeAggregatedData>,
    siteCount: number,
) {
    return {
        averageDomContentLoadTime: aggregatedData.totalDomContentLoadTime / siteCount,
        averageLoadTime: aggregatedData.totalLoadTime / siteCount,
        averageBytes: aggregatedData.totalBytes / siteCount,
        averageRequests: aggregatedData.totalRequests / siteCount,
        averageThirdPartyRequests: aggregatedData.totalThirdPartyRequests / siteCount,
        averageBlockedRequests: aggregatedData.totalBlockedRequests / siteCount,
        averageHostnames: aggregatedData.totalHostnames / siteCount,
        averageEtldPlus1s: aggregatedData.totalEtldPlus1s / siteCount,
    };
}

/**
 * Assemble the final result object
 */
function assembleResult(
    siteCount: number,
    aggregatedData: ReturnType<typeof initializeAggregatedData>,
    averages: ReturnType<typeof calculateAverages>,
    data: MetricsData,
    etldPlus1WebsitesCounts: { [etldPlus1: string]: number },
    companiesWebsitesCounts: { [company: string]: number },
    trackersWebsitesCounts: { [tracker: string]: number },
): ReportResult {
    return {
        siteCount,
        averageDomContentLoadTime: averages.averageDomContentLoadTime,
        averageLoadTime: averages.averageLoadTime,
        totalLoadTime: aggregatedData.totalLoadTime,
        averageBytes: averages.averageBytes,
        totalBytes: aggregatedData.totalBytes,
        averageRequests: averages.averageRequests,
        totalRequests: Number(aggregatedData.totalRequests.toFixed(0)),
        averageThirdPartyRequests: averages.averageThirdPartyRequests,
        totalThirdPartyRequests: Number(aggregatedData.totalThirdPartyRequests.toFixed(0)),
        averageBlockedRequests: averages.averageBlockedRequests,
        totalBlockedRequests: Number(aggregatedData.totalBlockedRequests.toFixed(0)),
        averageHostnames: averages.averageHostnames,
        totalHostnames: aggregatedData.totalHostnames,
        averageEtldPlus1s: averages.averageEtldPlus1s,
        totalEtldPlus1s: aggregatedData.totalEtldPlus1s,
        domainsData: data,
        etldPlus1WebsitesData: etldPlus1WebsitesCounts,
        companiesWebsitesData: companiesWebsitesCounts,
        trackersWebsitesData: trackersWebsitesCounts,
        type: TestEnvironment.Baseline, // Default type
    };
}

/**
 * Load metrics data from input files
 * @param inputFiles - Array of input files
 * @returns Array of metrics data
 */
async function loadMetricsData(inputFiles: string[]): Promise<MetricsData[]> {
    const allData: MetricsData[] = [];

    for (const file of inputFiles) {
        const filePath = path.resolve(process.cwd(), file);
        try {
            const data = await readFile(filePath, 'utf-8');
            const jsonData: MetricsData = JSON.parse(data);
            allData.push(jsonData);
        } catch (error) {
            logger.error(`Error reading file ${filePath}: ${error}`);
            process.exit(1);
        }
    }
    return allData;
}

/**
 * Find common domains across all input files.
 * We a choosing the common domains which are in the all input files,
 * to be sure that we are comparing the same websites.
 * @param allData - Array of metrics data
 * @returns Set of common domains
 */
function findCommonDomains(allData: MetricsData[]): Set<string> {
    const commonDomains = allData.reduce((acc, data) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const validDomains = Object.entries(data).filter(([_, entries]) => {
            const totalRequests = entries.reduce((sum, entry) => sum + (entry.requests.totalRequests || 0), 0);
            const avgRequests = totalRequests / entries.length;
            return avgRequests >= MIN_REQUESTS_THRESHOLD;
        }).map(([domain]) => domain);

        const domains = new Set(validDomains);
        if (acc === null) return domains;
        return new Set([...acc].filter((domain) => domains.has(domain)));
    }, null as Set<string> | null);

    if (!commonDomains) {
        logger.error('No common domains found across input files.');
        process.exit(1);
    }

    return commonDomains;
}

/**
 * Determines the test environment type from metrics data
 * @param data - Metrics data for a specific domain
 * @returns The test environment type
 */
function determineTestEnvironment(data: MetricsData): TestEnvironmentType {
    // Default to baseline if no data is available
    if (!data || Object.keys(data).length === 0) {
        return TestEnvironment.Baseline;
    }

    // Get the first domain and its first entry
    const firstDomain = Object.keys(data)[0];
    const firstEntry = data[firstDomain]?.[0];

    if (!firstEntry?.testEnv) {
        return TestEnvironment.Baseline;
    }

    // Convert string to TestEnvironment enum
    switch (firstEntry.testEnv) {
        case 'baseline':
            return TestEnvironment.Baseline;
        case 'dns':
            return TestEnvironment.DNS;
        case 'extension':
            return TestEnvironment.Extension;
        default:
            return TestEnvironment.None;
    }
}

/**
 * Filter metrics data to include only common domains
 * @param data - Original metrics data
 * @param commonDomains - Set of common domains to include
 * @returns Filtered metrics data
 */
function filterDataByCommonDomains(data: MetricsData, commonDomains: Set<string>): MetricsData {
    const filteredData: MetricsData = {};

    Object.keys(data).forEach((domain) => {
        if (commonDomains.has(domain)) {
            filteredData[domain] = data[domain];
        }
    });

    return filteredData;
}

/**
 * Compute statistics from metrics data
 * This function processes raw metrics data and generates aggregated statistics,
 * including hostname and company data for visualizations.
 * @param data - The metrics data to process
 * @param trackersInfo - Tracker information loaded from trackers.json
 * @param companiesInfo - Company information loaded from companies.json
 */
export function computeStatistics(
    data: MetricsData,
    trackersInfo: TrackersData,
    companiesInfo: CompaniesData,
): ReportResult {
    const domains = Object.keys(data);
    const siteCount = domains.length;

    // Initialize data structures for collection
    const aggregatedData = initializeAggregatedData();
    const collectedData = initializeCollectedData();

    // Process each domain and its entries
    processAllDomains(domains, data, trackersInfo, companiesInfo, aggregatedData, collectedData);

    // Convert Sets to counts
    const {
        etldPlus1WebsitesCounts,
        companiesWebsitesCounts,
        trackersWebsitesCounts,
    } = convertSetsToCountMaps(collectedData);

    // Calculate averages
    const averages = calculateAverages(aggregatedData, siteCount);

    // Assemble and return the result
    return assembleResult(
        siteCount,
        aggregatedData,
        averages,
        data,
        etldPlus1WebsitesCounts,
        companiesWebsitesCounts,
        trackersWebsitesCounts,
    );
}

/**
 * Generate report results
 * @param allData - Array of metrics data
 * @param commonDomains - Set of common domains
 * @param inputFiles - Array of input files
 * @returns Map of report results
 */
async function generateReportResults(
    allData: MetricsData[],
    commonDomains: Set<string>,
    inputFiles: string[],
): Promise<Record<string, ReportResult>> {
    const reportResultsMap: Record<string, ReportResult> = {};

    // Load trackers data once
    const trackersJsonPath = path.join(__dirname, 'trackers.json');
    const trackersJson = await readFile(trackersJsonPath, 'utf-8');
    const trackersInfo: TrackersData = JSON.parse(trackersJson);

    // Load companies data once
    const companiesJsonPath = path.join(__dirname, 'companies.json');
    const companiesJson = await readFile(companiesJsonPath, 'utf-8');
    const companiesInfo: CompaniesData = JSON.parse(companiesJson);

    for (let i = 0; i < inputFiles.length; i += 1) {
        const fileName = path.basename(inputFiles[i]);

        // Filter data to include only common domains
        const filteredData = filterDataByCommonDomains(allData[i], commonDomains);

        // Determine the test environment type
        const environmentType = determineTestEnvironment(filteredData);

        // Generate statistics
        const result = await computeStatistics(filteredData, trackersInfo, companiesInfo);

        // Set the correct environment type
        result.type = environmentType;

        // Add to results map
        reportResultsMap[fileName] = result;
    }

    return reportResultsMap;
}

/**
 * Generate report
 * @param inputFiles - Array of input files
 * @param outputDir - Output directory
 */
export async function generateReport(inputFiles: string[], outputDir: string) {
    logger.info('Generating report...');

    const allData = await loadMetricsData(inputFiles);
    const commonDomains = findCommonDomains(allData);
    const reportResultsMap = await generateReportResults(allData, commonDomains, inputFiles);

    await fsExtra.ensureDir(outputDir);

    // Create a timestamp for the report filename using date-fns
    const now = new Date();
    const timestamp = format(now, 'yyyy-MM-dd_HH-mm-ss');
    const reportFilename = `report_${timestamp}.html`;

    // Pass the report filename to buildApp
    await buildApp(outputDir, reportResultsMap, reportFilename);

    // Open the report in default browser using the timestamped filename
    const indexPath = path.join(outputDir, reportFilename);
    try {
        await execAsync(`open ${indexPath}`);
        logger.info(`Opened report ${reportFilename} in default browser`);
    } catch (error) {
        logger.error(`Failed to open report: ${error}`);
    }
}
