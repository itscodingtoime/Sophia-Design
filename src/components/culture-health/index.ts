// Culture Health domain components
export { default as RainbowOrb } from './RainbowOrb';
export type { RainbowOrbProps } from './RainbowOrb';

export { default as FeatureDonut } from './FeatureDonut';
export type { FeatureDonutProps } from './FeatureDonut';

export { default as SpaceCard } from './SpaceCard';
export type { SpaceCardProps } from './SpaceCard';

export { default as StudioCard } from './StudioCard';
export type { StudioCardProps } from './StudioCard';

export { default as SpacesOverview } from './SpacesOverview';
export type { SpacesOverviewProps } from './SpacesOverview';

export { default as SpaceDetail } from './SpaceDetail';
export type { SpaceDetailProps } from './SpaceDetail';

export { default as TrendPercent } from './TrendPercent';
export type { TrendPercentProps } from './TrendPercent';

export { default as ScoreRing } from './ScoreRing';
export type { ScoreRingProps } from './ScoreRing';

export { default as TrendDetailCard } from './TrendDetailCard';
export type { TrendDetailCardProps } from './TrendDetailCard';

export { default as FeatureExplanationCard } from './FeatureExplanationCard';
export { default as ScoringWeightsSliders } from './ScoringWeightsSliders';
export type { ScoringWeightsSlidersProps } from './ScoringWeightsSliders';

// Re-export constants, types, and helpers
export {
  FEATURE_LABELS,
  DONUT_COLORS,
  SOPHIA_PROMPTS,
  STUDIOS,
  STUDIO_DATA,
  STUDIO_FEATURES,
  DIMENSION_LETTER_TO_KEY,
  KEY_TO_DIMENSION_LETTER,
  DIMENSION_DESCRIPTIONS,
  setStudios,
  setStudioData,
  setStudioFeatures,
  mapDimensionLettersToKeys,
  getTrendWord,
  getStudioColor,
  buildConicGradient,
} from './constants';

export type {
  Studio,
  StudioMember,
  PeriodData,
  StudioDataEntry,
  StudioData,
  StudioFeatures,
} from './constants';
