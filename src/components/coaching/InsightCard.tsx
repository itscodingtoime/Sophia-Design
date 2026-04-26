/**
 * InsightCard -- Right rail section showing approved coaching insights.
 *
 * Fetches approved insights from API, renders observation text,
 * approval date, and remove button with confirmation.
 * Max 4 visible with "Show N more" toggle.
 */
import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, ChevronDown, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { C, useThemeMode } from '../../theme';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface InsightItem {
  id: string;
  user_id: string;
  observation: string;
  session_id: string | null;
  approved_at: string;
}

interface InsightCardProps {
  token: string;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function InsightCard({ token }: InsightCardProps) {
  useThemeMode(); // Subscribe to theme re-renders

  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('rail-insights-collapsed') === 'true'; } catch { return false; }
  });
  const [showAll, setShowAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/coach/insights`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch insights');
      const data = await res.json();
      setInsights(data.insights || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('rail-insights-collapsed', String(next)); } catch { /* noop */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/coach/insights/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      setConfirmDeleteId(null);
      toast.success('Insight removed');
      fetchInsights();
    } catch {
      toast.error('Failed to remove insight');
    }
  };

  const maxVisible = 4;
  const visibleItems = showAll ? insights : insights.slice(0, maxVisible);
  const hiddenCount = insights.length - maxVisible;

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
        <Lightbulb size={16} style={{ color: C.teal, strokeWidth: 2 }} />
        <div style={{
          fontSize: 12, color: C.textDim, textTransform: 'uppercase',
          letterSpacing: '1.5px', fontWeight: 600, flex: 1,
        }}>
          Insights
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
        ) : insights.length === 0 ? (
          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: C.hoverBg, border: `1px solid ${C.border}`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 400, color: C.textDim, lineHeight: 1.5 }}>
              Insights you approve during coaching will appear here.
            </div>
          </div>
        ) : (
          <>
            {visibleItems.map(ins => (
              <div
                key={ins.id}
                style={{
                  padding: '12px 16px', borderRadius: 14,
                  background: C.hoverBg, border: `1px solid ${C.border}`,
                  marginBottom: 8, position: 'relative',
                }}
                onMouseEnter={e => {
                  const btn = e.currentTarget.querySelector('[data-remove-btn]') as HTMLElement;
                  if (btn) btn.style.opacity = '1';
                }}
                onMouseLeave={e => {
                  const btn = e.currentTarget.querySelector('[data-remove-btn]') as HTMLElement;
                  if (btn && confirmDeleteId !== ins.id) btn.style.opacity = '0';
                }}
              >
                {/* Observation text */}
                <div style={{
                  fontSize: 12, color: C.text, lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {ins.observation}
                </div>

                {/* Bottom row: date + remove */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 8,
                }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>
                    Approved: {formatDate(ins.approved_at)}
                  </span>
                  <button
                    data-remove-btn
                    aria-label="Remove insight"
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(ins.id); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      opacity: confirmDeleteId === ins.id ? 1 : 0,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <X size={14} style={{ color: C.textDim }} />
                  </button>
                </div>

                {/* Delete confirmation */}
                {confirmDeleteId === ins.id && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 8,
                    background: C.hoverBg, border: `1px solid ${C.border}`,
                    marginTop: 6,
                  }}>
                    <div style={{ fontSize: 11, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>
                      Remove this insight? SOPHIA will no longer reference it.
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleDelete(ins.id)}
                        style={{
                          flex: 1, padding: '4px 8px', borderRadius: 6,
                          background: C.red, border: 'none', color: '#fff',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Remove
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
              </div>
            ))}

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
