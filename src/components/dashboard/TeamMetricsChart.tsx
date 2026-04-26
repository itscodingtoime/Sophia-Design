import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ComposedChart,
} from 'recharts';
import { API_BASE_URL } from '../../services/api';
import { useAuth, useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { Loader2, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { C } from '../../theme';

// ============================================================================
// Types
// ============================================================================

interface TeamMetricsPoint {
    date: string;
    synergy: number;
    tension: number;
    participation: number;
    stability: number;
    ownership?: number;
    inquiry?: number;
    label: string;
    full_date: string;
}

interface TeamSummary {
    team_id: string;
    team_name: string;
    avg_participation: number;
    avg_stability: number;
    avg_velocity: number;
    avg_pacing: number;
    dominant_flow: string;
    overall_synergy: number;
    avg_ownership?: number;
    avg_inquiry?: number;
    meeting_count: number;
}

interface TeamMetricsResponse {
    team_id: string;
    team_name: string;
    time_range: string;
    granularity: string;
    history: TeamMetricsPoint[];
    summary: TeamSummary;
}

interface ConsolidatedPoint {
    date: string;
    label: string;
    teams: Record<string, {
        team_name: string;
        synergy: number;
        participation: number;
        stability: number;
    }>;
}

interface ConsolidatedSummary {
    team_id: string;
    team_name: string;
    avg_synergy: number;
    avg_participation: number;
    avg_stability: number;
    meeting_count: number;
    trend_direction: 'improving' | 'declining' | 'stable';
}

// ============================================================================
// Color Palette for Teams (data-differentiation — not theme colors)
// ============================================================================

const TEAM_COLORS = [
    { stroke: '#225439', fill: 'rgba(34, 84, 57, 0.1)', name: 'Team 1' },
    { stroke: '#0891b2', fill: 'rgba(8, 145, 178, 0.1)', name: 'Team 2' },
    { stroke: '#7c3aed', fill: 'rgba(124, 58, 237, 0.1)', name: 'Team 3' },
    { stroke: '#ea580c', fill: 'rgba(234, 88, 12, 0.1)', name: 'Team 4' },
    { stroke: '#dc2626', fill: 'rgba(220, 38, 38, 0.1)', name: 'Team 5' },
    { stroke: '#4f46e5', fill: 'rgba(79, 70, 229, 0.1)', name: 'Team 6' },
];

const getTeamColor = (index: number) => TEAM_COLORS[index % TEAM_COLORS.length];

// ============================================================================
// Helper Components
// ============================================================================

const TrendIndicator: React.FC<{ direction: string }> = ({ direction }) => {
    if (direction === 'improving') {
        return <TrendingUp className="w-4 h-4 text-green-500" />;
    }
    if (direction === 'declining') {
        return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return <Minus className="w-4 h-4 text-gray-400" />;
};

const MetricBadge: React.FC<{ label: string; value: number; max?: number }> = ({
    label, value, max = 100
}) => {
    const percentage = (value / max) * 100;
    let colorClass = 'bg-gray-100 text-gray-600';

    if (percentage >= 70) {
        colorClass = 'bg-green-100 text-green-700';
    } else if (percentage >= 40) {
        colorClass = 'bg-yellow-100 text-yellow-700';
    } else {
        colorClass = 'bg-red-100 text-red-700';
    }

    return (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${colorClass}`}>
            {label}: {Math.round(value)}
        </span>
    );
};

// ============================================================================
// Individual Team Chart Component
// ============================================================================

const IndividualTeamChart: React.FC<{
    teamId: string;
    timeRange: string;
    onTeamSelect: (teamId: string | null) => void;
}> = ({ teamId, timeRange, onTeamSelect }) => {
    const { getToken } = useAuth();
    const [data, setData] = useState<TeamMetricsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!teamId) return;
        setLoading(true);
        try {
            const token = await getToken({ organizationId: teamId });
            const response = await fetch(
                `${API_BASE_URL.replace(/\/api$/, '')}/api/v1/analytics/team-metrics?team_id=${teamId}&time_range=${timeRange}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const json = await response.json();
            setData(json);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching team metrics:', err);
            setError(err.message || 'Failed to load team metrics');
        } finally {
            setLoading(false);
        }
    }, [teamId, timeRange, getToken]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.teal }} />
                <span className="ml-2" style={{ color: C.textDim }}>Loading team metrics...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 font-medium">Error loading team metrics</p>
                <p className="text-red-500 text-sm mt-1">{error}</p>
                <button
                    onClick={fetchData}
                    className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data || data.history.length === 0) {
        return (
            <div className="p-6 rounded-xl text-center" style={{ background: C.bgSub, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
                <p className="font-medium" style={{ color: C.textSec }}>No metrics data available</p>
                <p className="text-sm mt-1" style={{ color: C.textDim }}>This team doesn't have any meeting data for the selected time range.</p>
            </div>
        );
    }

    const chartData = data.history.map(point => ({
        ...point,
        ownership: point.ownership !== undefined ? point.ownership * 100 : undefined,
        inquiry: point.inquiry !== undefined ? point.inquiry * 100 : undefined,
    }));

    return (
        <div className="space-y-6">
            {/* Team Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl shadow-sm" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.textDim }}>Synergy</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: C.teal }}>{data.summary.overall_synergy}</p>
                    <MetricBadge label="Overall" value={data.summary.overall_synergy} />
                </div>
                <div className="p-4 rounded-xl shadow-sm" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.textDim }}>Participation</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{data.summary.avg_participation}</p>
                    <MetricBadge label="Balance" value={data.summary.avg_participation} />
                </div>
                <div className="p-4 rounded-xl shadow-sm" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.textDim }}>Stability</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{data.summary.avg_stability}</p>
                    <MetricBadge label="Emotional" value={data.summary.avg_stability} />
                </div>
                <div className="p-4 rounded-xl shadow-sm" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.textDim }}>Meetings</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: C.textSec }}>{data.summary.meeting_count}</p>
                    <p className="text-xs mt-1" style={{ color: C.textDim }}>data points</p>
                </div>
            </div>

            {/* Main Trend Chart */}
            <div className="p-6 rounded-xl shadow-sm" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold" style={{ color: C.text }}>{data.team_name}</h3>
                        <p className="text-sm" style={{ color: C.textDim }}>Historical performance trends</p>
                    </div>
                    <button
                        onClick={() => onTeamSelect(null)}
                        className="px-3 py-1.5 text-sm rounded-lg transition-colors"
                        style={{ background: C.bgSub, color: C.textSec }}
                    >
                        ← Back to Overview
                    </button>
                </div>

                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <defs>
                                <linearGradient id="synergyGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={C.teal} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={C.teal} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="participationGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: C.textDim, fontSize: 12 }}
                                axisLine={{ stroke: C.border }}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, 100]}
                                tick={{ fill: C.textDim, fontSize: 12 }}
                                axisLine={{ stroke: C.border }}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: C.card,
                                    border: `1px solid ${C.border}`,
                                    borderRadius: '8px',
                                    boxShadow: `0 4px 6px -1px ${C.shadowColor}`
                                }}
                                labelStyle={{ color: C.text, fontWeight: 600 }}
                                formatter={(value: number | undefined, name: string | undefined) => [
                                    Math.round(value ?? 0),
                                    name ? name.charAt(0).toUpperCase() + name.slice(1) : ''
                                ]}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="synergy"
                                stroke={C.teal}
                                strokeWidth={2}
                                fill="url(#synergyGradient)"
                                name="Synergy"
                            />
                            <Area
                                type="monotone"
                                dataKey="participation"
                                stroke="#0891b2"
                                strokeWidth={2}
                                fill="url(#participationGradient)"
                                name="Participation"
                            />
                            <Line
                                type="monotone"
                                dataKey="stability"
                                stroke="#7c3aed"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#7c3aed' }}
                                name="Stability"
                            />
                            {chartData.some(d => d.ownership !== undefined) && (
                                <Line
                                    type="monotone"
                                    dataKey="ownership"
                                    stroke="#ea580c"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ r: 3, fill: '#ea580c' }}
                                    name="Ownership"
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Consolidated Comparison Chart Component
// ============================================================================

const ConsolidatedComparisonChart: React.FC<{
    timeRange: string;
    onTeamSelect: (teamId: string) => void;
}> = ({ timeRange, onTeamSelect }) => {
    const { getToken } = useAuth();
    const { userMemberships, isLoaded: orgListLoaded } = useOrganizationList({
        userMemberships: { infinite: true }
    });
    const [data, setData] = useState<{
        history: ConsolidatedPoint[];
        team_summaries: ConsolidatedSummary[];
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const response = await fetch(
                `${API_BASE_URL.replace(/\/api$/, '')}/api/v1/analytics/consolidated-metrics?time_range=${timeRange}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const json = await response.json();
            setData(json);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching consolidated metrics:', err);
            setError(err.message || 'Failed to load consolidated metrics');
        } finally {
            setLoading(false);
        }
    }, [timeRange, getToken]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.teal }} />
                <span className="ml-2" style={{ color: C.textDim }}>Loading team comparison...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 font-medium">Error loading comparison data</p>
                <p className="text-red-500 text-sm mt-1">{error}</p>
                <button
                    onClick={fetchData}
                    className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data || data.team_summaries.length === 0) {
        return (
            <div className="p-6 rounded-xl text-center" style={{ background: C.bgSub, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
                <Users className="w-12 h-12 mx-auto mb-3" style={{ color: C.textDim }} />
                <p className="font-medium" style={{ color: C.textSec }}>No team data available</p>
                <p className="text-sm mt-1" style={{ color: C.textDim }}>No teams with meeting data found for comparison.</p>
            </div>
        );
    }

    // Transform data for chart
    const chartData = data.history.map(point => {
        const entry: Record<string, any> = { label: point.label };
        Object.entries(point.teams).forEach(([teamId, teamData], idx) => {
            entry[`${teamId}_synergy`] = teamData.synergy;
            entry[`${teamId}_participation`] = teamData.participation;
        });
        return entry;
    });

    const teamColors = data.team_summaries.map((team, idx) => ({
        ...getTeamColor(idx),
        teamId: team.team_id,
        teamName: team.team_name
    }));

    return (
        <div className="space-y-6">
            {/* Team Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.team_summaries.map((team, idx) => {
                    const color = getTeamColor(idx);
                    return (
                        <div
                            key={team.team_id}
                            className="p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}
                            onClick={() => onTeamSelect(team.team_id)}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: color.stroke }}
                                    />
                                    <span className="font-semibold" style={{ color: C.text }}>{team.team_name}</span>
                                </div>
                                <TrendIndicator direction={team.trend_direction} />
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <p className="text-xs uppercase" style={{ color: C.textDim }}>Synergy</p>
                                    <p className="text-lg font-bold" style={{ color: color.stroke }}>
                                        {team.avg_synergy}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase" style={{ color: C.textDim }}>Participation</p>
                                    <p className="text-lg font-bold text-blue-600">
                                        {team.avg_participation}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase" style={{ color: C.textDim }}>Meetings</p>
                                    <p className="text-lg font-bold" style={{ color: C.textSec }}>
                                        {team.meeting_count}
                                    </p>
                                </div>
                            </div>

                            <p className="text-xs mt-2 text-center" style={{ color: C.textDim }}>
                                Click to view detailed trends →
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Comparison Chart */}
            <div className="p-6 rounded-xl shadow-sm" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
                <div className="mb-6">
                    <h3 className="text-lg font-semibold" style={{ color: C.text }}>Team Comparison</h3>
                    <p className="text-sm" style={{ color: C.textDim }}>Synergy scores over time across teams</p>
                </div>

                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: C.textDim, fontSize: 12 }}
                                axisLine={{ stroke: C.border }}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, 100]}
                                tick={{ fill: C.textDim, fontSize: 12 }}
                                axisLine={{ stroke: C.border }}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: C.card,
                                    border: `1px solid ${C.border}`,
                                    borderRadius: '8px',
                                    boxShadow: `0 4px 6px -1px ${C.shadowColor}`
                                }}
                                labelStyle={{ color: C.text, fontWeight: 600 }}
                            />
                            <Legend />
                            {teamColors.map((color, idx) => (
                                <Line
                                    key={color.teamId}
                                    type="monotone"
                                    dataKey={`${color.teamId}_synergy`}
                                    stroke={color.stroke}
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: color.stroke }}
                                    name={color.teamName}
                                    connectNulls
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

type TimeRange = '7d' | '30d' | '90d' | '365d';

const TeamMetricsChart: React.FC = () => {
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>('30d');
    const { organization } = useOrganization();

    const timeRangeOptions: { value: TimeRange; label: string }[] = [
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' },
        { value: '90d', label: '90 Days' },
        { value: '365d', label: '1 Year' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold" style={{ color: C.text }}>Team Metrics</h2>
                    <p className="text-sm" style={{ color: C.textDim }}>
                        {selectedTeam
                            ? 'Detailed metrics for selected team'
                            : 'Compare metrics across all teams'}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                        className="px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, color: C.textSec }}
                    >
                        {timeRangeOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content */}
            {selectedTeam ? (
                <IndividualTeamChart
                    teamId={selectedTeam}
                    timeRange={timeRange}
                    onTeamSelect={setSelectedTeam}
                />
            ) : (
                <ConsolidatedComparisonChart
                    timeRange={timeRange}
                    onTeamSelect={setSelectedTeam}
                />
            )}
        </div>
    );
};

export default TeamMetricsChart;
