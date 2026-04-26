import React, { useState, useRef } from 'react';
import { Monitor, Square, Volume2, ChevronDown, Info, AlertTriangle } from 'lucide-react';
import { C } from '../theme';

/**
 * @deprecated This component is deprecated. Tab audio capture logic has been
 * extracted to the useTabAudioCapture hook (SOPHIA/src/hooks/useTabAudioCapture.ts).
 * RecordStudio now handles all recording UI directly. This file is kept for
 * reference only and is not rendered anywhere in the app.
 */

interface DesktopRecorderProps {
    onUpload: (blob: Blob) => Promise<void>;
    isProcessing: boolean;
    disabled?: boolean;
}

const INFO_PANEL_STYLE = {
    background: `${C.teal}14`,
    borderColor: `${C.teal}33`,
};

const DesktopRecorder: React.FC<DesktopRecorderProps> = ({ onUpload, isProcessing, disabled }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingMode] = useState('System Audio + Microphone');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);

    const getSupportedMimeType = () => {
        const types = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4",
            "audio/ogg",
            "" // Fallback to browser default
        ];
        return types.find(type => MediaRecorder.isTypeSupported(type)) || "";
    };

    const startRecording = async () => {
        if (disabled) return;
        try {
            console.log("Attempting to get display media...");
            let displayStream: MediaStream;
            try {
                displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        displaySurface: "monitor",
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 44100
                    },
                    systemAudio: "include"
                } as any);
            } catch (e) {
                console.error("User cancelled or display media failed:", e);
                return;
            }

            console.log("Attempting to get mic media...");
            // Get microphone audio
            let micStream: MediaStream;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            } catch (e) {
                console.error("Mic access denied:", e);
                displayStream.getTracks().forEach(t => t.stop());
                alert("Microphone access is required for recording. Please enable it.");
                return;
            }

            const hasSystemAudio = displayStream.getAudioTracks().length > 0;
            console.log("System audio detected:", hasSystemAudio);

            let mixedStream: MediaStream;
            let audioContext: AudioContext | null = null;

            if (!hasSystemAudio) {
                alert("To record desktop audio, you MUST check the 'Share System Audio' box in the screen selection popup.");
                displayStream.getTracks().forEach(t => t.stop());
                micStream.getTracks().forEach(t => t.stop());
                setIsRecording(false);
                return;
            } else {
                // Mix them using AudioContext
                audioContext = new AudioContext();
                audioContextRef.current = audioContext;
                console.log("Mixing system and mic audio...");

                const dest = audioContext.createMediaStreamDestination();
                const micSource = audioContext.createMediaStreamSource(micStream);
                const displaySource = audioContext.createMediaStreamSource(displayStream);

                micSource.connect(dest);
                displaySource.connect(dest);
                mixedStream = dest.stream;
            }

            // MIME Type Sniffer
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : "audio/mp4";
            console.log("Using MIME type:", mimeType);

            const mediaRecorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    // console.log("Chunk received, size:", e.data.size);
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                console.log("Recorder stopped. Processing chunks...");
                const audioBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
                console.log("Final Blob size:", audioBlob.size);

                // Stop all tracks AFTER blob creation
                if (audioBlob.size === 0) {
                    alert("Recording failed: No audio data captured. Check permissions.");
                } else {
                    console.log("Uploading desktop recording...");
                    await onUpload(audioBlob);
                }

                // Cleanup
                setIsRecording(false);
                displayStream.getTracks().forEach(track => track.stop());
                micStream.getTracks().forEach(track => track.stop());
                if (hasSystemAudio && mixedStream !== micStream) {
                    mixedStream.getTracks().forEach(track => track.stop());
                }

                if (audioContext && audioContext.state !== 'closed') {
                    await audioContext.close();
                }
            };

            mediaRecorder.start(1000);
            console.log("MediaRecorder started");
            setIsRecording(true);
        } catch (err) {
            console.error("Error starting desktop recording:", err);
            alert("Could not start recording. Check device permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Pro Tip Box */}
            <div className="border rounded-xl p-4 flex gap-4 animate-in fade-in slide-in-from-top-4" style={INFO_PANEL_STYLE}>
                <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${C.teal}22`, color: C.teal }}>
                    <Info size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: C.teal }}>Pro Tip: Desktop Audio</h4>
                    <p className="text-sm mt-1 leading-relaxed" style={{ color: C.textSec }}>
                        To record external apps like Zoom or Teams, select <strong>'Entire Screen'</strong> in the popup and check <strong>'Share System Audio'</strong>.
                    </p>
                </div>
            </div>

            <div className="p-8 rounded-xl shadow-2xl relative overflow-hidden group" style={{ background: C.elevated, border: `1px solid ${C.border}` }}>
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-32 -mt-32 transition-colors" style={{ background: `${C.teal}12` }} />

                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight" style={{ color: C.text }}>Desktop Recorder</h2>
                        <p className="mt-1" style={{ color: C.textDim }}>Capture system audio and your microphone simultaneously.</p>

                        <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 w-fit border transition-colors cursor-pointer hover-bg" style={{ background: C.bgSub, borderColor: C.border }}>
                            <Volume2 size={16} style={{ color: C.teal }} />
                            <span className="text-sm font-medium" style={{ color: C.text }}>{recordingMode}</span>
                            <ChevronDown size={14} style={{ color: C.textDim }} />
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                        {!isRecording ? (
                            <button
                                onClick={startRecording}
                                disabled={isProcessing || disabled}
                                className={`h-16 w-16 rounded-full flex items-center justify-center transition-all relative group/btn ${disabled ? 'cursor-not-allowed' : 'hover:scale-110 active:scale-95'}`}
                                style={disabled
                                    ? { background: C.bgSub, color: C.textDim, boxShadow: 'none' }
                                    : { background: C.teal, color: C.white, boxShadow: `0 0 30px ${C.tealGlow}` }
                                }
                            >
                                <Monitor size={28} />
                                {!disabled && <div className="absolute inset-0 rounded-full blur-md opacity-0 group-hover/btn:opacity-50 transition-opacity" style={{ background: C.tealGlow }} />}
                            </button>
                        ) : (
                            <button
                                onClick={stopRecording}
                                className="h-16 w-16 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 animate-pulse"
                                style={{ background: C.red, color: C.white, boxShadow: `0 0 20px ${C.red}4d` }}
                            >
                                <Square size={28} />
                            </button>
                        )}
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] font-sans" style={{ color: isRecording ? C.red : C.teal }}>
                            {isRecording ? 'Recording...' : 'Start Recording'}
                        </span>
                    </div>
                </div>

                {/* Waveform Visualization Placeholder */}
                {isRecording && (
                    <div className="mt-8 h-12 flex items-center justify-center gap-1.5 overflow-hidden">
                        {[...Array(32)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1.5 rounded-full animate-waveform"
                                style={{
                                    background: `${C.teal}80`,
                                    height: `${30 + Math.random() * 70}%`,
                                    animationDelay: `${i * 0.03}s`,
                                    animationDuration: `${0.4 + Math.random() * 0.4}s`
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DesktopRecorder;
