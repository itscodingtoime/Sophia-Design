import { createContext, useContext, useState, ReactNode } from 'react';

// Reusing interfaces from MeetingIntelligence logic, but we can centralize them or just redefine here for now to avoid circular deps if types are in component.
// Better to put types in a types file, but for speed, I'll redefine compatible types.

export interface Sentence {
    text: string;
    sentiment: string;
    speaker: string;
    confidence: number;
    start?: number;
    end?: number;
}

export interface AnalysisResult {
    text: string;
    sentences: Sentence[];
    breakdown: {
        positive: number;
        negative: number;
        neutral: number;
    };
    dominant_tone: string;
    conversation_dynamics?: any;
    created_at?: string;
    empowerment?: {
        overall_ownership_score: number;
        overall_invitation_score: number;
        sentence_labels?: any[];
    };
}

interface MeetingContextType {
    result: AnalysisResult | null;
    dynamics: any;
    isRecording: boolean;
    isProcessing: boolean;
    audioUrl: string | null;
    selectedMeetingTitle: string | null;

    setResult: (data: AnalysisResult | null) => void;
    setDynamics: (data: any) => void;
    setIsRecording: (isRecording: boolean) => void;
    setIsProcessing: (isProcessing: boolean) => void;
    setAudioUrl: (url: string | null) => void;
    setSelectedMeetingTitle: (title: string | null) => void;

    // Helper to clear all meeting data (e.g. when starting fresh)
    clearMeetingData: () => void;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

export const useMeeting = () => {
    const context = useContext(MeetingContext);
    if (!context) {
        throw new Error('useMeeting must be used within a MeetingProvider');
    }
    return context;
};

export const MeetingProvider = ({ children }: { children: ReactNode }) => {
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [dynamics, setDynamics] = useState<any>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [selectedMeetingTitle, setSelectedMeetingTitle] = useState<string | null>(null);

    const clearMeetingData = () => {
        setResult(null);
        setDynamics(null);
        setAudioUrl(null);
        setSelectedMeetingTitle(null);
        setIsRecording(false);
        setIsProcessing(false);
    };

    return (
        <MeetingContext.Provider value={{
            result,
            dynamics,
            isRecording,
            isProcessing,
            audioUrl,
            selectedMeetingTitle,
            setResult,
            setDynamics,
            setIsRecording,
            setIsProcessing,
            setAudioUrl,
            setSelectedMeetingTitle,
            clearMeetingData
        }}>
            {children}
        </MeetingContext.Provider>
    );
};
