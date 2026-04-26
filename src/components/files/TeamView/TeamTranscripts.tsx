import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { MoreVertical, Upload, FileText, Eye, Download, Trash2, ArrowUpDown, SearchIcon } from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';
import { Meeting } from '../../../services/api';
import Button from '../../../generic/Button';
import FileUpload from '../FileUpload';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import FileStats from '../FileStats';
import { C } from '../../../theme';

// Types
const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
    processed: { label: 'Completed', bgColor: 'bg-teal-600/20', textColor: 'text-teal-400' },
    ready: { label: 'Completed', bgColor: 'bg-teal-600/20', textColor: 'text-teal-400' },
    processing: { label: 'Processing', bgColor: 'bg-yellow-600/20', textColor: 'text-yellow-400' },
    queued: { label: 'Processing', bgColor: 'bg-yellow-600/20', textColor: 'text-yellow-400' },
    failed: { label: 'Failed', bgColor: 'bg-red-600/20', textColor: 'text-red-400' },
    pending: { label: 'Pending', bgColor: 'bg-gray-600/20', textColor: 'text-gray-400' },
};

// Source / Type helpers
function isUploadedDoc(meeting: Meeting): boolean {
    return !!meeting.file_path;
}

function isLiveMeeting(meeting: Meeting): boolean {
    return !meeting.file_path; //path === 'meeting'
}

function getSourceLabel(meeting: Meeting): string {
    return isUploadedDoc(meeting) ? ' Uploaded Doc' : ' Live Meeting';
}

// Format date for display
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

function getMeetingName(meeting: Meeting): string {
    if (meeting.title && meeting.title.trim()) {
        return meeting.title.trim();
    }

    if (meeting.file_path) {
        const fileName =
            meeting.file_path.split('/').pop() || meeting.file_path.split('\\').pop() || '';
        if (fileName) {
            return fileName.replace(/\.[^/.]+$/, '');
        }
    }

    return `Meeting ${meeting.meeting_id}`;
}

export default function TeamTranscripts() {
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { organization, memberships } = useOrganization({ memberships: { infinite: true } });

    // State
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
    const [dateSortDesc, setDateSortDesc] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const rowsPerPage = 10;

    const baseUrl = API_BASE_URL.replace(/\/api$/, '');

    // Create user lookup map from Clerk memberships
    const userNameMap = useMemo(() => {
        const map = new Map<string, string>();
        memberships?.data?.forEach(m => {
            const userData = m.publicUserData;
            if (userData?.userId) {
                const name = userData.firstName
                    ? `${userData.firstName} ${userData.lastName || ''}`.trim()
                    : userData.identifier || 'Unknown';
                map.set(userData.userId, name);
            }
        });
        return map;
    }, [memberships?.data]);

    // Fetch meetings (org-scoped token so backend returns this team's meetings)
    const fetchMeetings = useCallback(async () => {
        if (!organization?.id) {
            setMeetings([]);
            setLoading(false);
            return;
        }
        try {
            const token = await getToken({ organizationId: organization.id });
            if (!token) {
                setMeetings([]);
                setLoading(false);
                return;
            }
            const response = await fetch(`${API_BASE_URL}/v1/meetings`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setMeetings(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to fetch meetings:', error);
            toast.error('Failed to load meetings');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organization?.id]); // getToken is stable from Clerk

    // Initial load
    useEffect(() => {
        fetchMeetings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organization?.id]); // Only run when org changes

    // Refresh when meetings are updated elsewhere (e.g. from live Meetings page)
    useEffect(() => {
        const handleUpdated = () => {
            fetchMeetings();
        };
        window.addEventListener('meetings:updated', handleUpdated);
        return () => window.removeEventListener('meetings:updated', handleUpdated);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Event listener doesn't need to change

    // FUTURE TODO: handle delete meeting functionality
    const handleDelete = async (meetingId: number) => {
        toast.error("Delete meeting coming soon.");
        return;
    };

    // Get uploader name
    const getUploaderName = (userId: string): string => {
        return userNameMap.get(userId) || 'Unknown';
    };

    // Get status config
    const getStatusConfig = (status: string) => {
        return STATUS_CONFIG[status.toLowerCase()] || STATUS_CONFIG.pending;
    };

    const sortedMeetings = useMemo(() => {
        return [...meetings].sort((a, b) => {
            const dateA = new Date(a.meeting_date).getTime();
            const dateB = new Date(b.meeting_date).getTime();
            return dateSortDesc ? dateB - dateA : dateA - dateB;
        });
    }, [meetings, dateSortDesc]);

    const filteredMeetings = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return sortedMeetings;

        return sortedMeetings.filter((m) => {
            const title = (m.title || '').toLowerCase();
            const filePath = (m.file_path || '').toLowerCase();
            const platform = (m.source_platform || '').toLowerCase();
            const uploader = (getUploaderName(m.created_by) || '').toLowerCase();
            return (
                title.includes(query) ||
                filePath.includes(query) ||
                platform.includes(query) ||
                uploader.includes(query)
            );
        });
    }, [sortedMeetings, searchQuery, userNameMap]);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(filteredMeetings.length / rowsPerPage)),
        [filteredMeetings.length]
    );

    const paginatedMeetings = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredMeetings.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredMeetings, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [dateSortDesc, meetings.length, searchQuery]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
            setMenuAnchor(null);
        };
        if (openMenuId !== null) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [openMenuId]);

    const totalFiles = meetings.length;
    const totalLiveMeetings = useMemo(
        () => meetings.filter(m => !isUploadedDoc(m)).length,
        [meetings]
    );
    const totalUploadedTranscripts = useMemo(
        () => meetings.filter(m => isUploadedDoc(m)).length,
        [meetings]
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-gray-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            <FileStats
                totalFiles={totalFiles}
                totalLiveMeetings={totalLiveMeetings}
                totalUploadedTranscripts={totalUploadedTranscripts}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="w-full sm:max-w-md">
                    <InputGroup>
                        <InputGroupInput
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search"
                            className="text-black placeholder:text-gray-400"
                        />
                        <InputGroupAddon>
                            <SearchIcon className="text-muted-foreground" />
                        </InputGroupAddon>
                    </InputGroup>
                </div>
            </div>


            {/* Table */}
            <div className="rounded-xl border border-border overflow-visible bg-white">
                {meetings.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                        <FileText size={48} className=" mb-4 opacity-50 text-foreground" />
                        <p className="text-lg mb-2 font-medium text-foreground">No meetings yet</p>
                        <p className="text-sm">Upload a transcript to get started</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-muted">
                            <TableRow>
                                <TableHead className="px-6 text-left text-sm font-medium text-foreground">
                                    File name
                                </TableHead>
                                <TableHead className="px-4 text-left text-sm font-medium text-foreground">
                                    Source
                                </TableHead>
                                <TableHead className="px-4 text-left text-sm font-medium text-foreground">
                                    Uploaded by
                                </TableHead>
                                <TableHead className="px-4 text-left text-sm font-medium text-foreground whitespace-nowrap">
                                    <Button
                                        variant="secondary"
                                        onClick={() => setDateSortDesc(prev => !prev)}
                                        className="p-0 h-auto font-medium text-sm text-foreground hover:bg-transparent inline-flex items-center gap-2 whitespace-nowrap"
                                    >
                                        Date
                                        <ArrowUpDown className="h-4 w-4 text-foreground" />
                                    </Button>
                                </TableHead>
                                <TableHead className="px-4 text-right text-sm font-medium text-foreground">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedMeetings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                                        No transcripts match your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedMeetings.map(meeting => {
                                    return (
                                        <TableRow key={meeting.meeting_id} className="hover-bg transition-colors">
                                            <TableCell className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {(() => {
                                                        const iconColors = [C.teal, C.tealMuted, C.textDim, C.text, C.tealDeep, C.teal];
                                                        const iconBg = iconColors[meeting.meeting_id % iconColors.length];
                                                        return (
                                                            <div className="p-2 rounded" style={{ background: iconBg, color: C.bg }}><FileText size={16} /></div>
                                                        );
                                                    })()}
                                                    <span className="text-sm text-foreground font-medium truncate max-w-[220px]">
                                                        {getMeetingName(meeting)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-4">
                                                <span className="text-sm text-muted-foreground">
                                                    {getSourceLabel(meeting)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="px-4 py-4">
                                                <span className="text-sm text-foreground">
                                                    {getUploaderName(meeting.created_by)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="px-4 py-4">
                                                <span className="text-sm text-muted-foreground">
                                                    {formatDate(meeting.meeting_date)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="px-4 py-4 text-right">
                                                <div className="relative inline-block">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (openMenuId === meeting.meeting_id) {
                                                                setOpenMenuId(null);
                                                                setMenuAnchor(null);
                                                            } else {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const menuWidth = 160;
                                                                const menuHeight = 140;
                                                                const gap = 4;
                                                                let top = rect.bottom + gap;
                                                                if (top + menuHeight > window.innerHeight) {
                                                                    top = rect.top - menuHeight - gap;
                                                                }
                                                                top = Math.max(gap, Math.min(top, window.innerHeight - menuHeight - gap));
                                                                let left = rect.right - menuWidth;
                                                                left = Math.max(gap, Math.min(left, window.innerWidth - menuWidth - gap));
                                                                setMenuAnchor({ top, left });
                                                                setOpenMenuId(meeting.meeting_id);
                                                            }
                                                        }}
                                                        className="p-2 text-muted-foreground hover-bg rounded transition-colors"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {openMenuId === meeting.meeting_id && menuAnchor && (() => {
                                                        const meetingForMenu = paginatedMeetings.find(m => m.meeting_id === openMenuId);
                                                        if (!meetingForMenu) return null;
                                                        return createPortal(
                                                          <div
                                                            className="fixed w-40 bg-white border border-border rounded-lg shadow-xl z-[100] py-1"
                                                            style={{ top: menuAnchor.top, left: menuAnchor.left }}
                                                            onClick={(e) => e.stopPropagation()}
                                                          >
                                                            {/* Show view for live meeting: open team's Live meetings page */}
                                                            {isLiveMeeting(meetingForMenu) && (
                                                              <button
                                                                onClick={() => {
                                                                  setOpenMenuId(null);
                                                                  setMenuAnchor(null);
                                                                  const org = organization?.id ? `&org=${encodeURIComponent(organization.id)}` : '';
                                                                  navigate(`/meetings?tab=meetings${org}`);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover-bg" style={{ color: C.textSec }}
                                                              >
                                                                <Eye size={14} />
                                                                View
                                                              </button>
                                                            )}
                                                            {/* handle delete*/}
                                                            <button
                                                              onClick={() => handleDelete(meetingForMenu.meeting_id)}
                                                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                                                            >
                                                              <Trash2 size={14} />
                                                              Delete
                                                            </button>
                                                          </div>,
                                                            document.body
                                                        );
                                                    })()}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>

            {filteredMeetings.length > 0 && (
                <div className="flex items-center justify-between px-2 sm:px-0 mt-4 text-sm text-muted-foreground">
                    <div>
                        Showing{' '}
                        <span className="font-medium">
                            {(currentPage - 1) * rowsPerPage + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-medium">
                            {Math.min(currentPage * rowsPerPage, filteredMeetings.length)}
                        </span>{' '}
                        of <span className="font-medium">{filteredMeetings.length}</span> meetings
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover-bg" style={{ background: C.card, color: C.textSec }}
                        >
                            Previous
                        </button>
                        <span className="text-xs sm:text-sm">
                            Page <span className="font-medium">{currentPage}</span> of{' '}
                            <span className="font-medium">{totalPages}</span>
                        </span>
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover-bg" style={{ background: C.card, color: C.textSec }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Upload Modal — portaled so overlay fills entire viewport */}
            {showUploadModal &&
                createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                        <div className="w-full max-w-md mx-4">
                            <FileUpload
                                onClose={() => setShowUploadModal(false)}
                                onSuccess={() => {
                                    setShowUploadModal(false);
                                    fetchMeetings();
                                }}
                            />
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
