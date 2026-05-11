import type { MasteryStatus } from './types.js';

export const GAP_THRESHOLD = 0.5;
export const PROFICIENT_THRESHOLD = 0.8;
export const BASE_GAIN = 0.15;
export const BASE_LOSS = 0.1;

export function getMasteryStatus(score: number): MasteryStatus {
  if (score < GAP_THRESHOLD) return 'struggling';
  if (score < PROFICIENT_THRESHOLD) return 'gaining';
  return 'mastered';
}
