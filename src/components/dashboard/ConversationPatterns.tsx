import React, { useState, useMemo, useEffect } from 'react';
import { Users, Repeat, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts';
import { C } from '../../theme';

interface LabelDistribution {
    positive_pct: number;
    neutral_pct: number;
    negative_pct: number;
}

interface DataPoint {
    meeting_id: number;
    generated_at: string;
    ownership_score: number;
    invitation_score: number;
    ownership_distribution?: LabelDistribution;
    invitation_distribution?: LabelDistribution;
    title: string;
}

interface ConversationPatternsProps {
    data: DataPoint[];
    latestOwnership: number;
    latestInvitation: number;
    latestOwnershipDistribution?: LabelDistribution;
    latestInvitationDistribution?: LabelDistribution;
}

type TimeFrame = '7 days' | '30 days' | '12 months';

// Normalize distribution to ensure it sums to 100%
const normalizeDistribution = (dist: LabelDistribution): LabelDistribution => {
    const total = dist.positive_pct + dist.neutral_pct + dist.negative_pct;
    if (total === 0 || total === 100) return dist;
    return {
        positive_pct: Math.round((dist.positive_pct / total) * 100),
        neutral_pct: Math.round((dist.neutral_pct / total) * 100),
        negative_pct: 100 - Math.round((dist.positive_pct / total) * 100) - Math.round((dist.neutral_pct / total) * 100)
    };
};

const ConversationPatterns: React.FC<ConversationPatternsProps> = ({
    data = [],
    latestOwnership = 0,
    latestInvitation = 0,
    latestOwnershipDistribution,
    latestInvitationDistribution
}) => {
    const [timeframe, setTimeframe] = useState<TimeFrame>('7 days');
    const [animateKey, setAnimateKey] = useState(0);

    // Trigger animation when distribution data changes
    useEffect(() => {
        setAnimateKey(prev => prev + 1);
    }, [latestOwnershipDistribution, latestInvitationDistribution]);

    // 1. Logic to handle 0% for teams with no meetings
    const hasData = data && data.length > 0;
    const ownPercent = hasData ? Math.round(latestOwnership * 100) : 0;
    const invPercent = hasData ? Math.round(latestInvitation * 100) : 0;

    // Use distribution data if available, otherwise use defaults
    const defaultOwnDist = { positive_pct: 33, neutral_pct: 34, negative_pct: 33 };
    const defaultInvDist = { positive_pct: 33, neutral_pct: 34, negative_pct: 33 };

    const rawOwnDist = latestOwnershipDistribution || (hasData ? defaultOwnDist : { positive_pct: 0, neutral_pct: 0, negative_pct: 0 });
    const rawInvDist = latestInvitationDistribution || (hasData ? defaultInvDist : { positive_pct: 0, neutral_pct: 0, negative_pct: 0 });

    const normalizedOwnDist = normalizeDistribution(rawOwnDist);
    const normalizedInvDist = normalizeDistribution(rawInvDist);

    const filteredChartData = useMemo(() => {
        if (!hasData) return [];

        const now = new Date();
        const daysToSubtract = timeframe === '7 days' ? 7 : timeframe === '30 days' ? 30 : 365;
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - daysToSubtract);

        return data
            .filter(point => new Date(point.generated_at) >= cutoffDate)
            .map(point => ({
                name: new Date(point.generated_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                timestamp: new Date(point.generated_at).getTime(),
                Ownership: (point.ownership_score || 0) * 100,
                Inquiry: (point.invitation_score || 0) * 100,
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [data, timeframe, hasData]);

    return (
        <div className="space-y-6 p-4 h-full">
            {/* 2. Cohesion Breakdown - 3-Way Bars with Animation */}
            <div className="space-y-8">
                <div className="flex items-center gap-2 font-semibold uppercase text-xs tracking-widest" style={{ color: C.textSec }}>
                    <div className="p-1 rounded-full" style={{ borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}><Repeat size={12} /></div>
                    <h3>Cohesion Breakdown</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Ownership Bar - 3 Segments with Animation */}
                    <div className="space-y-4" key={`own-${animateKey}`}>
                        <div className="flex justify-between items-center text-sm font-bold">
                            <span style={{ color: C.teal }}>Ownership</span>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ background: C.teal }}></span>
                                    Ownership
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                    Neutral
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                                    External
                                </span>
                            </div>
                        </div>
                        <div className="h-4 w-full bg-slate-100 rounded-full flex overflow-hidden relative">
                            {/* Ownership - Green with animation */}
                            <div
                                className="h-full transition-all duration-700 ease-out"
                                style={{ width: `${normalizedOwnDist.positive_pct}%`, background: C.teal }}
                            />
                            {/* Neutral - Gray with animation */}
                            <div
                                className="h-full bg-slate-400 transition-all duration-700 ease-out"
                                style={{ width: `${normalizedOwnDist.neutral_pct}%` }}
                            />
                            {/* Externalisation - Light gray with animation */}
                            <div
                                className="h-full bg-slate-200 transition-all duration-700 ease-out"
                                style={{ width: `${normalizedOwnDist.negative_pct}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed italic">How responsibility is taken, shared, or deflected when addressing issues, errors, or next steps.</p>
                        <div className="flex justify-between text-xs font-bold uppercase">
                            <span style={{ color: C.teal }}>{normalizedOwnDist.positive_pct}% ownership</span>
                            <span className="text-slate-500">{normalizedOwnDist.neutral_pct}% neutral</span>
                            <span className="text-slate-400">{normalizedOwnDist.negative_pct}% externalisation</span>
                        </div>
                    </div>

                    {/* Inquiry Bar - 3 Segments with Animation */}
                    <div className="space-y-4" key={`inv-${animateKey}`}>
                        <div className="flex justify-between items-center text-sm font-bold">
                            <span style={{ color: C.teal }}>Inquiry</span>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ background: C.teal }}></span>
                                    Inquiry
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                    Neutral
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                                    Closure
                                </span>
                            </div>
                        </div>
                        <div className="h-4 w-full bg-slate-100 rounded-full flex overflow-hidden relative">
                            {/* Inquiry - Green with animation */}
                            <div
                                className="h-full transition-all duration-700 ease-out"
                                style={{ width: `${normalizedInvDist.positive_pct}%`, background: C.teal }}
                            />
                            {/* Neutral - Gray with animation */}
                            <div
                                className="h-full bg-slate-400 transition-all duration-700 ease-out"
                                style={{ width: `${normalizedInvDist.neutral_pct}%` }}
                            />
                            {/* Premature Closure - Light gray with animation */}
                            <div
                                className="h-full bg-slate-200 transition-all duration-700 ease-out"
                                style={{ width: `${normalizedInvDist.negative_pct}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed italic">Whether conversations invite exploration and learning or shut down inquiry prematurely.</p>
                        <div className="flex justify-between text-xs font-bold uppercase">
                            <span style={{ color: C.teal }}>{normalizedInvDist.positive_pct}% inquiry</span>
                            <span className="text-slate-500">{normalizedInvDist.neutral_pct}% neutral</span>
                            <span className="text-slate-400">{normalizedInvDist.negative_pct}% closure</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Trend Over Time Chart */}
            <div className="rounded-3xl p-8 relative" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, boxShadow: `0 4px 20px ${C.shadowColor}` }}>
                <div className="flex justify-between items-center mb-10">
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold" style={{ color: C.text }}>Trend Over Time</h3>
                        <p className="text-sm" style={{ color: C.textDim }}>Tracking the shift from defensive to constructive language</p>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ background: C.teal }} />
                                <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: C.textDim }}>Ownership</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ background: C.tealMuted }} />
                                <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: C.textDim }}>Inquiry</span>
                            </div>
                        </div>

                        <div className="flex rounded-xl p-1" style={{ background: C.bgSub, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
                            {(['7 days', '30 days', '12 months'] as TimeFrame[]).map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setTimeframe(option)}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeframe === option
                                        ? 'shadow-sm'
                                        : ''
                                        }`}
                                    style={timeframe === option ? { background: C.card, color: C.text } : { color: C.textDim }}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ height: '300px', width: '100%', position: 'relative' }}>
                    {!hasData || filteredChartData.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-dashed z-10" style={{ background: C.bgSub, borderColor: C.border }}>
                            <p className="text-sm font-medium" style={{ color: C.textDim }}>No meeting data available for this period</p>
                        </div>
                    ) : null}

                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={filteredChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: C.textDim, fontSize: 12, fontWeight: 500 }}
                                dy={10}
                            />

                            <Line
                                type="monotone"
                                dataKey="Ownership"
                                stroke={C.teal}
                                strokeWidth={3}
                                dot={{ r: 4, fill: C.teal, strokeWidth: 2, stroke: C.white }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                isAnimationActive={true}
                                animationDuration={1000}
                            />
                            <Line
                                type="monotone"
                                dataKey="Inquiry"
                                stroke={C.tealMuted}
                                strokeWidth={3}
                                dot={{ r: 4, fill: C.tealMuted, strokeWidth: 2, stroke: C.white }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                isAnimationActive={true}
                                animationDuration={1000}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ConversationPatterns;
