import { useState, useEffect } from 'react';
import { C, useThemeMode } from '../theme';
import { useSophiaAuth } from '../hooks/useSophiaAuth';
import { getVoiceprintQuality, type VoiceprintQuality } from '../services/api';

// ─── Types ───

interface VoiceprintQualityBadgeProps {
  compact?: boolean;
}

// ─── Tier Config ───

interface TierConfig {
  label: string;
  color: string;
  bgAlpha: string;
}

const TIER_CONFIG: Record<string, TierConfig> = {
  building:   { label: 'Building',   color: '#F59E0B', bgAlpha: 'rgba(245,158,11,0.12)' },
  fair:       { label: 'Fair',       color: '#3B82F6', bgAlpha: 'rgba(59,130,246,0.12)' },
  good:       { label: 'Good',       color: '#10B981', bgAlpha: 'rgba(16,185,129,0.12)' },
  very_good:  { label: 'Very Good',  color: '#8B5CF6', bgAlpha: 'rgba(139,92,246,0.12)' },
  excellent:  { label: 'Excellent',  color: '#EC4899', bgAlpha: 'rgba(236,72,153,0.12)' },
};

function getTierConfig(tier: string | null): TierConfig {
  if (!tier) return TIER_CONFIG.building;
  const key = tier.toLowerCase().replace(/\s+/g, '_');
  return TIER_CONFIG[key] || TIER_CONFIG.building;
}

// ─── Shield Icon ───

const ShieldIcon = ({ size = 16, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// ─── Main Component ───

export function VoiceprintQualityBadge({ compact = false }: VoiceprintQualityBadgeProps) {
  useThemeMode();
  const { getApiToken } = useSophiaAuth();

  const [quality, setQuality] = useState<VoiceprintQuality | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        const data = await getVoiceprintQuality(token);
        if (!cancelled) setQuality(data);
      } catch {
        // API may not be available
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getApiToken]);

  // Render nothing if loading, not enrolled, or no data
  if (loading || !quality || !quality.enrolled) return null;

  const tierCfg = getTierConfig(quality.tier);
  const progress = quality.next_milestone
    ? Math.min((quality.sample_count / quality.next_milestone) * 100, 100)
    : 100;

  // ─── Compact mode: inline badge only ───
  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 6,
        background: tierCfg.bgAlpha, color: tierCfg.color,
        fontSize: 11, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
      }}>
        <ShieldIcon size={12} color={tierCfg.color} />
        {tierCfg.label}
      </span>
    );
  }

  // ─── Full mode ───
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 14,
      background: C.hoverBg, border: `1px solid ${C.border}`,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: tierCfg.bgAlpha,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldIcon size={16} color={tierCfg.color} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'Tomorrow', sans-serif" }}>
              Voiceprint Strength
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 1 }}>
              {quality.sample_count} sample{quality.sample_count !== 1 ? 's' : ''} collected
            </div>
          </div>
        </div>

        {/* Tier badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 12px', borderRadius: 8,
          background: tierCfg.bgAlpha, color: tierCfg.color,
          fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
        }}>
          {tierCfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%', height: 6, borderRadius: 3,
        background: C.hoverBg, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: C.teal,
          width: `${progress}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Progress label */}
      {quality.next_milestone && quality.sample_count < quality.next_milestone && (
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 6, textAlign: 'right' }}>
          {quality.next_milestone - quality.sample_count} more meeting{(quality.next_milestone - quality.sample_count) !== 1 ? 's' : ''} until your voiceprint strengthens
        </div>
      )}
      {(!quality.next_milestone || quality.sample_count >= (quality.next_milestone || 0)) && (
        <div style={{ fontSize: 11, color: C.teal, marginTop: 6, textAlign: 'right', fontWeight: 500 }}>
          Maximum accuracy reached
        </div>
      )}
    </div>
  );
}

export default VoiceprintQualityBadge;
