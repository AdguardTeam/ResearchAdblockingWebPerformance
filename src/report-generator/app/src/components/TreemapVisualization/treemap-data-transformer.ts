import { type ReportResult } from '../../../../report-generator';
import { VisualizationType } from '../../types/VisualizationType';

export type HostnameData = {
    name: string;
    value: number;
    originalValue?: number;
};

export type HierarchyData = {
    name: string;
    children: HostnameData[];
};

export interface TreemapReadyData {
    name: string;
    children: HostnameData[];
}

/**
 * Get the appropriate data source based on visualization type
 */
export function getRawDataForVisualizationType(report: ReportResult, type: VisualizationType): Record<string, number> {
    switch (type) {
        case VisualizationType.TrackersWebsite:
            return report.trackersWebsitesData || {};
        case VisualizationType.EtldPlus1Websites:
            return report.etldPlus1WebsitesData || {};
        case VisualizationType.CompaniesWebsites:
            return report.companiesWebsitesData || {};
        default:
            throw new Error(`Unsupported visualization type: ${type}`);
    }
}

/**
 * Create hierarchical structure for D3
 */
function createHierarchicalStructure(items: HostnameData[]): TreemapReadyData {
    return {
        name: 'root',
        children: items,
    };
}

/**
 * Transform raw report result into a format ready for treemap visualization
 * @param reportResult The report data
 * @param visualizationType The type of visualization
 * @param minWebsitesThreshold Threshold for filtering - exclude items with websites less than or equal to this value
 */
export function transformReportResultForTreemap(
    reportResult: ReportResult,
    visualizationType: VisualizationType,
    minWebsitesThreshold: number = 0,
): TreemapReadyData {
    // Extract raw data based on visualization type
    const rawData = getRawDataForVisualizationType(reportResult, visualizationType);

    // For all visualization types, no grouping needed
    // Filter items based on the threshold
    const sortedItems = Object.entries(rawData)
        .map(([name, value]) => ({ name, value }))
        .filter((item) => item.value > minWebsitesThreshold) // Apply the threshold filter - exclude values <= threshold
        .sort((a, b) => b.value - a.value);

    return createHierarchicalStructure(sortedItems);
}

/**
 * Get the title and subheader for the visualization based on type
 * @param type The visualization type
 * @returns An object containing the title and subheader for the visualization
 */
export function getVisualizationTitleData(type: VisualizationType): { title: string; subheader: string } {
    switch (type) {
        case VisualizationType.TrackersWebsite:
            return {
                title: 'Number of websites connecting to a Tracker',
                subheader: 'Tracker is a service that can be related to tracking or advertising that the websites may be using.',
            };
        case VisualizationType.CompaniesWebsites:
            return {
                title: 'Number of websites connecting to a Company',
                subheader: 'Company is a company that the trackers belong to. A single company can provide multiple different services.',
            };
        case VisualizationType.EtldPlus1Websites:
            return {
                title: 'Number of websites connecting to a Domain',
                subheader: 'We count "registered domains" (or eTLD+1). Tracking services and companies can use multiple different domains.',
            };
        default:
            throw new Error(`Unsupported visualization type: ${type}`);
    }
}

/**
 * Truncate text for display purposes
 */
export function getTruncatedText(text: string, maxLength: number = 20): string {
    // Truncate long text
    if (text.length > maxLength) {
        return `${text.substring(0, maxLength)}...`;
    }

    // Keep short text as is
    return text;
}
