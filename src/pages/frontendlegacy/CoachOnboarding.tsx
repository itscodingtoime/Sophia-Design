import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getQuestionnaire,
    getDraft,
    saveDraft,
    submitQuestionnaire,
    type Question,
    type Questionnaire,
    type QuestionnaireSection
} from '../services/coach';
import { C, useThemeMode } from '../theme';
import { SophiaPageHeader, SectionCard, EmptyStateCard } from '@/components/composition';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

// Section labels for v1 format
const V1_SECTION_LABELS: Record<string, string> = {
    communication: 'Communication Style',
    coaching_cadence: 'Coaching Cadence',
    job_drivers: 'Your Role & Goals',
    motivation: 'What Drives You',
    values: 'Values & Boundaries',
    feedback: 'Feedback Preferences',
    stress: 'Stress & Support',
    consent: 'Privacy & Consent',
};

// Normalize questionnaire to a common format for rendering
interface NormalizedSection {
    id: string;
    title: string;
    description?: string;
    questions: Question[];
}

function normalizeQuestionnaire(q: Questionnaire): NormalizedSection[] {
    if (!q) return []; // Safety check

    const hasObjectSections = Array.isArray(q.sections) && q.sections.length > 0 && typeof q.sections[0] === 'object';
    const hasStringSections = Array.isArray(q.sections) && q.sections.length > 0 && typeof q.sections[0] === 'string';
    const hasFlatQuestions = Array.isArray(q.questions);

    // V2 format: sections is an array of objects with id, title, questions
    if (hasObjectSections) {
        return (q.sections as unknown as QuestionnaireSection[]).map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            // FIX: Added || [] to ensure this never returns undefined
            questions: s.questions || []
        }));
    }

    // V1 format (or V2 mismatch): sections is string[], questions is flat array with section field
    if (hasStringSections && hasFlatQuestions) {
        const sectionStrings = q.sections as string[];
        return sectionStrings.map(sectionId => ({
            id: sectionId,
            title: V1_SECTION_LABELS[sectionId] || sectionId,
            questions: (q.questions || []).filter(question => question.section === sectionId)
        }));
    }

    // Fallback: if questions are flat but sections missing/malformed, group by question.section
    if (hasFlatQuestions) {
        const sectionIds = Array.from(
            new Set((q.questions || []).map(question => question.section).filter(Boolean))
        ) as string[];
        return sectionIds.map(sectionId => ({
            id: sectionId,
            title: V1_SECTION_LABELS[sectionId] || sectionId,
            questions: (q.questions || []).filter(question => question.section === sectionId)
        }));
    }

    return [];
}

// Get option value (handles both string and {value, label} formats)
function getOptionValue(opt: string | { value: string; label: string }): string {
    return typeof opt === 'string' ? opt : opt.value;
}

// Get option label (handles both string and {value, label} formats)
function getOptionLabel(opt: string | { value: string; label: string }): string {
    return typeof opt === 'string' ? opt : opt.label;
}

export default function CoachOnboarding() {
    useThemeMode(); // subscribe to theme changes so C.* inline styles re-render
    const navigate = useNavigate();
    const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
    const [normalizedSections, setNormalizedSections] = useState<NormalizedSection[]>([]);
    const [responses, setResponses] = useState<Record<string, unknown>>({});
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load questionnaire and draft
    useEffect(() => {
        async function load() {
            try {
                const data = await getQuestionnaire();
                // FIX: Added safety check for data integrity
                if (!data || !data.questionnaire) {
                    throw new Error("Invalid questionnaire data received");
                }

                console.log('Questionnaire version:', data.questionnaire.version);
                setQuestionnaire(data.questionnaire);

                const sections = normalizeQuestionnaire(data.questionnaire);
                setNormalizedSections(sections);

                // Check for existing draft - only use if version matches
                const draft = await getDraft();
                if (draft && draft.version === data.questionnaire.version) {
                    setResponses(draft.responses || {}); // Ensure responses is object
                    const sectionIndex = sections.findIndex(s => s.id === draft.current_section);
                    if (sectionIndex >= 0) setCurrentSectionIndex(sectionIndex);
                }
            } catch (e) {
                console.error("Load error:", e);
                setError('Failed to load questionnaire');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // Auto-save draft on section change
    const saveCurrentDraft = useCallback(async () => {
        if (normalizedSections.length === 0) return;
        try {
            await saveDraft(responses, normalizedSections[currentSectionIndex].id);
        } catch (e) {
            console.error('Draft save failed:', e);
        }
    }, [normalizedSections, responses, currentSectionIndex]);

    useEffect(() => {
        const timeout = setTimeout(saveCurrentDraft, 2000);
        return () => clearTimeout(timeout);
    }, [responses, saveCurrentDraft]);

    if (loading) {
        return (
            <div className="py-6 px-4">
                <div className="max-w-2xl mx-auto">
                    <SophiaPageHeader title="SOPHIA Onboarding" />
                    <SectionCard>
                        <div className="space-y-4">
                            <Skeleton className="h-8 w-1/3" />
                            <Skeleton className="h-48 w-full" />
                        </div>
                    </SectionCard>
                </div>
            </div>
        );
    }

    if (error || !questionnaire || normalizedSections.length === 0) {
        return (
            <div className="py-6 px-4">
                <div className="max-w-2xl mx-auto">
                    <SophiaPageHeader title="SOPHIA Onboarding" />
                    <SectionCard>
                        <EmptyStateCard
                            icon={<AlertCircle size={48} />}
                            title="Failed to load"
                            description={error || 'Failed to load questionnaire'}
                            action={
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-4 py-2 rounded-lg transition hover-teal"
                                    style={{ background: C.teal, color: C.white }}
                                >
                                    Try Again
                                </button>
                            }
                        />
                    </SectionCard>
                </div>
            </div>
        );
    }

    const currentSection = normalizedSections[currentSectionIndex] || { id: '', title: '', questions: [] };

    // FIX: Added (currentSection.questions || []) to prevent crash if questions is undefined
    const currentQuestions = (currentSection.questions || []).filter(q => {
        if (!q.conditional_on) return true;
        for (const [qId, expectedVal] of Object.entries(q.conditional_on)) {
            const answer = responses[qId];
            if (Array.isArray(expectedVal)) {
                if (!expectedVal.includes(answer as string)) return false;
            } else if (answer !== expectedVal) {
                return false;
            }
        }
        return true;
    });

    const handleChange = (questionId: string, value: unknown) => {
        // FIX: Removed the manual scrollY logic entirely.
        // This was causing the "Jump" / "Scroll Up" behavior.
        setResponses(prev => ({ ...prev, [questionId]: value }));
    };

    const canProceed = currentQuestions.every(q => {
        if (!q.required) return true;
        const val = responses[q.id];
        if (val === undefined || val === null || val === '') return false;
        if (Array.isArray(val) && val.length === 0) return false;
        return true;
    });

    const handleNext = async () => {
        await saveCurrentDraft();
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Smooth scroll to top ONLY on section change
        if (currentSectionIndex < normalizedSections.length - 1) {
            setCurrentSectionIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (currentSectionIndex > 0) {
            setCurrentSectionIndex(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            console.log('Submitting questionnaire...', { version: questionnaire.version, responses });
            const result = await submitQuestionnaire(questionnaire.version, responses);
            console.log('Submission successful!', result);
            navigate('/chat');
        } catch (e) {
            console.error('Submission failed:', e);
            setError('Failed to submit questionnaire. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const isLastSection = currentSectionIndex === normalizedSections.length - 1;
    const progress = ((currentSectionIndex + 1) / normalizedSections.length) * 100;
    const sectionsRemaining = normalizedSections.length - currentSectionIndex;
    const estimatedMinutes = Math.ceil(sectionsRemaining * 0.5);

    return (
        <div className="py-6 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <SophiaPageHeader title="SOPHIA Onboarding" />

                {/* Progress bar */}
                <div className="mb-8">
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>Step {currentSectionIndex + 1} of {normalizedSections.length}</span>
                        <span>~{estimatedMinutes} min left</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all duration-300"
                            style={{ background: `linear-gradient(to right, ${C.teal}, ${C.tealMuted})`, width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Questions */}
                <SectionCard title={currentSection.title} subtitle={currentSection.description} className="mb-6">
                    <div className="space-y-6" style={{ minHeight: '500px' }}>
                        {currentQuestions.map(q => (
                            <QuestionField
                                key={q.id}
                                question={q}
                                value={responses[q.id]}
                                onChange={(val) => handleChange(q.id, val)}
                            />
                        ))}
                    </div>
                </SectionCard>

                {/* Navigation */}
                <div className="flex justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={currentSectionIndex === 0}
                        className="px-6 py-2 rounded-lg bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition"
                    >
                        Previous
                    </button>

                    {isLastSection ? (
                        <button
                            onClick={handleSubmit}
                            disabled={!canProceed || submitting}
                            className="px-6 py-2 rounded-lg bg-teal-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-teal-500 transition"
                        >
                            {submitting ? 'Submitting...' : 'Complete Setup'}
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed}
                            className="px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition hover-teal"
                            style={{ background: C.teal, color: C.white }}
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function QuestionField({
    question,
    value,
    onChange
}: {
    question: Question;
    value: unknown;
    onChange: (val: unknown) => void;
}) {
    switch (question.type) {
        case 'single_choice':
        case 'radio':
            return (
                <div>
                    <label className="block font-medium mb-3" style={{ color: C.text }}>{question.text}</label>
                    <div className="space-y-3">
                        {question.options?.map(opt => {
                            const optValue = getOptionValue(opt);
                            const optLabel = getOptionLabel(opt);
                            return (
                                <label
                                    key={`${question.id}-${optValue}`}
                                    className="block px-4 py-3 rounded-lg border-2 cursor-pointer transition-all"
                                    style={{
                                        borderColor: value === optValue ? C.teal : C.border,
                                        background: value === optValue ? C.tealDeep : C.card,
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name={`${question.id}-group`}
                                        value={optValue}
                                        checked={value === optValue}
                                        onChange={() => onChange(optValue)}
                                        className="absolute opacity-0 w-0 h-0" // FIX: Ensure it doesn't take up layout space
                                    />
                                    <span className="leading-relaxed" style={{ color: C.text }}>{optLabel}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            );

        case 'multi_choice':
        case 'checkbox':
            const selected = (value as string[]) || [];
            return (
                <div>
                    <label className="block font-medium mb-3" style={{ color: C.text }}>{question.text}</label>
                    <div className="space-y-3">
                        {question.options?.map(opt => {
                            const optValue = getOptionValue(opt);
                            const optLabel = getOptionLabel(opt);
                            const isSelected = selected.includes(optValue);
                            const validation = question.validation as Record<string, number> | undefined;
                            const maxSelections = validation?.max_selections;
                            const isMaxed = !!(maxSelections && selected.length >= maxSelections && !isSelected);

                            return (
                                <label
                                    key={optValue}
                                    className={`block px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${isMaxed && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    style={{
                                        borderColor: isSelected ? C.teal : C.border,
                                        background: isSelected ? C.tealDeep : C.card,
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        disabled={isMaxed}
                                        onChange={() => {
                                            if (isSelected) {
                                                onChange(selected.filter(s => s !== optValue));
                                            } else if (!isMaxed) {
                                                onChange([...selected, optValue]);
                                            }
                                        }}
                                        className="absolute opacity-0 w-0 h-0" // FIX: Ensure it doesn't take up layout space
                                    />
                                    <span className="leading-relaxed" style={{ color: C.text }}>{optLabel}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            );

        case 'likert':
        case 'rating':
            return (
                <div>
                    <label className="block font-medium mb-3" style={{ color: C.text }}>{question.text}</label>
                    <div className="flex gap-2 flex-wrap">
                        {question.options?.map(opt => {
                            const optValue = getOptionValue(opt);
                            return (
                                <button
                                    type="button" // FIX: Explicit type to prevent form submission behavior
                                    key={optValue}
                                    onClick={() => onChange(optValue)}
                                    className={`
                                    w-14 h-14 rounded-lg border-2
                                    text-lg font-semibold transition-all
                                `}
                                    style={{
                                        borderColor: value === optValue ? C.teal : C.border,
                                        background: value === optValue ? C.tealDeep : C.card,
                                        color: C.text,
                                        fontFamily: "'JetBrains Mono', monospace",
                                    }}
                                >
                                    {optValue}
                                </button>
                            );
                        })}
                    </div>
                </div>
            );

        case 'text':
            return (
                <div>
                    <label className="block text-gray-200 mb-3">{question.text}</label>
                    <textarea
                        value={(value as string) || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full p-4 rounded-lg border-2 focus:outline-none resize-none transition-colors"
                        style={{ borderColor: C.border, color: C.text, background: C.card }}
                        rows={4}
                        placeholder="Type your answer..."
                    />
                </div>
            );

        default:
            return null;
    }
}
