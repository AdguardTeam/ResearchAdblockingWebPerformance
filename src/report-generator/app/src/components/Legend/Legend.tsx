import * as d3 from 'd3';
import { VisualizationType } from '../../types/VisualizationType';

type LegendProps = {
    type?: VisualizationType;
    width?: number;
    height?: number;
    lowLabel?: string;
    highLabel?: string;
};

export const Legend: React.FC<LegendProps> = ({
    width = 300,
    height = 50,
    lowLabel = 'Low',
    highLabel = 'High',
}) => (
    <div className="legend mt-3">
        <h5>Number of Websites</h5>
        <svg width={width} height={height}>
            <defs>
                <linearGradient id="legend-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={d3.interpolateViridis(0)} stopOpacity={1} />
                    <stop offset="100%" stopColor={d3.interpolateViridis(1)} stopOpacity={1} />
                </linearGradient>
            </defs>
            <rect x="0" y="10" width={width} height={20} fill="url(#legend-gradient)" />
            <text x="0" y={height - 5} fontSize="12px">
                {lowLabel}
            </text>
            <text x={width} y={height - 5} fontSize="12px" textAnchor="end">
                {highLabel}
            </text>
        </svg>
    </div>
);
