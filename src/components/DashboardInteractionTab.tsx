import { useState, useEffect, useCallback } from 'react';
import { Loader2, X } from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts';
import { API_BASE_URL } from '../services/api';
import { useAuth } from '@clerk/clerk-react';
import { Repeat } from 'lucide-react';
import { C, useThemeMode } from '../theme';

const SENTIMENT_SURFACE = {
    positive: { background: `${C.green}14`, borderColor: `${C.green}33`, color: C.green },
    negative: { background: `${C.red}14`, borderColor: `${C.red}33`, color: C.red },
    neutral: { background: C.bgSub, borderColor: C.border, color: C.textSec },
};

// Utility logic for Dynamic Styling
const getParticipationStatus = (score: number) => {
    if (score >= 75) return {
        label: "Inclusive / Balanced",
        insight: "Everyone is contributing"
    };
    if (score >= 50) return {
        label: "Conversational",
        insight: "Developing dynamic"
    };
    return {
        insight: "Single speaker focus"
    };
};

const getInteractionLabel = (velocity: number, sentiment: number, balance: number) => {
    const is_balanced = balance > 70;

    // 1. TONE IS NEGATIVE (< 40)
    if (sentiment < 40) {
        if (velocity > 25) return is_balanced ? "Volatile Rapid-Fire" : "Aggressive Domination";
        if (velocity >= 15) return is_balanced ? "High Friction Exchange" : "High Intensity Monologue";
        if (velocity >= 5) return is_balanced ? "Tense Disagreement" : "Critical Lecture";
        return is_balanced ? "Stalled / Deadlock" : "Disengaged Silence";
    }

    // 2. TONE IS POSITIVE (> 60)
    if (sentiment > 60) {
        if (velocity > 25) return is_balanced ? "Electric Collaboration" : "Passionate Solo";
        if (velocity >= 15) return is_balanced ? "High Energy Flow" : "Enthusiastic Presentation";
        if (velocity >= 5) return is_balanced ? "Productive Dialogue" : "Engaging Update";
        return is_balanced ? "Deep Strategic Dive" : "Inspirational Speech";
    }

    // 3. TONE IS NEUTRAL (40-60)
    if (velocity > 25) return is_balanced ? "Chaotic/Rushed Flow" : "Rapid Information Dump";
    if (velocity >= 15) return is_balanced ? "Brisk Exchange" : "Fast-Paced Briefing";
    if (velocity >= 5) return is_balanced ? "Standard Dialogue" : "Routine Update";
    return is_balanced ? "Measured Deliberation" : "Slow-Paced Review";
};

const getSentimentStatus = (score: number) => {
    if (score >= 91) return { label: "Peak Synergy" };
    if (score >= 81) return { label: "Highly Collaborative" };
    if (score >= 71) return { label: "Constructive Flow" };
    if (score >= 61) return { label: "Receptive / Open" };
    if (score >= 51) return { label: "Neutral / Balanced" };
    if (score >= 41) return { label: "Reserved / Cautious" };
    if (score >= 31) return { label: "Guarded / Tense" };
    if (score >= 21) return { label: "High Friction" };
    if (score >= 11) return { label: "Hostile / Volatile" };
    return { label: "Critical Breakdown" };
};

// Sub-components for Dynamics Cards
const ParticipationCard = ({ data }: { data: any }) => {
    const score = Math.round(data.score);
    const status = getParticipationStatus(score);

    return (
        <div className="px-6 py-5 rounded-xl shadow-sm flex flex-col gap-4 aspect-[1.8/1]" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>Participation Balance</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] uppercase" style={{ background: C.tealDeep, color: C.teal }}>
                    {status.label}
                </span>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                <div className="h-3 w-full rounded-full overflow-hidden shadow-inner mt-2 mb-1" style={{ background: C.bgSub }}>
                    <div
                        className="h-full transition-all duration-700 shadow-sm"
                        style={{ width: `${score}%`, background: C.teal }}
                    />
                </div>
            </div>

            <div className="flex justify-between items-center mt-auto">
                <p className="text-[9px] font-bold uppercase tracking-tight" style={{ color: C.teal }}>
                    {status.insight}
                </p>
            </div>
        </div>
    );
};

const OverlapCard = ({ data, sentiment, balance }: { data: any, sentiment: number, balance: number }) => {
    const velocity = data.velocity || 0;
    const pacing = data.pacing || 0;
    const label = data.label || getInteractionLabel(velocity, sentiment, balance);

    return (
        <div className="px-6 py-5 rounded-xl shadow-sm flex flex-col gap-4 aspect-[1.8/1] sm:text-left" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>Conversation Flow</h3>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                <div className="text-xl font-bold leading-tight tracking-tight" style={{ color: C.textSec }}>
                    {label}
                </div>
            </div>

            <div className="mt-auto flex flex-row justify-between items-end pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>
                    <span className="text-3xl font-bold" style={{ color: C.teal }}>{velocity.toFixed(1)}</span> TURNS / MIN
                </div>
                <div className="text-[9px] font-medium tracking-widest italic" style={{ color: C.textSec }}>
                    {pacing.toFixed(2)}s AVG PACING
                </div>
            </div>
        </div>
    );
};

const ArousalCard = ({ data, historyTrend, score, label }: { data: any, historyTrend?: number[], score?: number, label?: string }) => {
    const history = historyTrend || data.sentiment_history || [100, 100, 100];
    const sum = history.reduce((acc: number, val: number) => acc + val, 0);
    const calculatedAverage = history.length > 0 ? Math.round(sum / history.length) : 0;
    const realAverage = score !== undefined ? score : calculatedAverage;
    const scoreTextColor = realAverage > 60
    ? C.green
    : realAverage < 40
        ? C.teal
        : C.tealMuted;
    const chartData = history.map((val: number, i: number) => ({ time: i, value: val }));

    const getInsight = (s: number) => {
        if (s <= 10) return "Critical Breakdown";
        if (s <= 20) return "Hostile / Volatile";
        if (s <= 30) return "High Friction";
        if (s <= 40) return "Guarded / Tense";
        if (s <= 50) return "Reserved / Cautious";
        if (s <= 60) return "Neutral / Balanced";
        if (s <= 70) return "Receptive / Open";
        if (s <= 80) return "Constructive Flow";
        if (s <= 90) return "Highly Collaborative";
        return "Peak Synergy";
    };

    const displayLabel = label || getInsight(realAverage);

    return (
        <div className="px-6 py-5 rounded-xl shadow-sm relative overflow-hidden group aspect-[1.8/1] flex flex-col gap-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>Sentiment Trends</h3>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                <div className="w-full h-16 opacity-80 group-hover:opacity-100 transition-opacity relative">
                    <div className="absolute -top-3 left-0 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap" style={{ background: C.card, color: scoreTextColor }}>
                        {displayLabel}
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorSentimentDashboard" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={C.teal} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={C.tealMuted} stopOpacity={0.2} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={C.teal}
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorSentimentDashboard)"
                                isAnimationActive={true}
                            />
                            <YAxis hide domain={[0, 100]} />
                            <XAxis hide />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="flex justify-between items-center mt-auto pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-1.5 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.teal }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>Team Evolution</span>
                </div>
            </div>
        </div>
    );
};

// Data Aggregation Helpers
const calculateSMA = (data: number[], period: number) => {
    return data.map((_, idx, arr) => {
        const start = Math.max(0, idx - period + 1);
        const subset = arr.slice(start, idx + 1);
        const sum = subset.reduce((a, b) => a + b, 0);
        return sum / subset.length;
    });
};

type TimeRange = '1week' | '1month' | '3months' | '1year';

const DashboardInteractionTab = ({ teamId }: { teamId: string }) => {
    useThemeMode();
    const { getToken } = useAuth();
    const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange>('1month');
    const [trendData, setTrendData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>({
        avg_participation: 50,
        avg_sentiment: 50,
        avg_velocity: 8.0,
        avg_pacing: 1.5,
        dominant_flow: "Loading...",
        overall_synergy: 0
    });
    const [selectedPoint, setSelectedPoint] = useState<any>(null);
    const [coachInsight, setCoachInsight] = useState<string | null>(null);
    const [loadingInsight, setLoadingInsight] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        if (!teamId) return;
        setLoading(true);
        try {
            const token = await getToken();
            const baseUrl = API_BASE_URL.replace(/\/api$/, '');

            // Parallel fetch for meetings history and aggregated trends
            const [meetingsRes, trendsRes] = await Promise.all([
                fetch(`${baseUrl}/meetings/${teamId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${baseUrl}/meetings/${teamId}/trends?time_range=${timeRange}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            if (meetingsRes.ok) {
                const data = await meetingsRes.json();
                setRecentMeetings(data);
            }

            if (trendsRes.ok) {
                const trendJson = await trendsRes.json();

                // 1. Map backend history to graph points
                const history = trendJson.history || [];
                const gran = trendJson.granularity;

                const formattedTrends = history.map((p: any) => {
                    const dateObj = new Date(p.date);
                    let label = "";
                    if (gran === 'meeting') {
                        label = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else if (gran === 'month') {
                        label = dateObj.toLocaleDateString([], { month: 'short', year: '2-digit' });
                    } else {
                        label = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    }

                    return {
                        ...p,
                        label,
                        fullDate: dateObj.toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                    };
                });

                setTrendData(formattedTrends);

                // 2. Set Summary Metrics for Cards
                if (trendJson.summary) {
                    setSummary(trendJson.summary);
                }
            }
        } catch (error) {
            console.error("Failed to load dashboard metrics", error);
        } finally {
            setLoading(false);
        }
    }, [teamId, getToken, timeRange]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const fetchCoachInsight = async (point: any) => {
        setLoadingInsight(true);
        setCoachInsight(null);
        try {
            const response = await fetch(`${API_BASE_URL.replace(/\/api$/, '')}/meetings/coach-insight`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    synergy: point.synergy,
                    tension: point.tension,
                    top_emotion: point.meeting?.dominant_tone || "Neutral"
                })
            });
            const resData = await response.json();
            setCoachInsight(resData.insight);
        } catch (e) {
            setCoachInsight("Focus on active listening and encouraging diverse perspectives to strengthen team cohesion.");
        } finally {
            setLoadingInsight(false);
        }
    };

    const handlePointClick = (point: any) => {
        setSelectedPoint(point);
        fetchCoachInsight(point);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20" style={{ color: C.textDim }}>
                <Loader2 className="animate-spin mb-4" size={32} style={{ color: C.teal }} />
                <span className="text-sm font-medium tracking-widest uppercase">Gathering Team Dynamics...</span>
            </div>
        );
    }

    if (recentMeetings.length === 0) {
        return (
            <div className="p-12 rounded-xl border border-dashed text-center" style={{ background: C.card, borderColor: C.border }}>
                <p style={{ color: C.textDim }}>No meeting history found for this team. Record a meeting to see dynamics.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 h-full">
            <div className="space-y-6"><div className="flex items-center gap-2 font-semibold uppercase text-xs tracking-widest" style={{ color: C.textSec }}>
                    <div className="p-1 rounded-full border" style={{ borderColor: C.border }}><Repeat size={12} /></div>
                    <h3>Cohesion Breakdown</h3>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ParticipationCard data={{
                    score: summary.avg_participation,
                }} />
                <OverlapCard
                    data={{
                        velocity: summary.avg_velocity,
                        pacing: summary.avg_pacing,
                        label: summary.dominant_flow
                    }}
                    sentiment={summary.avg_sentiment}
                    balance={summary.avg_participation}
                />
                <ArousalCard
                    data={{ score: 0.5 }} // placeholder, internal average used
                    score={summary.avg_sentiment}
                    label={getSentimentStatus(summary.avg_sentiment).label}
                    historyTrend={(() => {
                        // For the trend line in the card, we'll use history points
                        const historyPoints = trendData.map(p => p.synergy);
                        return calculateSMA(historyPoints, 3);
                    })()}
                />
            </div>
            
            {/* Trend over time */}
            <div className="rounded-3xl p-8 relative" style={{ border: `1px solid ${C.border}`, background: C.card, boxShadow: `0 4px 20px ${C.shadowColor}` }}>
                <div className="flex justify-between items-center mb-10">
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold" style={{ color: C.text }}>Trend Over Time </h3>
                        <p className="text-sm" style={{ color: C.textDim }}>Tracking the shift from defensive to constructive language</p>
                    </div>
                    <div className="flex rounded-xl p-1" style={{ background: C.bgSub, border: `1px solid ${C.border}` }}>
                        {(['1week', '1month', '3months', '1year'] as TimeRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === range ? 'shadow-sm' : 'hover-bg'}`}
                                style={timeRange === range ? { background: C.card, color: C.text } : { color: C.textDim }}
                            >
                                {range === '1week' ? '1 Week' : range === '1month' ? '1 Month' : range === '3months' ? '3 Months' : '1 Year'}
                            </button>
                        ))}
                    </div>
                </div>

                {selectedPoint && (
                    <div className="absolute top-16 right-6 z-50 shadow-2xl p-5 rounded-2xl w-80 animate-in zoom-in-95 duration-200" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-sm truncate max-w-[200px]" style={{ color: C.text }}>{selectedPoint.meeting?.title || 'Untitled Meeting'}</h4>
                                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.textDim }}>{selectedPoint.fullDate}</p>
                            </div>
                            <button onClick={() => setSelectedPoint(null)} className="transition-colors p-1 hover-bg rounded" style={{ color: C.textDim }}><X size={16} /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-5">
                            <div className="p-3 rounded-xl border" style={SENTIMENT_SURFACE.positive}>
                                <span className="text-[9px] uppercase font-bold block mb-1">Synergy</span>
                                <span className="text-lg font-black">{Math.round(selectedPoint.synergy)}</span>
                            </div>
                            <div className="p-3 rounded-xl border" style={SENTIMENT_SURFACE.negative}>
                                <span className="text-[9px] uppercase font-bold block mb-1">Tension</span>
                                <span className="text-lg font-black">{Math.round(selectedPoint.tension)}</span>
                            </div>
                        </div>

                        <div className="rounded-xl p-4 mb-5 border" style={{ background: C.bgSub, borderColor: C.border }}>
                            <h5 className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: C.textDim }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.teal }} />
                                AI Coach Insight
                            </h5>
                            {loadingInsight ? (
                                <div className="space-y-2 animate-pulse">
                                    <div className="h-2.5 rounded-full w-full" style={{ background: C.border }} />
                                    <div className="h-2.5 rounded-full w-5/6" style={{ background: C.border }} />
                                </div>
                            ) : (
                                <p className="text-xs leading-relaxed font-medium" style={{ color: C.textSec }}>
                                    {coachInsight}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={trendData}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            onClick={(e: any) => {
                                if (e && e.activePayload && e.activePayload.length > 0) {
                                    handlePointClick(e.activePayload[0].payload);
                                }
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 9, fontWeight: 600, fill: C.textDim }}
                                dy={10}
                            />
                            <YAxis
                                domain={[0, 100]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 9, fontWeight: 600, fill: C.textDim }}
                                label={{
                                    value: 'Team Synergy Score',
                                    angle: -90,
                                    position: 'insideLeft',
                                    offset: 10,
                                    style: { fontSize: '10px', fontWeight: 'bold', fill: C.textDim, textTransform: 'uppercase' }
                                }}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="p-3 shadow-xl rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                                                <p className="text-[10px] font-bold mb-1 uppercase tracking-tight" style={{ color: C.textDim }}>{payload[0].payload.fullDate}</p>
                                                <div className="pt-2 mt-1" style={{ borderTop: `1px solid ${C.border}` }}>
                                                    <p className="text-[9px] leading-tight font-medium" style={{ color: C.textDim }}>
                                                        Synergy is a composite of Balance, Flow, and Tone.
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="synergy"
                                stroke={C.teal}
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorSynergy)"
                                dot={{ r: 4, fill: C.teal, strokeWidth: 2, stroke: C.card }}
                                activeDot={{ r: 6, strokeWidth: 0, fill: C.teal }}
                            />
                            <Area
                                type="monotone"
                                dataKey="tension"
                                stroke={C.tealMuted}
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorTension)"
                                dot={{ r: 4, fill: C.tealMuted, strokeWidth: 2, stroke: C.card }}
                                activeDot={{ r: 6, strokeWidth: 0, fill: C.tealMuted }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="flex items-center gap-6 mt-4 justify-center">
                    <div className="flex items-center gap-2">
                        <div className="h-0.5 w-4 rounded-full" style={{ background: C.teal }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textSec }}>Synergy</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-0.5 w-4 rounded-full" style={{ background: C.tealMuted }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textSec }}>Tension</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardInteractionTab;
