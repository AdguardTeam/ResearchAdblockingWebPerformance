import {
    describe,
    it,
    expect,
} from 'bun:test';
import {
    transformReportResultForTreemap,
    getTruncatedText,
} from '../../../../../../src/report-generator/app/src/components/TreemapVisualization/treemap-data-transformer';
import { VisualizationType } from '../../../../../../src/report-generator/app/src/types/VisualizationType';
import { reportResults } from './reportResults';

describe('Treemap Data Transformer', () => {
    describe('transformReportResultForTreemap', () => {
        it('should transform tracker data correctly', () => {
            // Use real data from reportResults
            const realReport = reportResults['baseline_2025-03-04_04-06-02.json'];

            // Act: Transform the data for trackers visualization
            const result = transformReportResultForTreemap(realReport, VisualizationType.TrackersWebsite);

            // Assert: Check the result structure
            expect(result).toHaveProperty('name', 'root');
            expect(result).toHaveProperty('children');
            expect(Array.isArray(result.children)).toBe(true);

            // Should have items sorted by value in descending order
            for (let i = 0; i < result.children.length - 1; i += 1) {
                expect(result.children[i].value).toBeGreaterThanOrEqual(result.children[i + 1].value);
            }
        });

        it('should transform eTLD+1 websites data correctly', () => {
            // Use real data from reportResults
            const realReport = reportResults['baseline_2025-03-04_04-06-02.json'];

            // Act: Transform the data for eTLD+1 websites visualization
            const result = transformReportResultForTreemap(realReport, VisualizationType.EtldPlus1Websites);

            // Assert: Check the result structure
            expect(result).toHaveProperty('name', 'root');
            expect(result).toHaveProperty('children');
            expect(Array.isArray(result.children)).toBe(true);

            // All domains should be included
            const totalDomains = Object.keys(realReport.etldPlus1WebsitesData || {}).length;
            expect(result.children.length).toBe(totalDomains);

            // Items should be sorted by value in descending order
            for (let i = 0; i < result.children.length - 1; i += 1) {
                expect(result.children[i].value).toBeGreaterThanOrEqual(result.children[i + 1].value);
            }
        });

        it('should transform company websites data correctly', () => {
            // Use real data from reportResults
            const realReport = reportResults['baseline_2025-03-04_04-06-02.json'];

            // Act: Transform the data for company websites visualization
            const result = transformReportResultForTreemap(realReport, VisualizationType.CompaniesWebsites);

            // Assert: Check the result structure
            expect(result).toHaveProperty('name', 'root');
            expect(result).toHaveProperty('children');
            expect(Array.isArray(result.children)).toBe(true);

            // All companies should be included
            const totalCompanies = Object.keys(realReport.companiesWebsitesData || {}).length;
            expect(result.children.length).toBe(totalCompanies);

            // Items should be sorted by value in descending order
            for (let i = 0; i < result.children.length - 1; i += 1) {
                expect(result.children[i].value).toBeGreaterThanOrEqual(result.children[i + 1].value);
            }
        });
    });

    describe('getTruncatedText', () => {
        it('should truncate long text to the specified length', () => {
            const text = 'This is a very long text that should be truncated';
            expect(getTruncatedText(text, 15)).toBe('This is a very ...');
        });

        it('should not truncate text shorter than the specified length', () => {
            const text = 'Short text';
            expect(getTruncatedText(text, 15)).toBe(text);
        });

        it('should use the default max length if not specified', () => {
            const text = 'This is exactly twenty chars'; // 25 characters
            expect(getTruncatedText(text)).toBe('This is exactly twen...');
        });
    });
});
