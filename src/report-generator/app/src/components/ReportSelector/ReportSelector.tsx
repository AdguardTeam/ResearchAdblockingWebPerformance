import React from 'react';

type ReportSelectorProps = {
    reportKeys: string[];
    selectedReport: string | null;
    onSelectReport: (report: string | null) => void;
};

export const ReportSelector: React.FC<ReportSelectorProps> = ({
    reportKeys,
    selectedReport,
    onSelectReport,
}) => {
    return (
        <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="card-title mb-0">Report Selection</h5>
                </div>

                <p className="text-muted small mb-3">
                    Choose which report to visualize
                </p>

                <select
                    id="report-select"
                    className="form-select mb-4"
                    value={selectedReport || ''}
                    onChange={(e) => onSelectReport(e.target.value || null)}
                    aria-label="Select a report"
                >
                    {reportKeys.map((filename) => (
                        <option key={filename} value={filename}>
                            {filename}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};
