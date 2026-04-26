import { useState, useEffect, useCallback } from 'react';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import { toast } from 'react-toastify';
import { FileText, Mic, Calendar, ChevronRight, Pencil, Check, X } from 'lucide-react';
import { API_BASE_URL } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { C } from '../../theme';

// Types
interface UploadedMeeting {
    meeting_id: number;
    org_id: string;
    created_by: string;
    meeting_date: string;
    source_platform: string | null;
    title: string | null;
    file_path: string | null;
    processed_status: string;
}

interface RecordedMeeting {
    id: string; // UUID from Supabase
    created_at: string;
    title: string | null;
    dominant_tone: string;
}

interface UnifiedMeeting {
    id: string | number;
    title: string;
    date: string;
    source: 'upload' | 'recording';
    status: string;
    originalData: UploadedMeeting | RecordedMeeting;
}

export default function AllTranscripts() {
    const { getToken } = useAuth();
    const { organization } = useOrganization();
    const navigate = useNavigate();

    const [meetings, setMeetings] = useState<UnifiedMeeting[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit State
    const [editingId, setEditingId] = useState<string | number | null>(null);
    const [editTitle, setEditTitle] = useState("");

    // Fetch Data
    const fetchData = useCallback(async () => {
        if (!organization?.id) return;

        setLoading(true);
        try {
            const token = await getToken();
            const baseUrl = API_BASE_URL.replace(/\/api$/, ''); // For recorded meetings

            // 1. Fetch Uploaded Meetings (/v1/meetings)
            const uploadedPromise = fetch(`${API_BASE_URL}/v1/meetings`, {
                headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.ok ? r.json() : []);

            // 2. Fetch Recorded Meetings (/meetings/{org_id})
            const recordedPromise = fetch(`${baseUrl}/meetings/${organization.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.ok ? r.json() : []);

            const [uploadedData, recordedData] = await Promise.all([uploadedPromise, recordedPromise]);

            // 3. Normalize & Merge
            const unified: UnifiedMeeting[] = [];

            // Process Uploaded
            if (Array.isArray(uploadedData)) {
                uploadedData.forEach((m: UploadedMeeting) => {
                    unified.push({
                        id: m.meeting_id,
                        title: m.title || `Uploaded Transcript`,
                        date: m.meeting_date,
                        source: 'upload',
                        status: m.processed_status,
                        originalData: m
                    });
                });
            }

            // Process Recorded
            if (Array.isArray(recordedData)) {
                // Sort by date ASCENDING purely for loop to assign "Meeting #X" accurately (oldest is #1)
                const sortedRecorded = [...recordedData].sort((a, b) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );

                sortedRecorded.forEach((m: RecordedMeeting, index) => {
                    const fallbackTitle = `Meeting ${index + 1}`;
                    const displayTitle = (m.title && m.title !== "Untitled Recording" && m.title.trim() !== "")
                        ? m.title
                        : fallbackTitle;

                    unified.push({
                        id: m.id,
                        title: displayTitle,
                        date: m.created_at,
                        source: 'recording',
                        status: 'Analysed',
                        originalData: m
                    });
                });
            }

            // Sort by Date Descending for display
            unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setMeetings(unified);

        } catch (error) {
            console.error("Failed to fetch all transcripts:", error);
            toast.error("Failed to load transcripts history");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organization?.id]); // getToken is stable from Clerk

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organization?.id]); // Only re-fetch when org changes

    const handleRename = async (id: string | number, source: 'upload' | 'recording', newTitle: string) => {
        try {
            const token = await getToken();
            const baseUrl = API_BASE_URL.replace(/\/api$/, '');

            if (source === 'recording') {
                const res = await fetch(`${baseUrl}/meetings/${id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ title: newTitle })
                });

                if (res.ok) {
                    toast.success("Meeting renamed");
                    setEditingId(null);
                    fetchData(); // Refresh list
                } else {
                    toast.error("Failed to rename meeting");
                }
            } else {
                // Uploaded meeting renaming (if backend supports it, otherwise placeholder)
                toast.info("Renaming uploads is currently read-only in this view.");
                setEditingId(null);
            }

        } catch (error) {
            console.error("Rename failed", error);
            toast.error("Rename failed");
        }
    };

    // Formatters
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-gray-400 animate-pulse">Loading transcripts...</div>
            </div>
        );
    }

    return (
        <div className="rounded-xl overflow-hidden" style={{ background: C.bgSub, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
            {meetings.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                    <p className="text-lg mb-2">No transcripts found</p>
                    <p className="text-sm opacity-50">Uploaded files and recordings will appear here.</p>
                </div>
            ) : (
                <div className="w-full">
                    {/* Header Row */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/10 bg-white/5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                        <div className="col-span-10 md:col-span-5">Transcript Name</div>
                        <div className="col-span-2 hidden md:block">Source</div>
                        <div className="col-span-3 hidden md:block">Date</div>
                        <div className="col-span-2 md:col-span-2 text-right">Actions</div>
                    </div>

                    {/* List */}
                    <div className="divide-y divide-white/5">
                        {meetings.map((meeting) => (
                            <div
                                key={`${meeting.source}-${meeting.id}`}
                                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-white/5 transition-colors items-center group cursor-pointer relative"
                                onClick={(e) => {
                                    // Prevent navigation if clicking edit controls
                                    if ((e.target as HTMLElement).closest('.edit-control')) return;

                                    if (meeting.source === 'upload') {
                                        navigate(`/meetings?tab=meetings&meetingId=${meeting.id}`);
                                    } else {
                                        // Live/recorded: go to meetings tab with this meeting
                                        navigate(`/meetings?tab=meetings&meetingId=${meeting.id}`);
                                    }
                                }}
                            >
                                <div className="col-span-10 md:col-span-5 flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${meeting.source === 'recording'
                                        ? 'bg-blue-500/10 text-blue-400'
                                        : 'bg-transparent'
                                        }`}>
                                        {meeting.source === 'recording' ? (
                                            <Mic size={20} />
                                        ) : (
                                            <FileText size={20} />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        {editingId === meeting.id && meeting.source === 'recording' ? (
                                            <div className="flex items-center gap-2 edit-control" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="text"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    className="bg-black/20 border border-white/20 rounded px-2 py-1 text-sm text-white w-full max-w-[200px] focus:outline-none focus:border-teal-500"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRename(meeting.id, meeting.source, editTitle);
                                                        if (e.key === 'Escape') setEditingId(null);
                                                    }}
                                                />
                                                <button onClick={() => handleRename(meeting.id, meeting.source, editTitle)} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                                                <button onClick={() => setEditingId(null)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <div className="group/title flex items-center gap-2">
                                                <h3 className="text-white font-medium truncate text-sm">
                                                    {meeting.title}
                                                </h3>
                                                {meeting.source === 'recording' && (
                                                    <button
                                                        className="edit-control opacity-0 group-hover/title:opacity-100 text-gray-500 hover:text-white transition-opacity"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingId(meeting.id);
                                                            setEditTitle(meeting.title);
                                                        }}
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex md:hidden items-center gap-2 mt-1 text-xs text-gray-500">
                                            <span className="capitalize">{meeting.source}</span>
                                            <span>•</span>
                                            <span>{formatDate(meeting.date)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2 hidden md:flex items-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${meeting.source === 'recording'
                                        ? 'bg-blue-500/5 text-blue-400 border-blue-500/20'
                                        : 'bg-transparent border-current'
                                        }`}>
                                        {meeting.source === 'recording' ? 'Recorded' : 'Uploaded'}
                                    </span>
                                </div>

                                <div className="col-span-3 hidden md:flex items-center text-sm text-gray-400">
                                    <Calendar size={14} className="mr-2 opacity-70" />
                                    {formatDate(meeting.date)}
                                </div>

                                <div className="col-span-2 text-right">
                                    <button className="text-gray-500 hover:text-white transition-colors p-2">
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
