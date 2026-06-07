// --- New Course Analysis ---
// Orchestrates the syllabus analysis flow: validate input, call provider via
// prompt builder, handle errors, and persist the resulting course.
// This module is pure logic — no Svelte, no browser APIs at import time.

import {
  SyllabusParser,
  type CurriculumPlan,
  type ProviderRequest,
  type ProviderResponse,
} from 'quizzer-engine';
import { createCourse, type CourseRecord } from '../storage/course-storage.js';
import { normalizeError } from '../errors/app-errors.js';

// --- Constants ---

export const MIN_SYLLABUS_LENGTH = 50;

// --- Types ---

export type AnalysisResult =
  | { ok: true; plan: CurriculumPlan }
  | { ok: false; error: string; errorType?: string };

// A sendMessage function matching ProviderClient.sendMessage signature.
// Accepting this as a parameter makes the module testable without real API calls.
type SendMessageFn = (request: ProviderRequest) => Promise<ProviderResponse>;

type AnalyzeSyllabusParams = {
  syllabusText: string;
  sendMessage: SendMessageFn;
};

// --- Validation ---

export function validateSyllabusInput(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 'Please enter your syllabus text.';
  }
  if (trimmed.length < MIN_SYLLABUS_LENGTH) {
    return `Syllabus text is too short (minimum ${MIN_SYLLABUS_LENGTH} characters).`;
  }
  return null;
}

// --- Analysis ---

export async function analyzeSyllabus(
  params: AnalyzeSyllabusParams
): Promise<AnalysisResult> {
  const { syllabusText, sendMessage } = params;

  // Use the engine's SyllabusParser, which handles prompt building,
  // response parsing, and retries.
  const parser = new SyllabusParser({ sendMessage });

  try {
    const plan = await parser.parse(syllabusText);
    return { ok: true, plan };
  } catch (err) {
    const normalized = normalizeError(err);
    return { ok: false, error: normalized.message, errorType: normalized.category };
  }
}

// --- Persistence ---

export function saveCourseFromPlan(plan: CurriculumPlan, storage: Storage): CourseRecord {
  return createCourse({ title: plan.title, curriculum: plan }, storage);
}
