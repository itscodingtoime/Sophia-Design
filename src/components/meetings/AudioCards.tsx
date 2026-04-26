import React from 'react';
import { C } from '../../theme';

interface AudioCardsTemplateProps {
    title?: string;
    value?: string;
    trend?: string;
    children?: React.ReactNode;
}

const AudioCardsTemplate = ({ title, value, trend, children }: AudioCardsTemplateProps) => {
    return (
        <div className="
            p-6
            rounded-xl
            shadow-lg
            relative
            overflow-hidden
            "
            style={{ background: `linear-gradient(to bottom, ${C.card}, ${C.bgSub})`, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}
        >
            <div className="absolute inset-0 opacity-100 pointer-events-none rounded-xl">
                <div className="absolute inset-0 rounded-xl" style={{ background: `linear-gradient(135deg, ${C.card}, ${C.bgSub})` }} />
            </div>
            {children ? (
                <div className="relative z-10">
                    {children}
                </div>
            ) : (
                <>
                    {title && <p className="text-sm font-semibold uppercase tracking-wide relative z-10" style={{ color: C.text }}>{title}</p>}
                    {value && <p className="mt-2 text-3xl font-bold relative z-10" style={{ color: C.teal }}>{value}</p>}
                    {trend && <p className="mt-1 text-sm relative z-10" style={{ color: C.textDim }}>{trend}</p>}
                </>
            )}
        </div>
    );
};

export const ParticipationCard = ({ data }: { data: any }) => (
    <AudioCardsTemplate>
        <h3 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: C.textDim }}>
            Participation Dynamics
        </h3>
        <div className="flex justify-between items-end mb-2 text-xs font-bold tracking-wider">
            <span style={{ color: C.green }}>INCLUSIVE</span>
            <span style={{ color: C.red }}>CONCENTRATED</span>
        </div>
        <div className="flex h-2 w-full rounded-full overflow-hidden" style={{ background: C.border }}>
            <div
                style={{ width: `${data.score * 100}%`, background: C.green }}
                className="transition-all duration-1000"
            />
            <div className="flex-1 transition-all duration-1000" style={{ background: C.red }} />
        </div>
        <div className="mt-4 flex justify-between items-center text-[10px] font-mono uppercase" style={{ color: C.textDim }}>
            <span>Score: {Math.round(data.score * 100)}/100</span>
            <span>{data.label}</span>
        </div>
    </AudioCardsTemplate>
);

// Overlap Style Card
export const OverlapCard = ({ data }: { data: any }) => (
    <AudioCardsTemplate>
        <h3 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: C.textDim }}>
            Overlap Style
        </h3>
        <div className="flex justify-between items-end mb-2 text-xs font-bold tracking-wider">
            <span style={{ color: C.green }}>COLLABORATIVE</span>
            <span style={{ color: C.red }}>COMPETITIVE</span>
        </div>
        <div className="flex h-2 w-full rounded-full overflow-hidden" style={{ background: C.border }}>
            <div
                style={{ width: `${data.score * 100}%`, background: C.green }}
                className="transition-all duration-1000"
            />
            <div className="flex-1 transition-all duration-1000" style={{ background: C.red }} />
        </div>
        <div className="mt-4 flex justify-between items-center text-[10px] font-mono uppercase" style={{ color: C.textDim }}>
            <span>{data.total_overlaps} Interjections</span>
            <span>{data.type}</span>
        </div>
    </AudioCardsTemplate>
);

// Emotional Arc (Arousal) Card
export const ArousalCard = ({ data }: { data: any }) => {
    // Backend provides sentiment_history (0-100). Fallback to neutral 80 if missing.
    const history = data?.sentiment_history || [80, 80, 80];

    // Sample 3 points (start, middle, end) for the simplified SVG path.
    // Scale 0-100 values to 0.0-1.0 for the existing height logic.
    const p1 = 25 - (((history[0] || 80) / 100) * 20);
    const p2 = 25 - (((history[Math.floor(history.length / 2)] || 80) / 100) * 20);
    const p3 = 25 - (((history[history.length - 1] || 80) / 100) * 20);

    return (
        <AudioCardsTemplate>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-teal-900/10 pointer-events-none" />
            <h3 className="text-xs font-bold uppercase tracking-widest mb-2 relative z-10" style={{ color: C.textDim }}>
                Emotional Arc
            </h3>
            <div className="h-24 w-full relative z-10 flex flex-col justify-end">
                <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none" className="overflow-visible">
                    <defs>
                        <linearGradient id="arousalGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#F87171" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.8" />
                        </linearGradient>
                        <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path
                        d={`M 0,50 L 0,${p1} L 50,${p2} L 100,${p3} L 100,50 Z`}
                        fill="url(#fillGrad)"
                        opacity="0.5"
                    />
                    <path
                        d={`M 0,${p1} L 50,${p2} L 100,${p3}`}
                        fill="none"
                        stroke="url(#arousalGrad)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
            </div>
            <div className="mt-2 font-semibold text-xs tracking-wide relative z-10 flex items-center gap-2" style={{ color: C.text }}>
                <div className={`h-2 w-2 rounded-full ${data?.trend === 'Regulation' ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                Trend: {data?.trend || 'Stable'}
            </div>
        </AudioCardsTemplate>
    );
};

// Sentiment Trends Card
export const SentimentTrendsCard = ({ breakdown }: { breakdown: { positive: number; negative: number; neutral: number } }) => (
    <AudioCardsTemplate>
        <h3 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: C.textDim }}>Sentiment</h3>
        <div className="space-y-4">
            {[
                { label: 'Positive', count: breakdown.positive, color: C.green, textColor: C.green },
                { label: 'Negative', count: breakdown.negative, color: C.red, textColor: C.red },
                { label: 'Neutral', count: breakdown.neutral, color: C.textDim, textColor: C.textDim },
            ].map((item) => {
                const total = breakdown.positive + breakdown.negative + breakdown.neutral;
                const percentage = total > 0 ? (item.count / total) * 100 : 0;
                return (
                    <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase">
                            <span style={{ color: item.textColor }}>{item.label}</span>
                            <span style={{ color: C.textDim }}>{Math.round(percentage)}%</span>
                        </div>
                        <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: C.border }}>
                            <div className="h-full" style={{ width: `${percentage}%`, background: item.color }} />
                        </div>
                    </div>
                );
            })}
        </div>
    </AudioCardsTemplate>
);
