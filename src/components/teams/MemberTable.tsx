import type React from 'react';
// shadcn components
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, ArrowUpDown, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table';
import { toast } from 'sonner';
import { C, useThemeMode } from '../../theme';
import { useSophiaAuth } from '../../hooks/useSophiaAuth';

interface MemberTableProps {
  memberships: any[];
  currentUserId: string | undefined;
  onRemove: (id: string) => void;
  roleData?: Record<string, { role_title: string; role_description: string }>;
  voiceprintStatus?: Record<string, boolean>;
}

const MemberTable = ({ memberships, currentUserId, onRemove, roleData, voiceprintStatus }: MemberTableProps) => {
  useThemeMode();
  const { getApiToken } = useSophiaAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const [sorting, setSorting] = useState<SortingState>([{ id: 'member', desc: false }]);
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [positionDraft, setPositionDraft] = useState('');
  const [savingPosition, setSavingPosition] = useState(false);

  const savePosition = async () => {
    if (!positionDraft.trim()) return;
    setSavingPosition(true);
    try {
      const token = await getApiToken();
      const resp = await fetch(`${API_BASE}/api/teams/members/me/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ position: positionDraft.trim() }),
      });
      if (!resp.ok) throw new Error('Failed');
      toast.success('Title updated');
      setEditingPosition(null);
    } catch {
      toast.error('Something went wrong. Try again.');
    } finally {
      setSavingPosition(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getMemberName = (membership: any) => {
    const firstName = membership.publicUserData?.firstName || '';
    const lastName = membership.publicUserData?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Unknown User';
  };

  const currentUserMembership = memberships.find(
    (m) => m.publicUserData?.userId === currentUserId
  );
  const isCurrentUserAdmin = currentUserMembership?.role === 'org:admin';

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'member',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="text-sm hover:bg-transparent"
            style={{ color: C.text }}
          >
            Member
            <ArrowUpDown className="ml-2 h-4 w-4" style={{ color: C.text }} />
          </Button>
        );
      },
      cell: ({ row }: { row: { original: any } }) => {
        const membership = row.original;
        const memberName = getMemberName(membership);
        const initials = memberName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        const userId = membership.publicUserData?.userId;
        const isEnrolled = !!(userId && voiceprintStatus?.[userId]);
        const ringStyle: React.CSSProperties = isEnrolled
          ? { outline: `2px solid ${C.teal}`, outlineOffset: '2px' }
          : { border: '1px solid rgba(255,255,255,0.1)' };
        return (
          <div className="flex items-center gap-3">
            {membership.publicUserData?.imageUrl ? (
              <img
                src={membership.publicUserData.imageUrl}
                alt={memberName}
                className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                style={ringStyle}
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0"
                style={ringStyle}>
                <span className="text-xs font-medium" style={{ color: C.text }}>{initials}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-sm" style={{ color: C.text }}>{memberName}</span>
              {roleData?.[membership.publicUserData?.userId]?.role_title && (
                <div style={{ fontSize: 11, fontWeight: 400, color: C.textDim, marginTop: 1, fontFamily: "'Tomorrow', sans-serif" }}>
                  {roleData[membership.publicUserData.userId].role_title}
                </div>
              )}
            </div>
          </div>
        );
      },
      sortingFn: (rowA, rowB) => {
        const nameA = getMemberName(rowA.original).toLowerCase();
        const nameB = getMemberName(rowB.original).toLowerCase();
        return nameA.localeCompare(nameB);
      },
    },
    {
      accessorKey: 'role',
      header: () => <span className="text-sm" style={{ color: C.text }}>Role</span>,
      cell: ({ row }: { row: { original: any } }) => {
        const isAdmin = row.original.role === 'org:admin';
        return (
          <span
            className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
              isAdmin
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
            }`}
          >
            {isAdmin ? 'Admin' : 'Member'}
          </span>
        );
      },
    },
    {
      accessorKey: 'position',
      header: () => <span className="text-sm" style={{ color: C.text }}>Position/Title</span>,
      cell: ({ row }: { row: { original: any } }) => {
        const membership = row.original;
        const isOwnRow = membership.publicUserData?.userId === currentUserId;
        const position = (membership.publicMetadata as any)?.position || '';
        const membershipId = membership.id;

        if (isOwnRow && editingPosition === membershipId) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                autoFocus
                value={positionDraft}
                onChange={e => setPositionDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') savePosition(); if (e.key === 'Escape') setEditingPosition(null); }}
                style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 12,
                  border: `1px solid ${C.tealBorder}`, background: C.inputBg, color: C.text,
                  fontFamily: "'Tomorrow', sans-serif", outline: 'none', width: 140,
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={savePosition} disabled={savingPosition} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: C.teal, color: '#0A0A0C', border: 'none', cursor: 'pointer',
                }}>{savingPosition ? 'Saving...' : 'Save Title'}</button>
                <button onClick={() => setEditingPosition(null)} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim, cursor: 'pointer',
                }}>Discard</button>
              </div>
            </div>
          );
        }

        if (isOwnRow) {
          return (
            <div
              onClick={() => { setEditingPosition(membershipId); setPositionDraft(position); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minHeight: 28 }}
              className="group"
            >
              <span style={{ fontSize: 12, color: position ? C.text : C.textDim }}>
                {position || 'Add your title'}
              </span>
              <Pencil size={14} style={{ color: C.textDim, opacity: 0, transition: 'opacity 0.15s' }} className="group-hover:!opacity-100" />
            </div>
          );
        }

        return <span style={{ fontSize: 12, color: position ? C.text : C.textDim }}>{position || '--'}</span>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: () => <span className="text-sm" style={{ color: C.text }}>Date joined</span>,
      cell: ({ row }: { row: { original: any } }) => {
        return (
          <span className="text-sm" style={{ color: C.text }}>{formatDate(row.original.createdAt)}</span>
        );
      },
    },
    {
      id: 'actions',
      header: () => <div className="text-left"><span className="text-sm" style={{ color: C.text }}>Actions</span></div>,
      cell: ({ row }: { row: { original: any } }) => {
        const isCurrentUser = row.original.publicUserData?.userId === currentUserId;
        // Non-admins can only see Leave for themselves, admins can see Remove for everyone
        if (!isCurrentUserAdmin && !isCurrentUser) return null;
        return (
          <div className="text-left">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreVertical size={18} style={{ color: C.text }}/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="border border-border" style={{ background: C.card, zIndex: 60 }}>
                <DropdownMenuItem
                  onClick={() => onRemove(row.original.publicUserData?.userId || row.original.id)}
                  className="text-red-600 opacity-100 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700 cursor-pointer"
                >
                  {isCurrentUser ? 'Leave' : 'Remove'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: memberships,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader style={{ background: C.bgSub }}>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default MemberTable;
