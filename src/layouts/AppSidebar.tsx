import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare, Home as HomeIcon, Mic, Sun, Moon, Plus, UserPlus, ChevronDown, ChevronUp, ChevronRight,
  TrendingUp, TrendingDown, Minus, Check,
  Rocket, Sparkles, Megaphone, Cog, Briefcase, Compass, Flame, Leaf, Star, Target,
  MoreHorizontal, X,
} from 'lucide-react';

import { C, useThemeMode } from '../theme';
import type { CoachSession } from '../services/coach';
import logoWhite from '../assets/innersystems-primary-brand-white.png';
import logoGreen from '../assets/innersystems-primary-brand-black.png';
import { useActiveTeam } from '../context/ActiveTeamContext';
import { teamHealthSignals, TEAM_SWATCHES, TEAM_ICONS, type TeamIcon } from '../mock-data';

interface SidebarSession {
  id: string;
  title: string;
  date: string;
}

export interface AppSidebarProps {
  // Sessions still passed in by AppLayout — sidebar no longer renders the list, but kept to avoid layout refactor.
  sessions: SidebarSession[];
  currentSessionId?: string;
  onNewConversation: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  userName?: string;
  userRole?: string;
  userImageUrl?: string;
}

const formatSessionDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const sessionDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (sessionDay.getTime() === today.getTime()) return "Today";
  if (sessionDay.getTime() === yesterday.getTime()) return "Yesterday";
  if (sessionDay.getTime() > weekAgo.getTime()) return "This Week";
  return "Older";
};

export function toSidebarSessions(sessions: CoachSession[]): SidebarSession[] {
  return sessions
    .filter(s => (s.message_count ?? 0) > 0)
    .map(s => ({
      id: s.id,
      title: s.title || "New conversation",
      date: formatSessionDate(s.started_at),
    }));
}

const nav = [
  { id: "home",   path: "/home",   label: "Home",          icon: <HomeIcon size={15} strokeWidth={1.8} /> },
  { id: "sophia", path: "/chat",   label: "Coach SOPHIA",  icon: <MessageSquare size={15} strokeWidth={1.8} /> },
  { id: "studio", path: "/studio", label: "Studio",        icon: <Mic size={15} strokeWidth={1.8} /> },
];

// ─── Icon registry ───
const ICON_COMPONENTS: Record<TeamIcon, typeof Rocket> = {
  rocket: Rocket,
  sparkles: Sparkles,
  megaphone: Megaphone,
  cog: Cog,
  briefcase: Briefcase,
  compass: Compass,
  flame: Flame,
  leaf: Leaf,
  star: Star,
  target: Target,
};

function TeamIconGlyph({ icon, size = 12, colour }: { icon: TeamIcon; size?: number; colour?: string }) {
  const Cmp = ICON_COMPONENTS[icon] ?? Sparkles;
  return <Cmp size={size} color={colour} strokeWidth={2} />;
}

// ─── Workspace dropdown ───
function WorkspaceMenu({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div
        style={{
          position: 'absolute', left: 12, top: 'calc(100% + 6px)',
          minWidth: 248,
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: 8, zIndex: 61,
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ padding: '6px 8px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: C.teal, color: C.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
          }}>
            I
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, color: C.text, fontFamily: "'Futura', 'Tomorrow', sans-serif", fontWeight: 600 }}>
              InnerSystems
            </div>
            <div style={{ fontSize: 10.5, color: C.textDim }}>1 member</div>
          </div>
        </div>

        <button
          onClick={() => { alert('Invite teammates — design preview'); onClose(); }}
          style={menuRowStyle()}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <UserPlus size={14} style={{ color: C.text }} />
          <span style={{ flex: 1, textAlign: 'left' }}>Invite teammates</span>
        </button>

        <div style={{ height: 1, background: C.border, margin: '6px 4px' }} />

        <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 1.2, textTransform: 'uppercase', padding: '4px 8px' }}>
          Workspaces
        </div>
        <button
          onClick={onClose}
          style={menuRowStyle()}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.teal }} />
          <span style={{ flex: 1, textAlign: 'left' }}>InnerSystems</span>
          <Check size={13} style={{ color: C.teal }} />
        </button>
        <button
          onClick={() => { alert('Add workspace — design preview'); onClose(); }}
          style={menuRowStyle()}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Plus size={14} style={{ color: C.text }} />
          <span style={{ flex: 1, textAlign: 'left' }}>Add workspace</span>
        </button>
      </div>
    </>
  );
}

const menuRowStyle = (): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '8px 8px', borderRadius: 8,
  background: 'transparent', border: 'none',
  cursor: 'pointer', color: C.text, fontSize: 12.5,
  fontFamily: "'Tomorrow', sans-serif",
  transition: 'background 0.12s',
});

// ─── Per-team customise popover (icon + colour) ───
function TeamCustomisePopover({
  teamId,
  currentIcon,
  currentColour,
  onIcon,
  onColour,
  onClose,
}: {
  teamId: string;
  currentIcon: TeamIcon;
  currentColour: string;
  onIcon: (icon: TeamIcon) => void;
  onColour: (colour: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div style={{
        position: 'absolute', right: 6, top: 'calc(100% + 4px)',
        minWidth: 232,
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 12, zIndex: 61,
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
      }}>
        <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
          Icon
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12 }}>
          {TEAM_ICONS.map((ic) => (
            <button
              key={`${teamId}-icon-${ic}`}
              onClick={() => onIcon(ic)}
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: ic === currentIcon ? C.activeBg : 'transparent',
                border: ic === currentIcon ? `1px solid ${C.tealBorder}` : `1px solid ${C.border}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.text,
              }}
              aria-label={ic}
            >
              <TeamIconGlyph icon={ic} size={14} colour={C.text} />
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
          Colour
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TEAM_SWATCHES.map((s) => (
            <button
              key={`${teamId}-colour-${s}`}
              onClick={() => onColour(s)}
              style={{
                width: 22, height: 22, borderRadius: '50%',
                background: s,
                border: s === currentColour ? `2px solid ${C.text}` : `1px solid ${C.border}`,
                cursor: 'pointer',
              }}
              aria-label={`Colour ${s}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Add Team modal ───
function AddTeamModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: { name: string; colour: string; icon: TeamIcon }) => void;
}) {
  const [name, setName] = useState('');
  const [colour, setColour] = useState(TEAM_SWATCHES[0]);
  const [icon, setIcon] = useState<TeamIcon>('sparkles');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400,
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 24,
          fontFamily: "'Tomorrow', sans-serif",
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, color: C.text, fontWeight: 600, fontFamily: "'Futura', 'Tomorrow', sans-serif" }}>
            New team
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4 }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <label style={{ fontSize: 11, color: C.textDim, letterSpacing: 0.6, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
          Name
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sales"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            background: C.inputBg, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13,
            fontFamily: "'Tomorrow', sans-serif",
            outline: 'none', marginBottom: 14,
            boxSizing: 'border-box',
          }}
        />

        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
          Icon
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
          {TEAM_ICONS.map((ic) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              style={{
                height: 34, borderRadius: 8,
                background: ic === icon ? C.activeBg : 'transparent',
                border: ic === icon ? `1px solid ${C.tealBorder}` : `1px solid ${C.border}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.text,
              }}
              aria-label={ic}
            >
              <TeamIconGlyph icon={ic} size={15} colour={C.text} />
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
          Colour
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          {TEAM_SWATCHES.map((s) => (
            <button
              key={s}
              onClick={() => setColour(s)}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: s,
                border: s === colour ? `2px solid ${C.text}` : `1px solid ${C.border}`,
                cursor: 'pointer',
              }}
              aria-label={`Colour ${s}`}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 999, padding: '8px 16px',
              color: C.textSec, cursor: 'pointer',
              fontSize: 12, fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!name.trim()) return;
              onCreate({ name: name.trim(), colour, icon });
              onClose();
            }}
            disabled={!name.trim()}
            style={{
              background: name.trim() ? colour : C.border,
              color: '#0A0A0C',
              border: 'none', borderRadius: 999, padding: '8px 18px',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              fontSize: 12, fontWeight: 600,
              fontFamily: "'Futura', 'Tomorrow', sans-serif",
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            Create team
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Team row with tiny health bar + trend arrow + customise menu ───
function TeamRow({
  teamId,
  name,
  colour,
  icon,
  active,
  customisable,
  onClick,
  onIconChange,
  onColourChange,
}: {
  teamId: string;
  name: string;
  colour: string;
  icon: TeamIcon;
  active: boolean;
  customisable: boolean;
  onClick: () => void;
  onIconChange?: (icon: TeamIcon) => void;
  onColourChange?: (colour: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const signal = teamHealthSignals[teamId] ?? { current: 70, delta30d: 0, direction: 'flat' as const };
  const trendIcon =
    signal.direction === 'up'   ? <TrendingUp size={11}   style={{ color: '#86C36C' }} /> :
    signal.direction === 'down' ? <TrendingDown size={11} style={{ color: '#D45A5A' }} /> :
                                  <Minus size={11}        style={{ color: C.textDim }} />;

  const fillPct = Math.max(4, Math.min(100, ((signal.current - 50) / 45) * 100));

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 6px 7px 10px', borderRadius: 8,
        background: active ? C.activeBg : 'transparent',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = C.hoverBg; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
          padding: 0, border: 'none', cursor: 'pointer',
          background: 'transparent',
          textAlign: 'left', fontFamily: "'Tomorrow', sans-serif",
        }}
      >
        <span style={{
          width: 20, height: 20, borderRadius: 6,
          background: `${colour}33`,
          border: `1px solid ${colour}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <TeamIconGlyph icon={icon} size={12} colour={colour} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, color: active ? C.text : C.textSec, fontWeight: active ? 600 : 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name}
          </div>
          <div style={{
            marginTop: 4,
            height: 3, borderRadius: 2,
            background: 'rgba(120,120,120,0.18)',
            position: 'relative', overflow: 'hidden',
          }}>
            <span style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${fillPct}%`,
              background: colour,
              opacity: 0.85,
              borderRadius: 2,
            }} />
          </div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {trendIcon}
          <span style={{ fontSize: 10, color: C.textDim, minWidth: 14, textAlign: 'right' }}>
            {signal.current}
          </span>
        </span>
      </button>

      {customisable && (
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          aria-label={`Customise ${name}`}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: C.textDim, padding: 3, borderRadius: 6, flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <MoreHorizontal size={13} />
        </button>
      )}

      {menuOpen && customisable && onIconChange && onColourChange && (
        <TeamCustomisePopover
          teamId={teamId}
          currentIcon={icon}
          currentColour={colour}
          onIcon={onIconChange}
          onColour={onColourChange}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

export default function AppSidebar({
  userName = "User",
  userRole = "",
  userImageUrl,
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, toggle } = useThemeMode();
  const isProfileActive = location.pathname === "/profile";

  const { teams, updateTeam, addTeam } = useActiveTeam();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [addingTeam, setAddingTeam] = useState(false);

  const initials = userName
    .split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <aside style={{
      width: 260, flexShrink: 0, display: "flex", flexDirection: "column",
      background: C.sidebarBg, borderRight: `1px solid ${C.border}`,
      height: "100vh", overflow: "hidden",
      transition: "background 0.35s ease",
    }}>
      {/* ─── Logo + workspace picker ─── */}
      <div style={{ padding: "16px 12px 8px", flexShrink: 0, position: 'relative' }}>
        <button
          onClick={() => setWorkspaceOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '6px 6px', borderRadius: 8,
            fontFamily: "'Tomorrow', sans-serif",
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <img
            src={mode === 'dark' ? logoWhite : logoGreen}
            alt="InnerSystems"
            style={{ height: 26, width: 'auto', flexShrink: 0 }}
          />
          <span style={{ flex: 1 }} />
          <ChevronDown size={13} style={{ color: C.textDim }} />
        </button>
        {workspaceOpen && <WorkspaceMenu onClose={() => setWorkspaceOpen(false)} />}
      </div>

      {/* ─── Navigation ─── */}
      <div style={{ padding: "4px 10px 8px", flexShrink: 0 }}>
        {nav.map(n => {
          const isActive = location.pathname.startsWith(n.path);
          return (
            <Link
              key={n.id}
              to={n.path}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 10px", borderRadius: 8, textDecoration: "none",
                background: isActive ? C.activeBg : "transparent",
                color: isActive ? C.text : C.textDim,
                fontSize: 12.5, fontWeight: isActive ? 600 : 400,
                fontFamily: "'Tomorrow', sans-serif", transition: "all 0.15s",
                textAlign: "left",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.hoverBg; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              {n.icon}
              {n.label}
            </Link>
          );
        })}
      </div>

      {/* ─── Teams (Granola-style) ─── */}
      <div style={{ padding: "4px 10px 0", flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <button
          onClick={() => setTeamsOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            width: '100%', padding: '8px 4px', borderRadius: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: C.textDim, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
            fontFamily: "'Tomorrow', sans-serif", fontWeight: 600,
          }}
        >
          {teamsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Teams
        </button>
        {teamsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {teams.map((t) => (
              <TeamRow
                key={t.team_id}
                teamId={t.team_id}
                name={t.team_name}
                colour={t.default_colour}
                icon={t.icon}
                active={location.pathname === `/team/${t.team_id}`}
                customisable
                onClick={() => navigate(`/team/${t.team_id}`)}
                onIconChange={(ic) => updateTeam(t.team_id, { icon: ic })}
                onColourChange={(c) => updateTeam(t.team_id, { default_colour: c })}
              />
            ))}
            <button
              onClick={() => setAddingTeam(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 10px', borderRadius: 8,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: C.textDim, fontSize: 11.5,
                fontFamily: "'Tomorrow', sans-serif", textAlign: 'left',
                marginTop: 4,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; e.currentTarget.style.color = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textDim; }}
            >
              <Plus size={12} />
              Add team
            </button>
          </div>
        )}
      </div>

      {/* ─── Profile (bottom) ─── */}
      <div style={{
        padding: "12px 14px", flexShrink: 0,
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link
            to="/profile"
            style={{
              display: "flex", alignItems: "center", gap: 10, flex: 1,
              padding: "8px 8px", borderRadius: 10, textDecoration: "none",
              background: isProfileActive ? C.activeBg : "transparent",
              transition: "all 0.15s", minWidth: 0,
            }}
            onMouseEnter={e => { if (!isProfileActive) e.currentTarget.style.background = C.hoverBg; }}
            onMouseLeave={e => { if (!isProfileActive) e.currentTarget.style.background = "transparent"; }}
          >
            {userImageUrl ? (
              <img
                src={userImageUrl}
                alt={userName}
                onError={(e) => {
                  (e.currentTarget.style.display = 'none');
                  const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (sib) sib.style.display = 'flex';
                }}
                style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
              />
            ) : null}
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              display: userImageUrl ? 'none' : 'flex',
              background: C.teal, alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600, color: C.bg,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'Futura', 'Tomorrow', sans-serif" }}>
                {userName}
              </div>
              {userRole && (
                <div style={{ fontSize: 10, color: C.textDim }}>
                  {userRole}
                </div>
              )}
            </div>
          </Link>

          <button
            onClick={toggle}
            style={{
              background: C.hoverBg, border: `1px solid ${C.border}`, borderRadius: 8,
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
              fontFamily: "'Tomorrow', sans-serif",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.activeBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.hoverBg; }}
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mode === "light" ? (
              <Moon size={14} stroke={C.textDim} strokeWidth={1.8} />
            ) : (
              <Sun size={14} stroke={C.textDim} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>

      {addingTeam && (
        <AddTeamModal
          onClose={() => setAddingTeam(false)}
          onCreate={(input) => {
            const id = addTeam(input);
            navigate(`/team/${id}`);
          }}
        />
      )}
    </aside>
  );
}
