// --- New Course Analysis ---
// Orchestrates the syllabus analysis flow: validate input, call provider via
// SyllabusParser, handle errors, and persist the resulting course.
// This module is pure logic — no Svelte, no browser APIs at import time.

import {
  SyllabusParser,
  ProviderError,
  validateCurriculumPlan,
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

// A sendMessage function matching ClaudeProvider.sendMessage signature.
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

// --- Error Sanitization ---
// Delegates to the centralized normalizeError utility, which maps provider,
// engine, storage, and unknown errors to user-safe messages.

// --- Analysis ---

export async function analyzeSyllabus(
  params: AnalyzeSyllabusParams
): Promise<AnalysisResult> {
  const { syllabusText, sendMessage } = params;

  // Build the prompt via SyllabusParser internals:
  // We construct a SyllabusParser-compatible flow manually here because
  // SyllabusParser.parse() requires a ClaudeProvider instance. Instead, we
  // use the same prompt builder and validation the parser uses, but wire in
  // the sendMessage function directly.
  const { buildSyllabusAnalysisPrompt } = await import('quizzer-engine');

  const prompt = buildSyllabusAnalysisPrompt(syllabusText);
  const MAX_TOKENS = 4096;

  try {
    let response = await sendMessage({ ...prompt, maxTokens: MAX_TOKENS });

    // Try to extract and validate the plan
    try {
      const plan = extractPlan(response);
      return { ok: true, plan };
    } catch {
      // Retry once on malformed response
      response = await sendMessage({ ...prompt, maxTokens: MAX_TOKENS });
      const plan = extractPlan(response);
      return { ok: true, plan };
    }
  } catch (err) {
    const normalized = normalizeError(err);
    return { ok: false, error: normalized.message, errorType: normalized.category };
  }
}

// --- Response Extraction ---
// Mirrors SyllabusParser's extraction logic.

function extractPlan(response: ProviderResponse): CurriculumPlan {
  const toolBlock = response.content.find(
    (block): block is Extract<(typeof response.content)[number], { type: 'tool_use' }> =>
      block.type === 'tool_use' &&
      'name' in block &&
      block.name === 'create_curriculum_plan'
  );

  if (!toolBlock) {
    throw new Error(
      'Syllabus analysis response did not contain a create_curriculum_plan tool use'
    );
  }

  return validateCurriculumPlan(toolBlock.input);
}

// --- Persistence ---

export function saveCourseFromPlan(plan: CurriculumPlan, storage: Storage): CourseRecord {
  return createCourse({ title: plan.title, curriculum: plan }, storage);
}
