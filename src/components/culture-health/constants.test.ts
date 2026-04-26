import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapDimensionLettersToKeys,
  DIMENSION_LETTER_TO_KEY,
  buildConicGradient,
  STUDIO_FEATURES,
  setStudioFeatures,
  DONUT_COLORS,
} from './constants';

describe('mapDimensionLettersToKeys', () => {
  it('maps A and B to ownership and inquiry', () => {
    const result = mapDimensionLettersToKeys({ A: 0.12, B: 0.15 });
    expect(result).toEqual({ ownership: 0.12, inquiry: 0.15 });
  });

  it('maps all 10 letters (A-J) to correct word keys', () => {
    const input: Record<string, number> = {
      A: 0.10, B: 0.11, C: 0.12, D: 0.13, E: 0.14,
      F: 0.15, G: 0.16, H: 0.17, I: 0.18, J: 0.19,
    };
    const result = mapDimensionLettersToKeys(input);
    expect(result).toEqual({
      ownership: 0.10,
      inquiry: 0.11,
      challenge: 0.12,
      sharing: 0.13,
      decision: 0.14,
      framing: 0.15,
      participation: 0.16,
      overlap: 0.17,
      regulation: 0.18,
      future: 0.19,
    });
  });

  it('passes through already-word-keyed features unchanged', () => {
    const input = { ownership: 0.12, inquiry: 0.15 };
    const result = mapDimensionLettersToKeys(input);
    expect(result).toEqual({ ownership: 0.12, inquiry: 0.15 });
  });

  it('handles empty object and returns empty object', () => {
    const result = mapDimensionLettersToKeys({});
    expect(result).toEqual({});
  });
});

describe('DIMENSION_LETTER_TO_KEY', () => {
  it('has exactly 10 entries (A through J)', () => {
    expect(Object.keys(DIMENSION_LETTER_TO_KEY)).toHaveLength(10);
    expect(DIMENSION_LETTER_TO_KEY.A).toBe('ownership');
    expect(DIMENSION_LETTER_TO_KEY.J).toBe('future');
  });
});

describe('buildConicGradient grey fallback', () => {
  beforeEach(() => {
    // Reset to empty features
    setStudioFeatures({});
  });

  it('returns grey gradient when STUDIO_FEATURES[studioId] is undefined', () => {
    const result = buildConicGradient('nonexistent-studio');
    expect(result).toContain('#3A3A3E');
    expect(result).not.toContain('#E8913A');
    expect(result).not.toContain('#5B8DEF');
  });

  it('returns grey gradient when STUDIO_FEATURES[studioId] is empty object', () => {
    setStudioFeatures({ 'empty-studio': {} });
    const result = buildConicGradient('empty-studio');
    expect(result).toContain('#3A3A3E');
    expect(result).not.toContain('#E8913A');
    expect(result).not.toContain('#5B8DEF');
  });

  it('returns real conic-gradient with DONUT_COLORS entries when features populated', () => {
    setStudioFeatures({
      'real-studio': {
        ownership: 0.15, inquiry: 0.12, challenge: 0.10, sharing: 0.13,
        decision: 0.11, framing: 0.09, future: 0.08, participation: 0.10,
        overlap: 0.06, regulation: 0.06,
      },
    });
    const result = buildConicGradient('real-studio');
    expect(result).toContain('conic-gradient');
    // Should contain at least one DONUT_COLORS entry
    const hasDonutColor = DONUT_COLORS.some(c => result.includes(c));
    expect(hasDonutColor).toBe(true);
    // Should NOT contain grey fallback
    expect(result).not.toContain('#3A3A3E');
  });
});
