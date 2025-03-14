import React, { useState } from 'react';
import { Table } from 'react-bootstrap';
import { type ReportResult } from '../../../../report-generator';
import { formatBytes } from '../../utils/formatters';
import { TestEnvironment } from '../../../../../types';
import { ReportResults } from '../../types/reportTypes';

// Declare the window.reportResults property
declare global {
    interface Window {
        reportResults: ReportResults | undefined;
    }
}

// Type definitions
type WebsiteDataRow = {
    website: string;
    baselineRequests: number;
    baselineBandwidth: number;
    dnsRequests: number;
    dnsRequestsDiff: string;
    dnsBandwidth: number;
    dnsBandwidthDiff: string;
    extensionRequests: number;
    extensionRequestsDiff: string;
    extensionBandwidth: number;
    extensionBandwidthDiff: string;
};

type SortableColumn = keyof WebsiteDataRow;

// Column name constants
const COLUMNS = {
    WEBSITE: 'website' as SortableColumn,
    BASELINE_REQUESTS: 'baselineRequests' as SortableColumn,
    BASELINE_BANDWIDTH: 'baselineBandwidth' as SortableColumn,
    DNS_REQUESTS: 'dnsRequests' as SortableColumn,
    DNS_REQUESTS_DIFF: 'dnsRequestsDiff' as SortableColumn,
    DNS_BANDWIDTH: 'dnsBandwidth' as SortableColumn,
    DNS_BANDWIDTH_DIFF: 'dnsBandwidthDiff' as SortableColumn,
    EXTENSION_REQUESTS: 'extensionRequests' as SortableColumn,
    EXTENSION_REQUESTS_DIFF: 'extensionRequestsDiff' as SortableColumn,
    EXTENSION_BANDWIDTH: 'extensionBandwidth' as SortableColumn,
    EXTENSION_BANDWIDTH_DIFF: 'extensionBandwidthDiff' as SortableColumn,
} as const;

type WebsiteComparisonTableProps = {
    currentReport?: ReportResult;
};

// Helper function to calculate and format percentage difference
function formatDiff(current: number, baseline: number): string {
    if (baseline === 0) return 'N/A';
    const diff = ((current - baseline) / baseline) * 100;
    return `${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`;
}

/**
 * Sort indicator component to show sort direction
 */
const SortIndicator: React.FC<{
    column: SortableColumn;
    sortColumn: SortableColumn | null;
    sortDirection: 'asc' | 'desc';
}> = ({ column, sortColumn, sortDirection }) => {
    if (sortColumn !== column) {
        // Show a subtle unsorted indicator
        return <span className="text-muted"> ⇅</span>;
    }
    return <span className="text-primary">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>;
};

/**
 * Table header component with sort functionality
 */
const TableHeader: React.FC<{
    handleSort: (column: SortableColumn) => void;
    sortColumn: SortableColumn | null;
    sortDirection: 'asc' | 'desc';
}> = ({ handleSort, sortColumn, sortDirection }) => (
    <thead>
        <tr>
            <th onClick={() => handleSort(COLUMNS.WEBSITE)} style={{ cursor: 'pointer' }}>
                Website <SortIndicator column={COLUMNS.WEBSITE} sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th onClick={() => handleSort(COLUMNS.BASELINE_REQUESTS)} style={{ cursor: 'pointer' }}>
                Requests ({TestEnvironment.Baseline})
                <SortIndicator
                    column={COLUMNS.BASELINE_REQUESTS}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                />
            </th>
            <th onClick={() => handleSort(COLUMNS.BASELINE_BANDWIDTH)} style={{ cursor: 'pointer' }}>
                Bandwidth ({TestEnvironment.Baseline})
                <SortIndicator
                    column={COLUMNS.BASELINE_BANDWIDTH}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                />
            </th>
            <th onClick={() => handleSort(COLUMNS.DNS_REQUESTS)} style={{ cursor: 'pointer' }}>
                Requests ({TestEnvironment.DNS})
                <SortIndicator
                    column={COLUMNS.DNS_REQUESTS}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                />
            </th>
            <th onClick={() => handleSort(COLUMNS.DNS_REQUESTS_DIFF)} style={{ cursor: 'pointer' }}>
                Diff requests to {TestEnvironment.Baseline} ({TestEnvironment.DNS})
                <SortIndicator
                    column={COLUMNS.DNS_REQUESTS_DIFF}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                />
            </th>
            <th onClick={() => handleSort(COLUMNS.DNS_BANDWIDTH)} style={{ cursor: 'pointer' }}>
                Bandwidth ({TestEnvironment.DNS})
                <SortIndicator
                    column={COLUMNS.DNS_BANDWIDTH}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                />
            </th>
            <th onClick={() => handleSort(COLUMNS.DNS_BANDWIDTH_DIFF)} style={{ cursor: 'pointer' }}>
                Diff bandwidth to {TestEnvironment.Baseline} ({TestEnvironment.DNS})
                <SortIndicator
                    column={COLUMNS.DNS_BANDWIDTH_DIFF}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                />
            </th>
            <th onClick={() => handleSort(COLUMNS.EXTENSION_REQUESTS)} style={{ cursor: 'pointer' }}>
                Requests ({TestEnvironment.Extension})
                <SortIndicator
                    column={COLUMNS.EXTENSION_REQUESTS}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                />
            </th>
            <th onClick={() => handleSort(COLUMNS.EXTENSION_REQUESTS_DIFF)} style={{ cursor: 'pointer' }}>
                Diff requests to {TestEnvironment.Baseline} ({TestEnvironment.Extension})
                <SortIndicator
                    column={COLUMNS.EXTENSION_REQUESTS_DIFF}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                />
            </th>
            <th onClick={() => handleSort(COLUMNS.EXTENSION_BANDWIDTH)} style={{ cursor: 'pointer' }}>
                Bandwidth ({TestEnvironment.Extension})
                <SortIndicator
                    column={COLUMNS.EXTENSION_BANDWIDTH}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                />
            </th>
            <th onClick={() => handleSort(COLUMNS.EXTENSION_BANDWIDTH_DIFF)} style={{ cursor: 'pointer' }}>
                Diff bandwidth to {TestEnvironment.Baseline} ({TestEnvironment.Extension})
                <SortIndicator
                    column={COLUMNS.EXTENSION_BANDWIDTH_DIFF}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                />
            </th>
        </tr>
    </thead>
);

/**
 * Table row component to display website data
 */
const TableRow: React.FC<{ data: WebsiteDataRow }> = ({ data }) => (
    <tr>
        <td>{data.website}</td>
        <td>{data.baselineRequests}</td>
        <td>{formatBytes(data.baselineBandwidth)}</td>
        <td>{data.dnsRequests}</td>
        <td>{data.dnsRequestsDiff}</td>
        <td>{formatBytes(data.dnsBandwidth)}</td>
        <td>{data.dnsBandwidthDiff}</td>
        <td>{data.extensionRequests}</td>
        <td>{data.extensionRequestsDiff}</td>
        <td>{formatBytes(data.extensionBandwidth)}</td>
        <td>{data.extensionBandwidthDiff}</td>
    </tr>
);

/**
 * Extract websites from all available reports
 */
function extractWebsites(reportResults: ReportResults): string[] {
    const baselineReport = Object.values(reportResults).find(
        (report) => report.type === TestEnvironment.Baseline,
    );
    const dnsReport = Object.values(reportResults).find(
        (report) => report.type === TestEnvironment.DNS,
    );
    const extensionReport = Object.values(reportResults).find(
        (report) => report.type === TestEnvironment.Extension,
    );

    // Extract all websites from all reports
    const allWebsites = new Set<string>();

    // Add websites from each report (if available)
    [baselineReport, dnsReport, extensionReport].forEach((report) => {
        if (report) {
            Object.keys(report.domainsData).forEach((website) => allWebsites.add(website));
        }
    });

    return Array.from(allWebsites);
}

/**
 * Prepare table data by combining information from all reports
 */
function prepareTableData(reportResults: ReportResults, websites: string[]): WebsiteDataRow[] {
    // Find reports by type
    const baselineReport = Object.values(reportResults).find(
        (report) => report.type === TestEnvironment.Baseline,
    );
    const dnsReport = Object.values(reportResults).find(
        (report) => report.type === TestEnvironment.DNS,
    );
    const extensionReport = Object.values(reportResults).find(
        (report) => report.type === TestEnvironment.Extension,
    );

    return websites.map((website) => {
        // Get website data from each report
        const baselineData = baselineReport?.domainsData[website]?.[0] || null;
        const dnsData = dnsReport?.domainsData[website]?.[0] || null;
        const extensionData = extensionReport?.domainsData[website]?.[0] || null;

        // Extract metrics or use defaults
        const baselineRequests = baselineData?.requests?.totalRequests || 0;
        const baselineBandwidth = baselineData?.weight?.totalBytes || 0;

        const dnsRequests = dnsData?.requests?.totalRequests || 0;
        const dnsBandwidth = dnsData?.weight?.totalBytes || 0;

        const extensionRequests = extensionData?.requests?.totalRequests || 0;
        const extensionBandwidth = extensionData?.weight?.totalBytes || 0;

        return {
            website,
            baselineRequests,
            baselineBandwidth,
            dnsRequests,
            dnsRequestsDiff: formatDiff(dnsRequests, baselineRequests),
            dnsBandwidth,
            dnsBandwidthDiff: formatDiff(dnsBandwidth, baselineBandwidth),
            extensionRequests,
            extensionRequestsDiff: formatDiff(extensionRequests, baselineRequests),
            extensionBandwidth,
            extensionBandwidthDiff: formatDiff(extensionBandwidth, baselineBandwidth),
        };
    });
}

/**
 * Sort table data based on column and direction
 */
function sortTableData(
    tableData: WebsiteDataRow[],
    sortColumn: SortableColumn | null,
    sortDirection: 'asc' | 'desc',
): WebsiteDataRow[] {
    if (!sortColumn) return tableData;

    return [...tableData].sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        // Handle string sorting (website column)
        if (sortColumn === COLUMNS.WEBSITE) {
            return sortDirection === 'asc'
                ? String(aValue).localeCompare(String(bValue))
                : String(bValue).localeCompare(String(aValue));
        }

        // Handle percentage difference columns
        if (sortColumn.includes('Diff')) {
            // Extract numeric values from percentage strings
            const aMatch = String(aValue).match(/([-+]?\d+\.\d+)/);
            const bMatch = String(bValue).match(/([-+]?\d+\.\d+)/);

            const aNum = aMatch ? parseFloat(aMatch[0]) : 0;
            const bNum = bMatch ? parseFloat(bMatch[0]) : 0;

            return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // Handle numeric columns (requests and bandwidth)
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
    });
}

/**
 * Main WebsiteComparisonTable component
 */
export const WebsiteComparisonTable: React.FC<WebsiteComparisonTableProps> = () => {
    // Add state for sorting
    const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Handle column header click for sorting
    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            // Toggle direction if same column is clicked again
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new column and default to ascending
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    // Get all report data from the window object
    const reportResults = (window.reportResults || {}) as ReportResults;

    // Extract all websites from reports
    const websites = extractWebsites(reportResults);

    // Prepare table data by combining information from all reports
    const tableData = prepareTableData(reportResults, websites);

    // Sort the table data based on current sort settings
    const sortedTableData = sortTableData(tableData, sortColumn, sortDirection);

    return (
        <div className="mb-4">
            <h2>Website Comparison</h2>
            <p>
                Comparing websites by the number of requests and consumed bandwidth in different configuration
                (with and without an ad blocker). The test tool tries to load the website several times and counts
                average values.
            </p>
            <ul>
                <li><b>Requests:</b> average number of requests.</li>
                <li><b>Bandwidth:</b> average bandwith consumed when opening a website.</li>
                <li><b>baseline:</b> loading the website without any ad blocker.</li>
                <li><b>dns:</b> loading the website with AdGuard DNS.</li>
                <li><b>extension:</b> loading the website with AdGuard Ad Blocker.</li>
            </ul>
            <div className="table-responsive">
                <Table striped bordered hover>
                    <TableHeader
                        handleSort={handleSort}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                    />
                    <tbody>
                        {sortedTableData.map((row, index) => (
                            <TableRow key={index} data={row} />
                        ))}
                    </tbody>
                </Table>
            </div>
        </div>
    );
};
