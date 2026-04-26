/**
 * MotivationPanel — slide-over panel showing a person's (or team's) motivation
 * radar chart, dominant drivers, and blind spots.
 */
import { C, useThemeMode } from '../theme';
import {
  blindSpots,
  driverNames,
  memberDrivers,
  teamAverageDrivers,
  teamMembers,
  type DriverName,
} from '../mock-data';
import MotivationRadar from './MotivationRadar';

interface MotivationPanelProps {
  open: boolean;
  onClose: () => void;
  // null = "overall team"
  memberId: string | null;
}

export function MotivationPanel({ open, onClose, memberId }: MotivationPanelProps) {
  useThemeMode();
  if (!open) return null;

  const isTeam = memberId === null;
  const member = isTeam ? null : teamMembers.find((m) => m.id === memberId);
  const personDrivers: Record<DriverName, number> = isTeam
    ? teamAverageDrivers
    : (memberDrivers[memberId!] || teamAverageDrivers);

  const sortedDrivers = [...driverNames].sort((a, b) => personDrivers[b] - personDrivers[a]);
  const top = sortedDrivers.slice(0, 2);
  const bottom = sortedDrivers.slice(-2).reverse();
  const spots = isTeam
    ? ['Team relies heavily on Connection — a few voices may be carrying the warmth for everyone.', 'Recognition is mid-pack; explicit appreciation rituals would lift it.']
    : (blindSpots[memberId!] || []);

  const seriesColour = isTeam ? '#A0E0FF' : '#C2F542';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(620px, 95vw)',
          maxHeight: '90vh',
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          padding: '28px 28px',
          overflowY: 'auto',
          boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 1.5, fontFamily: "'Tomorrow', sans-serif", textTransform: 'uppercase' }}>
            Motivation profile
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: C.text,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            Close
          </button>
        </div>

        <h2 style={{
          fontFamily: "'Futura', 'Tomorrow', sans-serif",
          fontSize: 28,
          margin: '4px 0 4px',
          color: C.text,
          letterSpacing: 0.5,
        }}>
          {isTeam ? 'Overall Team' : member?.name}
        </h2>
        <div style={{ color: C.textSec, fontSize: 13, marginBottom: 20, fontFamily: "'Tomorrow', sans-serif" }}>
          {isTeam ? 'Average across all 6 members' : member?.role}
        </div>

        {/* Radar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <MotivationRadar
            size={360}
            series={isTeam
              ? [{ label: 'Team avg', values: teamAverageDrivers, colour: seriesColour }]
              : [
                  { label: member!.name.split(' ')[0], values: personDrivers, colour: seriesColour },
                  { label: 'Team avg', values: teamAverageDrivers, colour: '#A0E0FF', fill: '#A0E0FF' },
                ]
            }
          />
        </div>

        {/* Dominant + lowest drivers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '24px 0 16px' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.2, color: C.textDim, marginBottom: 8, fontFamily: "'Tomorrow', sans-serif" }}>DOMINANT</div>
            {top.map((d) => (
              <div key={d} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: C.text, fontFamily: "'Tomorrow', sans-serif" }}>
                <span>{d}</span><span style={{ color: seriesColour, fontWeight: 600 }}>{personDrivers[d]}</span>
              </div>
            ))}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.2, color: C.textDim, marginBottom: 8, fontFamily: "'Tomorrow', sans-serif" }}>LOWEST</div>
            {bottom.map((d) => (
              <div key={d} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: C.text, fontFamily: "'Tomorrow', sans-serif" }}>
                <span>{d}</span><span style={{ color: C.textDim, fontWeight: 600 }}>{personDrivers[d]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Blind spots */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, color: '#FFB28A', marginBottom: 10, fontFamily: "'Tomorrow', sans-serif" }}>BLIND SPOTS</div>
          {spots.length === 0 ? (
            <div style={{ color: C.textDim, fontSize: 13, fontFamily: "'Tomorrow', sans-serif" }}>No blind spots detected.</div>
          ) : (
            spots.map((s, i) => (
              <div key={i} style={{
                fontSize: 13,
                color: C.text,
                lineHeight: 1.55,
                padding: '8px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                fontFamily: "'Tomorrow', sans-serif",
              }}>
                {s}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default MotivationPanel;
