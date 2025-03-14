import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';

import { ReportSelector } from '../ReportSelector';
import { ReportMetrics } from '../ReportMetrics';
import { TreemapVisualization } from '../TreemapVisualization';
import { WebsiteComparisonTable } from '../WebsiteComparisonTable';
import { type ReportResult } from '../../../../report-generator';
import { VisualizationType } from '../../types/VisualizationType';
import { ReportResults } from '../../types/reportTypes';

declare global {
    interface Window {
        reportResults: ReportResults | undefined;
    }
}

// Constants
const DEFAULT_MIN_WEBSITES_THRESHOLD = 5; // Default threshold for filtering items used by fewer websites

export const App: React.FC = () => {
    const reportResults = window.reportResults || {};
    const reportKeys = Object.keys(reportResults);

    // Set the first report as default
    const [selectedReport, setSelectedReport] = useState<string | null>(
        reportKeys.length > 0 ? reportKeys[0] : null,
    );

    // State for minimum website threshold
    const [minWebsitesThreshold, setMinWebsitesThreshold] = useState<number>(DEFAULT_MIN_WEBSITES_THRESHOLD);

    // Get report data and cast directly to ReportResult
    const currentReport = selectedReport ? (reportResults[selectedReport] as unknown as ReportResult) : null;

    return (
        <div className="container mt-4">
            <h1 className="mb-4">Reports viewer</h1>
            {reportKeys.length === 0 && <p>No reports available</p>}

            <div className="row mb-4">
                <div className="col-12">
                    <WebsiteComparisonTable />
                </div>
            </div>

            {reportKeys.length > 0 && (
                <div className="row">
                    {reportKeys.map((reportKey) => {
                        const report = reportResults[reportKey] as unknown as ReportResult;
                        return (
                            <div className="col-md" key={reportKey}>
                                <ReportMetrics selectedReport={reportKey} currentReport={report} />
                            </div>
                        );
                    })}
                </div>
            )}

            {reportKeys.length > 0 && (
                <div className="row mt-4 mb-4">
                    <div className="col-md-6 mb-3 mb-md-0">
                        <ReportSelector
                            reportKeys={reportKeys}
                            selectedReport={selectedReport}
                            onSelectReport={setSelectedReport}
                        />
                    </div>
                    <div className="col-md-6">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="card-title mb-0">Visualization Filter</h5>
                                </div>

                                <p className="text-muted small mb-3">
                                    Exclude items used by fewer than or equal to a specific number of websites
                                </p>

                                <div className="mt-4">
                                    <input
                                        type="range"
                                        className="form-range"
                                        id="minWebsitesThreshold"
                                        min="0"
                                        max="20"
                                        step="1"
                                        value={minWebsitesThreshold}
                                        onChange={(e) => setMinWebsitesThreshold(parseInt(e.target.value, 10))}
                                    />
                                    <div className="d-flex justify-content-between text-muted small mt-1">
                                        <span>Show all</span>
                                        <span>Custom: {minWebsitesThreshold}</span>
                                        <span>20 websites</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {currentReport && (
                <>
                    <div className="row">
                        <div className="col-12">
                            <TreemapVisualization
                                currentReport={currentReport}
                                type={VisualizationType.TrackersWebsite}
                                width={1300}
                                height={600}
                                minWebsitesThreshold={minWebsitesThreshold}
                            />
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-12">
                            <TreemapVisualization
                                currentReport={currentReport}
                                type={VisualizationType.CompaniesWebsites}
                                width={1300}
                                height={600}
                                minWebsitesThreshold={minWebsitesThreshold}
                            />
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-12">
                            <TreemapVisualization
                                currentReport={currentReport}
                                type={VisualizationType.EtldPlus1Websites}
                                width={1300}
                                height={600}
                                minWebsitesThreshold={minWebsitesThreshold}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
