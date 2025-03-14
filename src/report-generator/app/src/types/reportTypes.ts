import type { ReportResult } from '../../../report-generator';
import { TestEnvironmentType } from '../../../../types';

// Define a type for domain data
export type DomainData = {
    url?: string;
    domain?: string;
    domContentLoadTimeMs?: number;
    loadTimeMs?: number;
    weight?: {
        totalBytes: number;
        thirdPartyBytes?: number;
    };
    requests?: {
        totalRequests: number;
        blockedRequests?: number;
        notBlockedRequests?: number;
        thirdPartyRequests?: number;
        thirdPartyBlockedRequests?: number;
        thirdPartyNotBlockedRequests?: number;
        hostnames?: Record<string, number>;
        etldPlus1s?: Record<string, number>;
    };
    measureTime?: string;
    testEnv?: string;
    method?: string;
};

// Frontend-specific ReportData extends backend ReportResult
export type ReportData = Omit<ReportResult, 'domainsData'> & {
    type: TestEnvironmentType;
    domainsData: Record<string, DomainData[]>;
    // Optional fields that might be present from the backend
    siteCount?: number;
    averageDomContentLoadTime?: number;
    averageLoadTime?: number;
    totalLoadTime?: number;
    averageBytes?: number;
    totalBytes?: number;
    averageRequests?: number;
    totalRequests?: number;
    averageThirdPartyRequests?: number;
    totalThirdPartyRequests?: number;
    averageBlockedRequests?: number;
    totalBlockedRequests?: number;
    averageHostnames?: number;
    totalHostnames?: number;
    averageEtldPlus1s?: number;
    totalEtldPlus1s?: number;
    hostnamesData?: Record<string, number>;
    etldPlus1Data?: Record<string, number>;
    trackersData?: Record<string, number>;
    companiesData?: Record<string, number>;
    etldPlus1WebsitesData?: Record<string, number>;
    companiesWebsitesData?: Record<string, number>;
};

// Define a type for report results
export type ReportResults = Record<string, ReportData>;
