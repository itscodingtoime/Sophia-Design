/**
 * Studio — clean replacement for the original RecordStudio page.
 *
 *   1. Capture tiles (Record / Upload meeting / Import from Fireflies)
 *   2. Integrations grid (Fireflies, Granola, Otter, Google Meet, Teams, Zoom)
 *   3. Recordings list (filterable mock data)
 */
import { useState } from 'react';
import { Mic, Upload, Link as LinkIcon, Search, MoreHorizontal, Check, Plug, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { C, useThemeMode } from '../theme';
import { recordings as mockRecordings, integrations as mockIntegrations, type Integration, type Recording } from '../mock-data';

const sourceLabel: Record<string, string> = {
  mic: 'Recorded live',
  meeting: 'Live meeting capture',
  fireflies: 'Imported from API',
  otter: 'Imported from Otter',
  granola: 'Imported from Granola',
  teams: 'Imported from Teams',
  meet: 'Imported from Google Meet',
  zoom: 'Imported from Zoom',
  upload: 'Uploaded',
};

const sourceColour: Record<string, string> = {
  mic: '#C2F542',
  meeting: '#A0E0FF',
  fireflies: '#FF6F50',
  otter: '#1FB6FF',
  granola: '#9DBE6E',
  teams: '#5059C9',
  meet: '#34A853',
  zoom: '#2D8CFF',
  upload: '#D8B7FF',
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export default function Studio() {
  useThemeMode();
  const [filter, setFilter] = useState('');
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations);
  const [recordings, setRecordings] = useState<Recording[]>(mockRecordings);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = recordings.filter((r) =>
    !filter ||
    r.title.toLowerCase().includes(filter.toLowerCase()) ||
    r.team.toLowerCase().includes(filter.toLowerCase()) ||
    r.participants.join(' ').toLowerCase().includes(filter.toLowerCase()),
  );

  const deleteRecording = (id: string) => {
    const removed = recordings.find((r) => r.id === id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
    setOpenMenuId(null);
    toast(`Deleted "${removed?.title ?? 'meeting'}"`, {
      action: {
        label: 'Undo',
        onClick: () => {
          if (removed) setRecordings((prev) => [...prev, removed].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        },
      },
      duration: 4000,
    });
  };

  const toggleConnection = (id: string) => {
    setConnectingId(id);
    setTimeout(() => {
      setIntegrations((prev) => prev.map((i) => i.id === id ? { ...i, connected: !i.connected } : i));
      setConnectingId(null);
    }, 600);
  };

  return (
    <div style={{ padding: '32px 36px 80px', maxWidth: 1180, margin: '0 auto', fontFamily: "'Tomorrow', sans-serif" }}>

      {/* Header */}
      <div style={{
        marginBottom: 28,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase' }}>Studio</div>
          <h1 style={{
            margin: '6px 0 4px',
            fontSize: 34,
            fontFamily: "'Futura', 'Tomorrow', sans-serif",
            color: C.text,
            letterSpacing: 0.5,
          }}>
            Record, capture, import.
          </h1>
          <div style={{ color: C.textSec, fontSize: 14 }}>
            Bring meetings into SOPHIA from any source.
          </div>
        </div>
        <IntegrateMenu
          integrations={integrations}
          connectingId={connectingId}
          onToggle={toggleConnection}
        />
      </div>

      {/* Capture tiles */}
      <Section title="Capture">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <CaptureTile
            icon={<Mic size={22} />}
            title="Record meeting"
            blurb="Capture a live meeting on this device. SOPHIA will transcribe and analyse the conversation."
            cta="Start recording"
            accent="#C2F542"
          />
          <CaptureTile
            icon={<Upload size={22} />}
            title="Upload file"
            blurb="Upload .mp3, .mp4, .wav, .webm or paste a transcript."
            cta="Choose file"
            accent="#A0E0FF"
          />
          <CaptureTile
            icon={<LinkIcon size={22} />}
            title="Import from API"
            blurb="Pull a recording or transcript directly into Studio via the API."
            cta="Open API"
            accent="#FF6F50"
          />
        </div>
      </Section>

      {/* Recordings */}
      <Section title="Recordings" right={
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textDim }} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search meetings"
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              padding: '7px 14px 7px 30px',
              color: C.text,
              fontSize: 12,
              fontFamily: "'Tomorrow', sans-serif",
              outline: 'none',
              minWidth: 220,
            }}
          />
        </div>
      }>
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          {filtered.map((r, idx) => (
            <div key={r.id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 130px 80px 200px 30px',
              alignItems: 'center',
              padding: '14px 18px',
              gap: 16,
              borderTop: idx === 0 ? 'none' : `1px solid ${C.border}`,
              cursor: 'pointer',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, color: C.text, fontFamily: "'Futura', 'Tomorrow', sans-serif", marginBottom: 2 }}>
                  {r.title}
                </div>
                <div style={{ fontSize: 11, color: C.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.participants.join(', ')}
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textSec }}>
                {r.team}
              </div>
              <div style={{ fontSize: 11, color: C.textSec }}>
                {formatDate(r.date)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: sourceColour[r.source] || C.textDim }} />
                <span style={{ fontSize: 11, color: C.textSec }}>{sourceLabel[r.source] || r.source}</span>
                <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{r.duration_min}m</span>
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(ev) => { ev.stopPropagation(); setOpenMenuId(openMenuId === r.id ? null : r.id); }}
                  aria-label="Recording options"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: C.textDim, padding: 4, borderRadius: 6,
                  }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.background = C.hoverBg; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
                >
                  <MoreHorizontal size={15} />
                </button>
                {openMenuId === r.id && (
                  <>
                    <div
                      onClick={() => setOpenMenuId(null)}
                      style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                    />
                    <div style={{
                      position: 'absolute',
                      right: 0, top: 'calc(100% + 4px)',
                      minWidth: 180,
                      background: C.card, border: `1px solid ${C.border}`,
                      borderRadius: 10, padding: 6, zIndex: 61,
                      boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                    }}>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); deleteRecording(r.id); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', padding: '8px 10px', borderRadius: 6,
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: '#D45A5A', fontSize: 12.5, textAlign: 'left',
                          fontFamily: "'Tomorrow', sans-serif",
                        }}
                        onMouseEnter={(ev) => { ev.currentTarget.style.background = C.hoverBg; }}
                        onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
                      >
                        <Trash2 size={13} />
                        Delete meeting
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: C.textDim, fontSize: 13 }}>
              No recordings match your search.
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      {title && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 11, color: C.textDim, letterSpacing: 1.4,
            textTransform: 'uppercase', fontWeight: 600,
          }}>{title}</div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function IntegrateMenu({
  integrations,
  connectingId,
  onToggle,
}: {
  integrations: Integration[];
  connectingId: string | null;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Pin Fireflies first since the user lives in it
  const sorted = [...integrations].sort((a, b) => (a.id === 'fireflies' ? -1 : b.id === 'fireflies' ? 1 : 0));
  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 999,
          padding: '8px 14px',
          color: C.text,
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: "'Tomorrow', sans-serif",
          whiteSpace: 'nowrap',
        }}
      >
        <Plug size={13} />
        Connect meeting recording tool
        {connectedCount > 0 && (
          <span style={{
            background: C.tealGlow,
            color: C.teal,
            borderRadius: 999,
            padding: '1px 8px',
            fontSize: 10,
            fontWeight: 600,
            marginLeft: 2,
          }}>
            {connectedCount} connected
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 100 }}
          />
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 6,
            minWidth: 280,
            zIndex: 101,
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          }}>
            {sorted.map((i) => (
              <button
                key={i.id}
                onClick={() => onToggle(i.id)}
                disabled={connectingId === i.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 10px',
                  cursor: 'pointer',
                  color: C.text,
                  textAlign: 'left',
                  fontSize: 13,
                  fontFamily: "'Tomorrow', sans-serif",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: `${i.colour}25`,
                  border: `1px solid ${i.colour}55`,
                  color: i.colour,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, fontFamily: "'Futura', 'Tomorrow', sans-serif",
                  flexShrink: 0,
                }}>{i.letter}</span>
                <span style={{ flex: 1 }}>{i.name}</span>
                {i.connected ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.teal, fontSize: 11 }}>
                    <Check size={12} />
                    Connected
                  </span>
                ) : (
                  <span style={{ color: C.textDim, fontSize: 11 }}>{connectingId === i.id ? '…' : 'Connect'}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CaptureTile({ icon, title, blurb, cta, accent }: { icon: React.ReactNode; title: string; blurb: string; cta: string; accent: string }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      padding: '22px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      minHeight: 200,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${accent}25`, color: accent,
        border: `1px solid ${accent}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 17, color: C.text, fontFamily: "'Futura', 'Tomorrow', sans-serif", fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.5, flex: 1 }}>
        {blurb}
      </div>
      <button style={{
        background: accent,
        color: '#0A0A0C',
        border: 'none',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'Tomorrow', sans-serif",
      }}>
        {cta}
      </button>
    </div>
  );
}
