import { type ReportResult } from '../../../../report-generator';
import { formatBytes, formatTime } from '../../utils/formatters';

type ReportMetricsProps = {
    selectedReport: string;
    currentReport: ReportResult;
};

export const ReportMetrics = ({ selectedReport, currentReport }: ReportMetricsProps) => (
    <div>
        <div className="metrics">
            <div>
                <p><strong>{selectedReport}</strong></p>
            </div>
            <p>Number of sites: <strong>{currentReport.siteCount}</strong></p>
            <p>Average load time:</p>
            <div className="ps-3">
                <ul className="list-group mb-3">
                    <li className="list-group-item">
            DOMContentLoaded: <strong>{formatTime(currentReport.averageDomContentLoadTime)}</strong>
                    </li>
                    <li className="list-group-item">
            Load: <strong>{formatTime(currentReport.averageLoadTime)}</strong>
                    </li>
                </ul>
            </div>
            <p>Total load time: <strong>{formatTime(currentReport.totalLoadTime)}</strong></p>
            <p>Total loaded bytes: <strong>{formatBytes(currentReport.totalBytes)}</strong></p>
            <p>Average loaded bytes: <strong>{formatBytes(currentReport.averageBytes)}</strong></p>
            <p>Total number of requests: <strong>{currentReport.totalRequests}</strong></p>
            <p>Average number of requests: <strong>{currentReport.averageRequests.toFixed(2)}</strong></p>
            <p>Total number of third-party requests: <strong>{currentReport.totalThirdPartyRequests}</strong></p>
            <p>
                Average number of third-party requests:{' '}
                <strong>{currentReport.averageThirdPartyRequests.toFixed(2)}</strong>
            </p>
            <p>Total number of blocked requests: <strong>{currentReport.totalBlockedRequests}</strong></p>
            <p>
                Average number of blocked requests: <strong>{currentReport.averageBlockedRequests.toFixed(2)}</strong>
            </p>
            <p>Total number of unique hostnames connected: <strong>{currentReport.totalHostnames}</strong></p>
            <p>
                Average number of unique hostnames connected:{' '}
                <strong>{currentReport.averageHostnames.toFixed(2)}</strong>
            </p>
            <p>Total number of unique eTLD+1s connected: <strong>{currentReport.totalEtldPlus1s}</strong></p>
            <p>
                Average number of unique eTLD+1s connected:{' '}
                <strong>{currentReport.averageEtldPlus1s.toFixed(2)}</strong>
            </p>
        </div>
    </div>
);
