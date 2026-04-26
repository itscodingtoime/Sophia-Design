import { C, useThemeMode } from '../../theme';
import { FEATURE_LABELS, DONUT_COLORS, DIMENSION_DESCRIPTIONS } from './constants';

const FeatureExplanationCard = () => {
  useThemeMode(); // Subscribe to theme re-renders

  return (
    <div style={{
      background: C.card,
      borderRadius: 14,
      padding: '16px 24px',
      border: `1px solid ${C.border}`,
      boxShadow: `0 2px 12px ${C.shadowColor}`,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: C.textDim,
        textTransform: 'uppercase', letterSpacing: 1.2,
        fontFamily: "'Tomorrow', sans-serif",
        marginBottom: 8,
      }}>
        What SOPHIA Measures
      </div>
      <dl style={{ margin: 0 }}>
        {FEATURE_LABELS.map((f, i) => (
          <div key={f.key} style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '8px 0',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: DONUT_COLORS[i],
              marginTop: 4, flexShrink: 0,
            }} />
            <div style={{ fontSize: 12, lineHeight: 1.6, fontFamily: "'Tomorrow', sans-serif" }}>
              <dt style={{
                display: 'inline', fontWeight: 600,
                color: DONUT_COLORS[i],
              }}>
                {f.short}
              </dt>
              <span style={{ color: C.textDim }}> — </span>
              <dd style={{
                display: 'inline', margin: 0,
                fontWeight: 400, color: C.textSec,
              }}>
                {DIMENSION_DESCRIPTIONS[f.key]}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default FeatureExplanationCard;
