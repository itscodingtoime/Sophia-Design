/**
 * CommitmentCard -- Right rail section showing active commitments.
 *
 * Fetches commitments from API, renders status chips, three-dot menu
 * with Mark Complete / Edit Due Date / Delete actions.
 * Max 3 visible with "Show N more" toggle.
 */
import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, MoreHorizontal, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { C, useThemeMode } from '../../theme';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface CommitmentItem {
  id: string;
  user_id: string;
  action: string;
  done_when: string | null;
  due_date: string | null;
  status: 'pending' | 'in-progress' | 'done' | 'overdue';
  session_id: string | null;
  created_at: string;
}

interface CommitmentCardProps {
  token: string;
  sessionId?: string;
}

const STATUS_CHIP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: 'var(--chip-pending-bg)', border: 'var(--chip-pending-border)', text: 'var(--chip-pending-text)' },
  'in-progress': { bg: 'var(--chip-progress-bg)', border: 'var(--chip-progress-border)', text: 'var(--chip-progress-text)' },
  done: { bg: 'var(--chip-done-bg)', border: 'var(--chip-done-border)', text: 'var(--chip-done-text)' },
  overdue: { bg: 'rgba(212,163,74,0.08)', border: 'rgba(212,163,74,0.2)', text: 'var(--chip-overdue-text)' },
};

function getChipColors(status: string) {
  // Use C.* values directly at render time
  const map: Record<string, { bg: string; border: string; text: string }> = {
    pending: { bg: C.hoverBg, border: C.border, text: C.textSec },
    'in-progress': { bg: C.tealGlow, border: C.tealBorder, text: C.teal },
    done: { bg: C.tealGlow, border: C.tealBorder, text: C.teal },
    overdue: { bg: 'rgba(212,163,74,0.08)', border: 'rgba(212,163,74,0.2)', text: C.amber },
  };
  return map[status] || map.pending;
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function CommitmentCard({ token, sessionId }: CommitmentCardProps) {
  useThemeMode(); // Subscribe to theme re-renders

  const [commitments, setCommitments] = useState<CommitmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('rail-commitments-collapsed') === 'true'; } catch { return false; }
  });
  const [showAll, setShowAll] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchCommitments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/coach/commitments`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch commitments');
      const data = await res.json();
      setCommitments(data.commitments || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchCommitments(); }, [fetchCommitments]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('rail-commitments-collapsed', String(next)); } catch { /* noop */ }
  };

  const handleMarkComplete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/coach/commitments/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
      setMenuOpenId(null);
      fetchCommitments();
    } catch {
      toast.error('Failed to update commitment');
    }
  };

  const handleEditDueDate = (id: string, currentDate: string | null) => {
    setEditingDateId(id);
    setDateValue(currentDate || '');
    setMenuOpenId(null);
  };

  const saveDueDate = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/coach/commitments/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date: dateValue || null }),
      });
      setEditingDateId(null);
      fetchCommitments();
    } catch {
      toast.error('Failed to update due date');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/coach/commitments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      setConfirmDeleteId(null);
      toast.success('Commitment removed');
      fetchCommitments();
    } catch {
      toast.error('Failed to delete commitment');
    }
  };

  const maxVisible = 3;
  const visibleItems = showAll ? commitments : commitments.slice(0, maxVisible);
  const hiddenCount = commitments.length - maxVisible;

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Header */}
      <div
        onClick={toggleCollapse}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: collapsed ? 0 : 12,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <CheckSquare size={16} style={{ color: C.teal, strokeWidth: 2 }} />
        <div style={{
          fontSize: 12, color: C.textDim, textTransform: 'uppercase',
          letterSpacing: '1.5px', fontWeight: 600, flex: 1,
        }}>
          Commitments
        </div>
        {collapsed ? (
          <ChevronRight size={14} style={{ color: C.textDim }} />
        ) : (
          <ChevronDown size={14} style={{ color: C.textDim }} />
        )}
      </div>

      {/* Body */}
      <div style={{
        maxHeight: collapsed ? 0 : 1000,
        overflow: 'hidden',
        transition: 'max-height 0.2s ease',
      }}>
        {loading ? (
          <div style={{ padding: '12px 16px', fontSize: 12, color: C.textDim }}>Loading...</div>
        ) : commitments.length === 0 ? (
          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: C.hoverBg, border: `1px solid ${C.border}`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 400, color: C.textDim, lineHeight: 1.5 }}>
              SOPHIA will suggest commitments as you work together.
            </div>
          </div>
        ) : (
          <>
            {visibleItems.map(c => {
              const chip = getChipColors(c.status);
              return (
                <div
                  key={c.id}
                  style={{
                    padding: '12px 16px', borderRadius: 14,
                    background: C.hoverBg, border: `1px solid ${C.border}`,
                    marginBottom: 8, position: 'relative',
                  }}
                  onMouseEnter={e => {
                    const btn = e.currentTarget.querySelector('[data-menu-trigger]') as HTMLElement;
                    if (btn) btn.style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget.querySelector('[data-menu-trigger]') as HTMLElement;
                    if (btn && menuOpenId !== c.id) btn.style.opacity = '0';
                  }}
                >
                  {/* Row 1: status chip + due date + menu */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        padding: '4px 8px', borderRadius: 8,
                        background: chip.bg, border: `1px solid ${chip.border}`, color: chip.text,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                        {c.status === 'done' && <Check size={10} />}
                        {c.status}
                      </span>
                      {c.due_date && (
                        <span style={{ fontSize: 11, color: C.textDim }}>
                          {formatDueDate(c.due_date)}
                        </span>
                      )}
                    </div>
                    <button
                      data-menu-trigger
                      onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === c.id ? null : c.id); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        opacity: menuOpenId === c.id ? 1 : 0, transition: 'opacity 0.15s',
                      }}
                    >
                      <MoreHorizontal size={16} style={{ color: C.textDim }} />
                    </button>
                  </div>

                  {/* Three-dot menu dropdown */}
                  {menuOpenId === c.id && (
                    <div style={{
                      position: 'absolute', right: 12, top: 36, zIndex: 10,
                      background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                      padding: 4, minWidth: 160, boxShadow: `0 4px 12px ${C.shadowColor}`,
                    }}>
                      {c.status !== 'done' && (
                        <button
                          onClick={() => handleMarkComplete(c.id)}
                          style={{
                            display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 12, color: C.text, borderRadius: 6,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = C.hoverBg; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                        >
                          Mark Complete
                        </button>
                      )}
                      <button
                        onClick={() => handleEditDueDate(c.id, c.due_date)}
                        style={{
                          display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 12, color: C.text, borderRadius: 6,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.hoverBg; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                      >
                        Edit Due Date
                      </button>
                      <button
                        onClick={() => { setMenuOpenId(null); setConfirmDeleteId(c.id); }}
                        style={{
                          display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 12, color: C.red, borderRadius: 6,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.hoverBg; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                      >
                        Delete Commitment
                      </button>
                    </div>
                  )}

                  {/* Inline date editor */}
                  {editingDateId === c.id && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input
                        type="date"
                        value={dateValue}
                        onChange={e => setDateValue(e.target.value)}
                        style={{
                          flex: 1, padding: '6px 8px', borderRadius: 8,
                          background: C.inputBg, border: `1px solid ${C.tealBorder}`,
                          color: C.text, fontSize: 12, outline: 'none',
                          fontFamily: "'Tomorrow', sans-serif",
                        }}
                      />
                      <button
                        onClick={() => saveDueDate(c.id)}
                        style={{
                          padding: '6px 10px', borderRadius: 8,
                          background: C.teal, border: 'none', color: '#0A0A0C',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingDateId(null)}
                        style={{
                          padding: '6px 8px', borderRadius: 8,
                          background: 'transparent', border: `1px solid ${C.border}`,
                          color: C.textDim, fontSize: 11, cursor: 'pointer',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Delete confirmation */}
                  {confirmDeleteId === c.id && (
                    <div style={{
                      padding: '8px 12px', borderRadius: 8,
                      background: C.hoverBg, border: `1px solid ${C.border}`,
                      marginBottom: 6,
                    }}>
                      <div style={{ fontSize: 11, color: C.text, marginBottom: 6 }}>Delete this commitment?</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleDelete(c.id)}
                          style={{
                            flex: 1, padding: '4px 8px', borderRadius: 6,
                            background: C.red, border: 'none', color: '#fff',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            flex: 1, padding: '4px 8px', borderRadius: 6,
                            background: 'transparent', border: `1px solid ${C.border}`,
                            color: C.textDim, fontSize: 11, cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Row 2: action text */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>
                    {c.action}
                  </div>

                  {/* Row 3: done_when */}
                  {c.done_when && (
                    <div style={{ fontSize: 11, color: C.textDim, fontStyle: 'italic', marginTop: 4 }}>
                      {c.done_when}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Show more link */}
            {hiddenCount > 0 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: C.teal, padding: '4px 0',
                }}
              >
                Show {hiddenCount} more
              </button>
            )}
            {showAll && hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: C.teal, padding: '4px 0',
                }}
              >
                Show less
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
