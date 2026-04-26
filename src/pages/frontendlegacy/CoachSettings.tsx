import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getProfile,
    deleteProfile,
    updatePreference,
    type CoachProfile,
} from '../services/coach';
import { C } from '../theme';
import { SectionCard } from '@/components/composition';
import { Skeleton } from '@/components/ui/skeleton';

const CONSENT_LABELS: Record<string, string> = {
    none: 'Do not use my meeting data',
    aggregated: 'Use aggregated trends only',
    private_coaching: 'Use for private coaching insights',
};

const MOTIVATION_LABELS: Record<string, string> = {
    results: 'Hitting targets and achieving results',
    growth: 'Learning and developing skills',
    confidence: 'Building confidence and making better decisions',
    support: 'Handling work stress and staying balanced',
};

const DIRECTNESS_LABELS: Record<string, string> = {
    gentle: 'Gentle and supportive',
    balanced: 'Balanced',
    direct: 'Direct and to the point',
};

const DETAIL_LABELS: Record<string, string> = {
    short: 'Short and concise',
    medium: 'Medium detail',
    detailed: 'Detailed and thorough',
};

export default function CoachSettings() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<CoachProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const data = await getProfile();
                setProfile(data);
            } catch (e) {
                navigate('/chat/onboarding');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [navigate]);

    const handleToggleDownshift = async () => {
        if (!profile) return;
        const newValue = !profile.preferences.never_ask_downshift;
        try {
            await updatePreference('never_ask_downshift', newValue, 'global');
            setProfile(prev => prev ? {
                ...prev,
                preferences: { ...prev.preferences, never_ask_downshift: newValue }
            } : null);
        } catch (e) {
            console.error('Failed to update preference:', e);
        }
    };

    const handleDelete = async () => {
        if (deleteConfirmText !== 'DELETE') return;
        setDeleting(true);
        try {
            await deleteProfile();
            navigate('/chat/onboarding');
        } catch (e) {
            console.error('Failed to delete profile:', e);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <SectionCard><Skeleton className="h-32 w-full" /></SectionCard>
                <SectionCard><Skeleton className="h-32 w-full" /></SectionCard>
                <SectionCard><Skeleton className="h-32 w-full" /></SectionCard>
            </div>
        );
    }

    if (!profile) {
        return null;
    }

    const commStyle = profile.profile?.communication_style as Record<string, string> || {};
    const motivation = profile.motivation as Record<string, number | string> || {};
    const jobDrivers = profile.job_drivers as Record<string, string> || {};

    return (
        <div className="max-w-2xl mx-auto">
                {/* Coaching Focus */}
                <SectionCard title="Your Coaching Focus" className="mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center">
                            <span className="text-2xl">&#x1F3AF;</span>
                        </div>
                        <div>
                            <p className="font-medium capitalize" style={{ color: C.text }}>
                                {MOTIVATION_LABELS[motivation.primary_driver as string] || motivation.primary_driver || 'Not set'}
                            </p>
                            <p className="text-sm" style={{ color: C.teal }}>Primary motivation</p>
                        </div>
                    </div>
                </SectionCard>

                {/* Communication Style */}
                <SectionCard title="Communication Preferences" className="mb-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span style={{ color: C.textSec }}>Directness</span>
                            <span style={{ color: C.teal }}>
                                {DIRECTNESS_LABELS[commStyle.directness] || commStyle.directness || 'Not set'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span style={{ color: C.textSec }}>Response Detail</span>
                            <span style={{ color: C.teal }}>
                                {DETAIL_LABELS[commStyle.detail_level] || commStyle.detail_level || 'Not set'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span style={{ color: C.textSec }}>Coaching Style</span>
                            <span className="capitalize" style={{ color: C.teal }}>
                                {(profile.profile as Record<string, string>)?.default_mode || 'support'} mode
                            </span>
                        </div>
                    </div>
                </SectionCard>

            {/* Job Context (if provided) */}
                {(jobDrivers.job_title || jobDrivers.department || jobDrivers.responsibilities) && (
                <SectionCard title="Job Context" className="mb-6">
                    <div className="space-y-3 text-sm">
                            {jobDrivers.job_title && (
                            <p><span style={{ color: C.textSec }}>Role:</span> <span style={{ color: C.teal }}>{String(jobDrivers.job_title)}</span></p>
                            )}
                            {jobDrivers.department && (
                            <p><span style={{ color: C.textSec }}>Department:</span> <span style={{ color: C.teal }}>{String(jobDrivers.department)}</span></p>
                            )}
                            {jobDrivers.responsibilities && (
                            <p><span style={{ color: C.textSec }}>Key Responsibilities:</span> <span style={{ color: C.teal }}>{String(jobDrivers.responsibilities)}</span></p>
                            )}
                    </div>
                </SectionCard>
                )}

            {/* Privacy & Preferences */}
            <SectionCard title="Privacy & Preferences" className="mb-6">
                <div className="space-y-4">
                    <div>
                        <span className="text-sm" style={{ color: C.textSec }}>Meeting data consent:</span>
                        <p style={{ color: C.text }}>{CONSENT_LABELS[profile.consent.meeting_trendlines] || profile.consent.meeting_trendlines}</p>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p style={{ color: C.text }}>Never ask to downshift</p>
                            <p className="text-sm" style={{ color: C.textSec }}>Disable stress detection prompts</p>
                        </div>
                        <button
                            onClick={handleToggleDownshift}
                            className="w-12 h-6 rounded-full transition"
                            style={{ background: profile.preferences.never_ask_downshift ? C.teal : C.border }}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition transform ${profile.preferences.never_ask_downshift ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                        </button>
                    </div>
                </div>
            </SectionCard>

            {/* Actions */}
            <section className="space-y-4">
                <button
                    onClick={() => navigate('/chat/onboarding')}
                    className="w-full py-3 rounded-xl transition hover-teal"
                    style={{ background: C.teal, color: C.white }}
                >
                    Re-take Questionnaire
                </button>

                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition"
                >
                    Delete All Coaching Data
                </button>
            </section>

            {/* Delete confirmation modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="max-w-md w-full mx-4">
                        <SectionCard>
                            <h3 className="text-xl font-bold mb-2" style={{ color: C.text }}>Delete All Coaching Data?</h3>
                            <p className="mb-4" style={{ color: C.textSec }}>
                                This will permanently delete your profile, all sessions, and preferences. This action cannot be undone.
                            </p>
                            <p className="mb-2" style={{ color: C.text }}>Type <code className="text-red-600 bg-red-50 px-1 py-0.5 rounded">DELETE</code> to confirm:</p>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                className="w-full p-3 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:border-transparent"
                                style={{ background: C.inputBg, border: `1px solid ${C.border}`, color: C.text }}
                                placeholder="Type DELETE"
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeleteConfirmText('');
                                    }}
                                    className="flex-1 py-2 rounded-lg transition hover-bg"
                                    style={{ background: C.bgSub, color: C.text }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleteConfirmText !== 'DELETE' || deleting}
                                    className="flex-1 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            )}
        </div>
    );
}
