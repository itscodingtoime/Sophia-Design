import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Download, Loader2, BarChart3, MessageSquare, User, Volume2 } from 'lucide-react';
import Button from '../generic/Button';
import { C, useThemeMode } from '../theme';

interface Sentence {
    text: string;
    sentiment: string;
    speaker: string;
    confidence: number;
}

interface AnalysisResult {
    text: string;
    sentences: Sentence[];
    breakdown: {
        positive: number;
        negative: number;
        neutral: number;
    };
    dominant_tone: string;
}

const SENTIMENT_STYLES = {
    positive: { background: `${C.green}14`, color: C.green },
    negative: { background: `${C.red}14`, color: C.red },
    neutral: { background: C.bgSub, color: C.textSec },
};

const VoiceInput = () => {
    useThemeMode();
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Cleanup audio URL on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
                await uploadAudio(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setResult(null);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsProcessing(true);
        }
    };

    const uploadAudio = async (blob: Blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');

        try {
            const response = await fetch('http://localhost:8000/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Transcription failed');
            }

            const data = await response.json();
            setResult(data);
        } catch (err: any) {
            console.error("Upload error:", err);
            alert(`Transcription Error: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadTranscript = () => {
        if (!result) return;
        const element = document.createElement("a");
        const file = new Blob([result.text], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = "meeting-transcript.txt";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    // Group sentences by speaker for the "Pro" view
    const groupSentencesBySpeaker = (sentences: Sentence[]) => {
        if (!sentences || sentences.length === 0) return [];

        const groups: { speaker: string; sentences: Sentence[] }[] = [];
        let currentGroup: { speaker: string; sentences: Sentence[] } | null = null;

        sentences.forEach((sentence) => {
            if (!currentGroup || currentGroup.speaker !== sentence.speaker) {
                currentGroup = {
                    speaker: sentence.speaker,
                    sentences: [sentence]
                };
                groups.push(currentGroup);
            } else {
                currentGroup.sentences.push(sentence);
            }
        });

        return groups;
    };

    const getSentimentStyles = (sentiment: string) => {
        switch (sentiment) {
            case 'POSITIVE':
                return SENTIMENT_STYLES.positive;
            case 'NEGATIVE':
                return SENTIMENT_STYLES.negative;
            default:
                return SENTIMENT_STYLES.neutral;
        }
    };

    const speakerGroups = result ? groupSentencesBySpeaker(result.sentences) : [];

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-12">
            <div className="flex justify-between items-center p-8 rounded-xl shadow-2xl relative overflow-hidden group" style={{ background: C.elevated, border: `1px solid ${C.border}` }}>
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-32 -mt-32 transition-colors" style={{ background: C.tealGlow }} />
                <div className="relative z-10">
                    <h1 className="text-4xl font-bold tracking-tight" style={{ color: C.text }}>Meeting Intelligence</h1>
                    <p className="mt-2 text-lg" style={{ color: C.textDim }}>Real-time sentiment and speaker analysis for your meetings.</p>
                </div>
                {!isRecording ? (
                    <div className="flex flex-col items-center gap-2 relative z-10">
                        <button
                            onClick={startRecording}
                            disabled={isProcessing}
                            className="h-20 w-20 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                            style={{ background: C.teal, color: C.white, boxShadow: `0 0 30px ${C.tealGlow}` }}
                        >
                            <Mic size={32} />
                        </button>
                        <span className="text-xs font-bold tracking-widest" style={{ color: C.teal }}>Start Recording</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 relative z-10">
                        <button
                            onClick={stopRecording}
                            className="h-20 w-20 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 animate-pulse"
                            style={{ background: C.red, color: C.white, boxShadow: `0 0 30px ${C.red}66` }}
                        >
                            <Square size={32} />
                        </button>
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.red }}>Stop Recording</span>
                    </div>
                )}
            </div>

            {isProcessing && (
                <div className="flex flex-col items-center justify-center py-24 rounded-xl border-dashed" style={{ background: C.elevated, border: `1px solid ${C.border}` }}>
                    <div className="relative">
                        <Loader2 className="animate-spin mb-4" size={56} style={{ color: C.teal }} />
                        <div className="absolute inset-0 blur-xl animate-pulse" style={{ background: C.tealGlow }} />
                    </div>
                    <p className="text-2xl font-bold mt-4" style={{ color: C.text }}>AI Insight Engine is Hubbing...</p>
                    <p className="mt-2 text-lg" style={{ color: C.textDim }}>Analyzing speaker turns and sentiment nuances</p>
                </div>
            )}

            {result && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-6 duration-700">
                    {/* Analysis Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="p-6 rounded-xl shadow-xl" style={{ background: C.elevated, border: `1px solid ${C.border}` }}>
                            <div className="flex items-center gap-3 mb-4">
                                <BarChart3 size={20} style={{ color: C.teal }} />
                                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.textDim }}>Dominant Tone</h3>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-3xl font-black tracking-tight" style={{ color: result.dominant_tone === 'POSITIVE' ? C.green : result.dominant_tone === 'NEGATIVE' ? C.red : C.textDim }}>
                                    {result.dominant_tone === 'POSITIVE' ? 'High Energy' :
                                        result.dominant_tone === 'NEGATIVE' ? 'Critical' : 'Balanced'}
                                </span>
                                <p className="text-sm mt-3 leading-relaxed" style={{ color: C.textDim }}>
                                    Based on {result.sentences.length} analyzed sentences.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 rounded-xl shadow-xl" style={{ background: C.elevated, border: `1px solid ${C.border}` }}>
                            <h3 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: C.textDim }}>Sentiment Breakdown</h3>
                            <div className="space-y-5">
                                {[
                                    { label: 'Positive', count: result.breakdown.positive, styles: SENTIMENT_STYLES.positive },
                                    { label: 'Negative', count: result.breakdown.negative, styles: SENTIMENT_STYLES.negative },
                                    { label: 'Neutral', count: result.breakdown.neutral, styles: SENTIMENT_STYLES.neutral },
                                ].map((item) => {
                                    const total = result.breakdown.positive + result.breakdown.negative + result.breakdown.neutral;
                                    const percentage = total > 0 ? (item.count / total) * 100 : 0;
                                    return (
                                        <div key={item.label} className="space-y-2">
                                            <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
                                                <span style={{ color: item.styles.color }}>{item.label}</span>
                                                <span style={{ color: C.textDim }}>{Math.round(percentage)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: C.bgSub }}>
                                                <div
                                                    className="h-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${percentage}%`, background: item.styles.color }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Transcript Viewer */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Audio Playback Box */}
                        {audioUrl && (
                            <div className="p-4 rounded-xl shadow-xl flex items-center gap-4 animate-in slide-in-from-top-4" style={{ background: C.elevated, border: `1px solid ${C.border}` }}>
                                <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: C.bgSub, color: C.teal }}>
                                    <Volume2 size={20} />
                                </div>
                                <audio controls src={audioUrl} className="flex-1 h-10" style={{ accentColor: C.teal }} />
                            </div>
                        )}

                        <div className="rounded-xl shadow-xl flex flex-col overflow-hidden" style={{ background: C.elevated, border: `1px solid ${C.border}` }}>
                            <div className="p-6 flex justify-between items-center" style={{ borderBottom: `1px solid ${C.border}`, background: C.hoverBg }}>
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: C.tealDeep }}>
                                        <MessageSquare size={18} style={{ color: C.teal }} />
                                    </div>
                                    <h3 className="font-bold tracking-tight" style={{ color: C.text }}>Intelligence Transcript</h3>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={downloadTranscript} variant="secondary" className="flex items-center gap-2 text-xs py-2 h-9 px-4" style={{ borderColor: C.border, color: C.text }}>
                                        <Download size={14} /> Export .txt
                                    </Button>
                                </div>
                            </div>

                            <div className="p-8 h-[600px] overflow-y-auto custom-scrollbar space-y-8" style={{ background: C.bgSub }}>
                                {speakerGroups.length > 0 ? (
                                    speakerGroups.map((group, idx) => (
                                        <div key={idx} className="flex gap-4 group">
                                            <div className="flex-shrink-0">
                                                <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg transition-all" style={{ background: C.elevated, border: `1px solid ${C.border}`, color: C.textDim }}>
                                                    <User size={20} />
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: C.teal }}>{group.speaker}</span>
                                                    <div className="h-[1px] flex-1" style={{ background: C.border }} />
                                                </div>
                                                <div className="text-lg leading-relaxed font-light">
                                                    {group.sentences.map((sentence, sIdx) => (
                                                        <span
                                                            key={sIdx}
                                                            className="transition-colors duration-500 mr-1.5 px-1 rounded-sm"
                                                            style={getSentimentStyles(sentence.sentiment)}
                                                            title={`Sentiment: ${sentence.sentiment}`}
                                                        >
                                                            {sentence.text}{' '}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center" style={{ color: C.textDim }}>
                                        <MessageSquare size={48} className="mb-4 opacity-10" />
                                        <p>No transcription data available.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoiceInput;
