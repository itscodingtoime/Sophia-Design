import { C } from '../../theme';

// ─── Types ───

export interface StudioMember {
  name: string;
  role: string;
  roleTitle?: string;  // Professional role from profile_json (e.g. "Product Manager")
  userId?: string;     // Clerk user ID for voiceprint lookup
}

export interface Studio {
  id: string;
  name: string;
  description: string;
  members: StudioMember[];
  warmth: number;
  trend: "up" | "down" | "flat";
  orbColors: { primary: number; secondary: number; accent: number };
  latestObs: string;
  lastMeeting: string;
}

export interface PeriodData {
  label: string;
  warmth: number;
  phase: string;
  insight: string;
  start: string[];
  stop: string[];
  keep: string[];
}

export interface StudioDataEntry {
  weeks: PeriodData[];
  months: PeriodData[];
  quarters: PeriodData[];
}

export type StudioData = StudioDataEntry;
export type StudioFeatures = Record<string, number>;

// ─── Feature Labels (10 core features from classification spec) ───

export const FEATURE_LABELS: { key: string; label: string; short: string; neg: string }[] = [
  { key: "ownership", label: "Ownership", short: "Ownership", neg: "Externalisation" },
  { key: "inquiry", label: "Inquiry", short: "Inquiry", neg: "Premature Closure" },
  { key: "challenge", label: "Constructive Challenge", short: "Challenge", neg: "Avoidance" },
  { key: "sharing", label: "Info Sharing", short: "Sharing", neg: "Hoarding" },
  { key: "decision", label: "Decision Clarity", short: "Decisions", neg: "Ambiguity" },
  { key: "framing", label: "Positive Framing", short: "Framing", neg: "Negative Framing" },
  { key: "participation", label: "Inclusive Participation", short: "Inclusion", neg: "Concentrated" },
  { key: "overlap", label: "Collaborative Overlap", short: "Collab", neg: "Competitive Interruption" },
  { key: "regulation", label: "Regulation", short: "Regulation", neg: "Escalation" },
  { key: "future", label: "Future Orientation", short: "Future", neg: "Past Focus" },
];

/** Map API letter-keyed dimension features (A-J) to FEATURE_LABELS word keys. */
export const DIMENSION_LETTER_TO_KEY: Record<string, string> = {
  A: "ownership",
  B: "inquiry",
  C: "challenge",
  D: "sharing",
  E: "decision",
  F: "framing",
  G: "participation",
  H: "overlap",
  I: "regulation",
  J: "future",
};

/** Convert API letter-keyed features to word-keyed features for STUDIO_FEATURES. */
export function mapDimensionLettersToKeys(
  features: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(features)) {
    const wordKey = DIMENSION_LETTER_TO_KEY[key];
    result[wordKey ?? key] = value;
  }
  return result;
}

/** Inverse of DIMENSION_LETTER_TO_KEY — maps word keys back to API letter keys. */
export const KEY_TO_DIMENSION_LETTER: Record<string, string> = {
  ownership: 'A', inquiry: 'B', challenge: 'C', sharing: 'D', decision: 'E',
  framing: 'F', participation: 'G', overlap: 'H', regulation: 'I', future: 'J',
};

/** Plain-language descriptions for each dimension (used by FeatureExplanationCard). */
export const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  ownership: 'How often team members take responsibility for outcomes rather than attributing results to external factors',
  inquiry: 'The degree to which team members ask genuine questions and explore ideas before jumping to conclusions',
  challenge: 'How constructively team members push back on ideas and surface disagreements versus avoiding tension',
  sharing: 'The extent to which relevant information is openly shared rather than held back or siloed',
  decision: 'How clearly decisions are articulated and committed to, versus left ambiguous or unresolved',
  framing: 'The balance between solution-oriented language and deficit-focused or blame-oriented framing',
  participation: 'How evenly conversation is distributed across team members versus dominated by few voices',
  overlap: 'Whether interruptions and overlaps reflect collaborative building or competitive talking over others',
  regulation: 'How well team members maintain emotional composure under pressure versus escalating reactions',
  future: 'The extent to which discussion focuses on future possibilities and actions versus dwelling on past events',
};

// ─── Donut Colors (10 feature colors matching FEATURE_LABELS order) ───

export const DONUT_COLORS = [
  "#E87840", // 0 Ownership — Ember (energy, taking charge) +20%
  "#58C8E8", // 1 Inquiry — Sky Steel (clarity, communication) +20%
  "#D85878", // 2 Challenge — Terracotta Rose (empathy in challenge) +20%
  "#E8B820", // 3 Sharing — Solar (open sharing, achievement) +20%
  "#B868E0", // 4 Decision — Amethyst (cognition, analysis) +20%
  "#48D898", // 5 Framing — Sage Mint (growth, positive) +20%
  "#2850D8", // 6 Participation — Royal Blue (calm, inclusive) +20%
  "#70C858", // 7 Overlap — Fern (fresh collaboration) +20%
  "#D84848", // 8 Regulation — Dusty Coral (self-control) +20%
  "#5878C8", // 9 Future — Steel Indigo (looking ahead) +20%
];

// ─── SOPHIA question prompts per studio ───

export const SOPHIA_PROMPTS: Record<string, string> = {
  sales: "How are we balancing competition with collaboration this week?",
  product: "What tension are we avoiding that needs to surface?",
  creative: "What risk did we take this week that stretched us?",
};

// ─── Mutable module-level data (updated from API via setter functions) ───

export let STUDIOS: Record<string, Studio> = {};

export let STUDIO_DATA: Record<string, StudioDataEntry> = {};

export let STUDIO_FEATURES: Record<string, Record<string, number>> = {};

// ─── Setter Functions (for API data injection) ───

export function setStudios(s: Record<string, Studio>): void {
  STUDIOS = s;
}

export function setStudioData(d: Record<string, StudioDataEntry>): void {
  STUDIO_DATA = d;
}

export function setStudioFeatures(f: Record<string, Record<string, number>>): void {
  STUDIO_FEATURES = f;
}

// ─── Helper Functions ───

/**
 * Get trend word and metadata for a studio based on recent warmth trajectory.
 * Reads from mutable module-level STUDIO_DATA.
 */
export const getTrendWord = (studioId: string): { word: string; color: string; pct: string } => {
  const data = STUDIO_DATA[studioId];
  if (!data) return { word: "Unknown", color: C.textDim, pct: "0%" };
  const weeks = data.weeks;
  if (weeks.length < 2) return { word: "New", color: C.textDim, pct: "0%" };
  const current = weeks[weeks.length - 1].warmth;
  const previous = weeks[weeks.length - 2].warmth;
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const pctStr = (change >= 0 ? "\u2191 " : "\u2193 ") + Math.abs(change).toFixed(1) + "%";
  // Also look at 3-week trend for richer context
  const threeBack = weeks.length >= 4 ? weeks[weeks.length - 4].warmth : weeks[0].warmth;
  const longerChange = threeBack > 0 ? ((current - threeBack) / threeBack) * 100 : 0;

  if (current >= 0.75 && change >= 0) return { word: "Thriving", color: "#7ED68A", pct: pctStr };
  if (current >= 0.6 && change > 3) return { word: "Accelerating", color: C.teal, pct: pctStr };
  if (current >= 0.6 && change >= 0) return { word: "Growing", color: C.teal, pct: pctStr };
  if (change > 5) return { word: "Surging", color: C.teal, pct: pctStr };
  if (change > 0 && longerChange > 0) return { word: "Climbing", color: C.teal, pct: pctStr };
  if (Math.abs(change) < 1.5 && current >= 0.5) return { word: "Steady", color: C.amber, pct: pctStr };
  if (Math.abs(change) < 1.5 && current < 0.5) return { word: "Plateaued", color: C.amber, pct: pctStr };
  if (change < -3) return { word: "Cooling", color: C.red, pct: pctStr };
  if (change < 0) return { word: "Dipping", color: C.amber, pct: pctStr };
  return { word: "Emerging", color: C.textDim, pct: pctStr };
};

/**
 * Get dominant feature color for a studio.
 * Used by graphs, rings, sparklines to match the orb.
 * Reads from mutable module-level STUDIO_FEATURES.
 */
export const getStudioColor = (studioId: string): string => {
  const features = STUDIO_FEATURES[studioId];
  if (!features) return C.teal;
  const entries = FEATURE_LABELS.map((f, i) => ({ w: features[f.key] || 0, ci: i }));
  const dom = [...entries].sort((a, b) => b.w - a.w)[0];
  return DONUT_COLORS[dom.ci];
};

/**
 * Build a smooth, blended conic-gradient from feature weights + colors.
 * Colours flow into each other organically -- no hard stops, no pie-chart look.
 * Reads from mutable module-level STUDIO_FEATURES.
 */
export const buildConicGradient = (studioId: string): string => {
  const features = STUDIO_FEATURES[studioId];
  if (!features || Object.keys(features).length === 0) {
    return "conic-gradient(from -90deg, #3A3A3E, #2E2E32, #3A3A3E)";
  }
  const entries = FEATURE_LABELS.map((f, i) => ({ raw: features[f.key] || 0, ci: i }));
  const total = entries.reduce((s, e) => s + e.raw, 0);
  // Interleave big/small for maximum colour mixing
  const sorted = [...entries].sort((a, b) => b.raw - a.raw);
  const interleaved: typeof entries = [];
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    if (lo === hi) { interleaved.push(sorted[lo]); break; }
    interleaved.push(sorted[lo++]);
    interleaved.push(sorted[hi--]);
  }
  // Smooth stops: place each colour at the MIDPOINT of its segment so CSS blends between them
  let cumulative = 0;
  const stops: string[] = [];
  interleaved.forEach(e => {
    const pct = e.raw / total;
    const midPct = ((cumulative + pct / 2) * 100).toFixed(1);
    cumulative += pct;
    stops.push(`${DONUT_COLORS[e.ci]} ${midPct}%`);
  });
  // Close the loop -- repeat the first colour at 100% so it wraps smoothly
  stops.push(`${DONUT_COLORS[interleaved[0].ci]} 100%`);
  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
};
