import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { type ReportResult } from '../../../../report-generator';
import { VisualizationType } from '../../types/VisualizationType';
import {
    transformReportResultForTreemap,
    getRawDataForVisualizationType,
    getVisualizationTitleData,
    getTruncatedText,
    type HierarchyData,
    type TreemapReadyData,
} from './treemap-data-transformer';
import { Legend } from '../Legend';

// Constants for visualization settings
const DIMENSIONS = {
    DEFAULT_WIDTH: 800,
    DEFAULT_HEIGHT: 600,
    PADDING_INNER: 2,
    PADDING_OUTER: 2,
    TEXT_PADDING_LEFT: 5,
    TEXT_PADDING_TOP: 15,
    TEXT_MAX_LENGTH: 20,
    FONT_SIZE: 12,
} as const;

const TOOLTIP_STYLES = {
    BACKGROUND: '#fff',
    PADDING: '8px',
    BORDER: '1px solid #ccc',
    BORDER_RADIUS: '4px',
} as const;

const TRANSITION = {
    FADE_IN: 200,
    FADE_OUT: 500,
} as const;

// Helper functions
const getContrastColor = (backgroundColor: string) => {
    const color = d3.color(backgroundColor)!;
    const rgb = color.rgb(); // Convert to RGB color space
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#000' : '#fff';
};

const asRectNode = (d: d3.HierarchyNode<HierarchyData>) => d as d3.HierarchyRectangularNode<HierarchyData>;

// Add interface for node data
interface NodeDatum {
    transform: string;
    width: number;
    height: number;
    fill: string;
    name: string;
    value: number;
    textColor: string;
    truncatedText: string;
}

type TreemapVisualizationProps = {
    currentReport: ReportResult;
    type: VisualizationType;
    width?: number;
    height?: number;
    minWebsitesThreshold?: number;
};

/**
 * Pure function to render the treemap visualization
 * This function takes care of the D3 rendering without modifying input data
 */
const renderTreemap = (
    container: HTMLDivElement,
    data: TreemapReadyData,
    width: number,
    height: number,
    reportTotalWebsites: number,
) => {
    // Create hierarchical data structure from flat data
    const root = d3.hierarchy<HierarchyData>(data)
        .sum((d) => {
            if ('value' in d) {
                return d.value as number;
            }
            return 0;
        });

    // Calculate the total value for percentage calculation - use the real website count from the report
    const totalWebsites = reportTotalWebsites || 0;

    // Ensure nodes are sorted by value (largest to smallest)
    root.sort((a, b) => (b.value || 0) - (a.value || 0));

    // Configure treemap layout algorithm
    const treemap = d3.treemap<HierarchyData>()
        .size([width, height])
        .paddingInner(DIMENSIONS.PADDING_INNER)
        .paddingOuter(DIMENSIONS.PADDING_OUTER);

    // Sort children by value in descending order
    if (root.children) {
        root.children.sort((a, b) => (b.value || 0) - (a.value || 0));
    }

    // Apply treemap layout after sorting
    treemap(root);

    // Create color scale based on node values
    const maxVal = d3.max(root.leaves(), (d) => d.value) || 0;
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, maxVal]);

    // Pre-calculate node data for better performance
    const nodeData = root.leaves().map((d) => {
        const rect = asRectNode(d);
        return {
            transform: `translate(${rect.x0},${rect.y0})`,
            width: rect.x1 - rect.x0,
            height: rect.y1 - rect.y0,
            fill: colorScale(d.value || 0),
            name: d.data.name,
            value: d.value,
            textColor: getContrastColor(colorScale(d.value || 0)),
            // Use the utility function from transformer module
            truncatedText: getTruncatedText(d.data.name, DIMENSIONS.TEXT_MAX_LENGTH),
        };
    });

    // Set up SVG container with hardware acceleration
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('transform', 'translateZ(0)');

    const contentGroup = svg.append('g');

    // Create tooltip for interactive data display
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background-color', TOOLTIP_STYLES.BACKGROUND)
        .style('padding', TOOLTIP_STYLES.PADDING)
        .style('border', TOOLTIP_STYLES.BORDER)
        .style('border-radius', TOOLTIP_STYLES.BORDER_RADIUS)
        .style('pointer-events', 'none');

    // Create node groups and append visual elements
    const nodes = contentGroup
        .selectAll('g')
        .data(nodeData)
        .join('g')
        .attr('transform', (d) => d.transform);

    // Add rectangles representing data values
    nodes.append('rect')
        .attr('width', (d) => d.width)
        .attr('height', (d) => d.height)
        .attr('fill', (d) => d.fill)
        .attr('stroke', '#fff');

    // Add text labels
    nodes.append('text')
        .attr('x', DIMENSIONS.TEXT_PADDING_LEFT)
        .attr('y', DIMENSIONS.TEXT_PADDING_TOP)
        .text((d) => d.truncatedText)
        .attr('font-size', `${DIMENSIONS.FONT_SIZE}px`)
        .attr('fill', (d) => d.textColor)
        .attr('pointer-events', 'none');

    // Set up interactive behaviors
    contentGroup.on('mouseover', (event) => {
        const target = event.target;
        if (target.tagName === 'rect') {
            const d = d3.select(target.parentNode).datum() as NodeDatum;
            // Highlight selected rectangle
            d3.select(target)
                .attr('stroke', '#000')
                .attr('stroke-width', 2);

            // Show tooltip with data
            tooltip.transition()
                .duration(TRANSITION.FADE_IN)
                .style('opacity', 0.9);

            // Calculate percentage based on total websites, not sum of all values
            const percentage = totalWebsites > 0 ? Math.round((d.value / totalWebsites) * 100) : 0;

            const tooltipContent = `<strong>${d.name}</strong><br/>Websites: ${percentage}% (${d.value})`;

            tooltip
                .html(tooltipContent)
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY - 28}px`);
        }
    }).on('mouseout', (event) => {
        const target = event.target;
        if (target.tagName === 'rect') {
            // Reset rectangle style
            d3.select(target)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
            // Hide tooltip
            tooltip.transition()
                .duration(TRANSITION.FADE_OUT)
                .style('opacity', 0);
        }
    });

    // Return cleanup function
    return () => {
        tooltip.remove();
    };
};

/**
 * TreemapVisualization component
 * This is a functional component that uses the renderTreemap function
 * to create and update the D3 visualization
 */
export const TreemapVisualization: React.FC<TreemapVisualizationProps> = ({
    currentReport,
    type,
    width = DIMENSIONS.DEFAULT_WIDTH,
    height = DIMENSIONS.DEFAULT_HEIGHT,
    minWebsitesThreshold = 0, // Default to 0 (no filtering)
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Transform data for visualization using the separate transformer module
    const treemapData = useMemo(
        () => transformReportResultForTreemap(currentReport, type, minWebsitesThreshold),
        [currentReport, type, minWebsitesThreshold],
    );

    // Get the total number of websites from the report
    const totalWebsites = currentReport.siteCount || 0;

    // Get visualization title information
    const { title, subheader } = getVisualizationTitleData(type);

    // Calculate how many items are being filtered
    const rawData = useMemo(() => {
        const data = getRawDataForVisualizationType(currentReport, type);
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [currentReport, type]);

    const totalItems = rawData.length;
    const visibleItems = treemapData.children.length;
    const filteredItems = totalItems - visibleItems;

    useEffect(() => {
        if (!containerRef.current) return undefined;

        // Clean up previous visualization
        d3.select(containerRef.current).selectAll('*').remove();

        // Render the treemap and get cleanup function
        const cleanup = renderTreemap(
            containerRef.current,
            treemapData,
            width,
            height,
            totalWebsites,
        );

        return cleanup;
    }, [treemapData, width, height, totalWebsites]);

    return (
        <div className="mb-4">
            <h3>{title}</h3>
            <p className="text-muted">{subheader}</p>
            <div className="visualization-container d-flex flex-column">

                <div className="rounded py-2 px-3 mb-3"
                    style={{
                        backgroundColor: 'rgba(186, 231, 245, 0.6)',
                        color: '#0c5460',
                        display: 'flex',
                        alignItems: 'center',
                        width: `${width}px`,
                        maxWidth: '100%',
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="me-2" viewBox="0 0 16 16">
                        <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                    </svg>
                    <div style={{ fontSize: '0.95rem', flexGrow: 1 }}>
                            Showing <strong>{visibleItems}</strong> of <strong>{totalItems}</strong> items
                            (filtered out <strong>{filteredItems}</strong> {filteredItems === 1 ? 'item' : 'items'} with fewer than or equal to <strong>{minWebsitesThreshold}</strong> websites)
                    </div>
                </div>

                <div ref={containerRef} className="mt-3" />

                <div className="d-flex">
                    <div>
                        <Legend />
                    </div>
                </div>
            </div>

        </div>
    );
};
