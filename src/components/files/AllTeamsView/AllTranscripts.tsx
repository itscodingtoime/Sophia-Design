import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth, useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { toast } from 'sonner';
import {
    MoreVertical,
    FileText,
    Eye,
    Download,
    Trash2,
    ArrowUpDown,
    SearchIcon,
    Users,
} from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';
import { Meeting } from '../../../services/api';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import FileStats from '../FileStats';
import { C } from '../../../theme';

function isUploadedDoc(meeting: Meeting): boolean {
    return !!meeting.file_path;
}

function isLiveMeeting(meeting: Meeting): boolean {
    return !meeting.file_path;
}

function getSourceLabel(meeting: Meeting): string {
    return isUploadedDoc(meeting) ? 'Uploaded Doc' : ' Live Meeting';
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-AU', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
}

function toDateKey(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toISOString().slice(0, 10);
}
function sameTitle(a: string | null | undefined, b: string | null | undefined): boolean {
    return ((a ?? '').trim().toLowerCase()) === ((b ?? '').trim().toLowerCase());
}

function getMeetingName(meeting: Meeting): string {
    if (meeting.title?.trim()) return meeting.title.trim();
    if (meeting.file_path) {
        const fileName = meeting.file_path.split(/[/\\]/).pop() || '';
        return fileName.replace(/\.[^/.]+$/, '');
    }
    return `Meeting ${meeting.meeting_id}`;
}

export default function AllTranscripts() {
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { memberships } = useOrganization({ memberships: { infinite: true } });
    const { userMemberships } = useOrganizationList({ userMemberships: { infinite: true } });

    // State
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
    const [dateSortDesc, setDateSortDesc] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [meetingIdToUuid, setMeetingIdToUuid] = useState<Map<string, string>>(new Map());
    const rowsPerPage = 10;

    const baseUrl = API_BASE_URL.replace(/\/api$/, '');

    // --- Memoized Lookups ---
    const teamNameMap = useMemo(() => {
        const map = new Map<string, string>();
        userMemberships?.data?.forEach(m => map.set(m.organization.id, m.organization.name));
        return map;
    }, [userMemberships?.data]);

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

    useEffect(() => {
        const fetchMeetings = async () => {
            const orgs = userMemberships?.data ?? [];
            
            if (orgs.length === 0) {
                setMeetings([]);
                setLoading(false);
                return;
            }
            
            setLoading(true);
            try {
                const byId = new Map<number, Meeting>();
                let successCount = 0;
                let failCount = 0;
                
                const uuidByOrgAndMeetingId = new Map<string, string>();

                for (const { organization: org } of orgs) {
                    try {
                        const token = await getToken({ organizationId: org.id });
                        if (!token) {
                            console.warn('No token for org:', org.name);
                            continue;
                        }
                        
                        const response = await fetch(`${API_BASE_URL}/v1/meetings`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            const list: Meeting[] = Array.isArray(data) ? data : [];
                            list.forEach((m: Meeting) => byId.set(m.meeting_id, m));
                            successCount++;

                            // Resolve meeting_id -> team_meetings UUID (imported_meeting_id + title+date fallback)
                            try {
                                const teamRes = await fetch(`${baseUrl}/meetings/${org.id}`, {
                                    headers: { Authorization: `Bearer ${token}` },
                                });
                                if (teamRes.ok) {
                                    const teamData = await teamRes.json();
                                    const teamList = Array.isArray(teamData) ? teamData : [];
                                    teamList.forEach((row: { id?: string; created_at?: string; title?: string; imported_meeting_id?: number }) => {
                                        if (row.id == null) return;
                                        if (row.imported_meeting_id != null) {
                                            uuidByOrgAndMeetingId.set(`${org.id}_${row.imported_meeting_id}`, String(row.id));
                                            return;
                                        }
                                        const rowDate = toDateKey(row.created_at);
                                        const rowTitle = row.title;
                                        const match = list.find((m: Meeting) =>
                                            m.org_id === org.id && sameTitle(m.title, rowTitle) && toDateKey(m.meeting_date) === rowDate
                                        );
                                        if (match) uuidByOrgAndMeetingId.set(`${org.id}_${match.meeting_id}`, String(row.id));
                                    });
                                }
                            } catch {
                                // ignore
                            }
                        } else if (response.status === 403) {
                            console.warn('No access to meetings for org:', org.name);
                            failCount++;
                        } else {
                            console.error('Failed to fetch for org:', org.name, response.status);
                            failCount++;
                        }
                    } catch (orgError) {
                        console.error('Error fetching for org:', org.name, orgError);
                        failCount++;
                    }
                }
                
                setMeetingIdToUuid(uuidByOrgAndMeetingId);
                setMeetings(Array.from(byId.values()));
                
                // Only show error if ALL orgs failed
                if (failCount > 0 && successCount === 0) {
                    toast.error('Failed to load meetings from any organization');
                }
            } catch (error) {
                console.error('Fetch error:', error);
                toast.error('Failed to load meetings');
            } finally {
                setLoading(false);
            }
        };
    
        fetchMeetings();
    }, [userMemberships?.data, refreshTrigger]);

    // listen for external meeting updates
    useEffect(() => {
        const handleUpdated = () => {
            setRefreshTrigger(prev => prev + 1);
        };
        window.addEventListener('meetings:updated', handleUpdated);
        return () => window.removeEventListener('meetings:updated', handleUpdated);
    }, []); 

    // TODO: handle delete
    const handleDelete = () => {
        toast.error('Coming soon...');
    };

    // --- Filtering & Sorting ---
    const filteredMeetings = useMemo(() => {
        const query = searchQuery.toLowerCase();
        let result = [...meetings];
        if (query) {
            result = result.filter(m => {
                const uploader = (userNameMap.get(m.created_by) || '').toLowerCase();
                const team = (teamNameMap.get(m.org_id) || '').toLowerCase();
                const title = getMeetingName(m).toLowerCase();
                return uploader.includes(query) || team.includes(query) || title.includes(query);
            });
        }

        return result.sort((a, b) => {
            const timeA = new Date(a.meeting_date).getTime();
            const timeB = new Date(b.meeting_date).getTime();
            return dateSortDesc ? timeB - timeA : timeA - timeB;
        });
    }, [meetings, searchQuery, userNameMap, teamNameMap, dateSortDesc]);

    const totalPages = Math.max(1, Math.ceil(filteredMeetings.length / rowsPerPage));
    const paginatedMeetings = filteredMeetings.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    // Close menu when clicking outside
    useEffect(() => {
        const close = () => {
            setOpenMenuId(null);
            setMenuAnchor(null);
        };
        if (openMenuId !== null) {
            document.addEventListener('click', close);
            return () => document.removeEventListener('click', close);
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

    if (loading) return <div className="p-10 text-center text-gray-400">Loading files...</div>;

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
                            placeholder="Search files, teams, or people..."
                            style={{ color: C.text }} className=" placeholder:text-gray-400"
                        />
                        <InputGroupAddon><SearchIcon className="text-gray-400" /></InputGroupAddon>
                    </InputGroup>
                </div>
            </div>

            <div className="rounded-xl border border-border overflow-visible shadow-sm" style={{ background: C.card }}>
                <Table>
                    <TableHeader style={{ background: C.bgSub }}>
                        <TableRow>
                            <TableHead className="px-6 text-current">File name</TableHead>
                            <TableHead className="px-4 text-current">Source</TableHead>
                            <TableHead className="px-4 text-current">Team</TableHead>
                            <TableHead className="px-4 text-current">Uploaded by</TableHead>
                            <TableHead className="px-4 text-current">
                                <button onClick={() => setDateSortDesc(!dateSortDesc)} className="flex items-center gap-1 hover:text-black">
                                    Date <ArrowUpDown size={14} />
                                </button>
                            </TableHead>
                            <TableHead className="px-4 text-right text-current">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedMeetings.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="h-32 text-center text-gray-500">No results found.</TableCell></TableRow>
                        ) : (
                            paginatedMeetings.map(meeting => {
                              
                                const sourceLabel = getSourceLabel(meeting);
                                return (
                                    <TableRow key={meeting.meeting_id} className="hover:bg-gray-50/50">
                                        <TableCell className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {(() => {
                                                    const iconColors = [C.teal, C.tealMuted, C.textDim, C.text, C.tealDeep, C.teal];
                                                    const iconBg = iconColors[meeting.meeting_id % iconColors.length];
                                                    return (
                                                        <div className="p-2 rounded" style={{ background: iconBg, color: C.bg }}><FileText size={16} /></div>
                                                    );
                                                })()}
                                                <span className="font-medium text-current truncate max-w-[180px]">{getMeetingName(meeting)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-4 text-sm text-gray-600">
                                            {sourceLabel}
                                        </TableCell>
                                        <TableCell className="px-4 py-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-1.5">
                                                <Users size={14} className="text-gray-400" />
                                                {teamNameMap.get(meeting.org_id) || 'Personal'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-4 text-sm text-gray-500">{userNameMap.get(meeting.created_by) || 'Unknown'}</TableCell>
                                        <TableCell className="px-4 py-4 text-sm text-gray-500">{formatDate(meeting.meeting_date)}</TableCell>
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
                                                            const menuWidth = 176;
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
                                                    className="p-1.5 hover:bg-gray-100 rounded-md"
                                                >
                                                    <MoreVertical size={16} style={{ color: C.textDim }} />
                                                </button>
                                                {openMenuId === meeting.meeting_id && menuAnchor && (() => {
                                                    const meetingForMenu = paginatedMeetings.find(m => m.meeting_id === openMenuId);
                                                    if (!meetingForMenu) return null;
                                                    return createPortal(
                                                        <div
                                                          className="fixed w-40 rounded-lg shadow-xl z-[100] py-1"
                                                          style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, top: menuAnchor.top, left: menuAnchor.left }}
                                                          onClick={(e) => e.stopPropagation()}
                                                        >
                                                          {/* Show view for live meeting: open that team's Live meetings page */}
                                                          {isLiveMeeting(meetingForMenu) && (
                                                            <button
                                                              onClick={() => {
                                                                setOpenMenuId(null);
                                                                setMenuAnchor(null);
                                                                const org = meetingForMenu.org_id ? `&org=${encodeURIComponent(meetingForMenu.org_id)}` : '';
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
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                                                            onClick={() => handleDelete()}
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
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
                <span>Showing {paginatedMeetings.length} of {filteredMeetings.length} files</span>
                <div className="flex gap-2">
                    <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="px-4 py-2 border rounded-md disabled:opacity-30 hover:bg-gray-50"
                    >
                        Previous
                    </button>
                    <button 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="px-4 py-2 border rounded-md disabled:opacity-30 hover:bg-gray-50"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
