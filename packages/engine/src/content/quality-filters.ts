// --- Quality Filters ---
// Structural quality checks inherited from PageQuizzer.
// These catch common LLM failure modes that make questions
// too guessable or low-value for learning.

import type { Question } from './types.js';

export type QualityIssue = {
  questionId: string;
  reason: string;
};

/**
 * Run all quality filters on a question.
 * Returns a list of issues found (empty = passed).
 */
export function checkQuestionQuality(question: Question): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (isLengthOutlier(question)) {
    issues.push({
      questionId: question.id,
      reason: 'Correct answer is significantly longer than other options (too guessable)',
    });
  }

  if (isFrontMatterQuestion(question)) {
    issues.push({
      questionId: question.id,
      reason: 'Question asks about publication metadata (low learning value)',
    });
  }

  if (hasDuplicateOptions(question)) {
    issues.push({
      questionId: question.id,
      reason: 'Question has duplicate options',
    });
  }

  return issues;
}

// --- Length Outlier Detection ---
// If the correct answer is the only long, detailed, or specific option,
// the question is too guessable. Students learn to pick the longest answer.

function isLengthOutlier(question: Question): boolean {
  if (question.type === 'numeric-input' || question.type === 'ordering') {
    return false; // These types don't have text options to compare
  }

  // Check primary options
  if (hasLengthOutlierInSet(getOptions(question), getCorrectIndex(question))) {
    return true;
  }

  // Check two-stage follow-up options separately
  if (question.type === 'two-stage') {
    if (hasLengthOutlierInSet(question.followUpOptions, question.followUpCorrectIndex)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the correct option is a length outlier within an option set.
 * Returns true if the correct answer is >2x the average length of
 * other options and longer than 30 characters.
 */
function hasLengthOutlierInSet(
  options: string[] | undefined,
  correctIndex: number | undefined
): boolean {
  if (!options || options.length < 3) return false;
  if (correctIndex === undefined || correctIndex < 0 || correctIndex >= options.length) {
    return false;
  }

  const correctLength = options[correctIndex].length;
  const otherLengths = options.filter((_, i) => i !== correctIndex).map((o) => o.length);
  const avgOtherLength =
    otherLengths.reduce((sum, len) => sum + len, 0) / otherLengths.length;

  // Flag if correct answer is more than 2x the average of others
  return correctLength > avgOtherLength * 2 && correctLength > 30;
}

// --- Front-Matter Question Detection ---
// Questions about publication metadata, authors, or edition numbers
// are low-value for learning.

const FRONT_MATTER_PATTERNS = [
  /\bauthor\b/i,
  /\bedition\b/i,
  /\bpublish/i,
  /\bISBN\b/i,
  /\bpage\s+(?:number|count)/i,
  /\btextbook\b/i,
  /\bcopyright\b/i,
  /\bprerequisite\s+course/i,
];

function isFrontMatterQuestion(question: Question): boolean {
  const text = question.question;
  return FRONT_MATTER_PATTERNS.some((pattern) => pattern.test(text));
}

// --- Duplicate Options ---

function hasDuplicateOptions(question: Question): boolean {
  const options = getOptions(question);
  if (!options) return false;

  const normalized = options.map((o) => o.trim().toLowerCase());
  return new Set(normalized).size !== normalized.length;
}

// --- Helpers ---

function getOptions(question: Question): string[] | undefined {
  switch (question.type) {
    case 'multiple-choice':
    case 'multi-select':
    case 'two-stage':
      return question.options;
    default:
      return undefined;
  }
}

function getCorrectIndex(question: Question): number | undefined {
  switch (question.type) {
    case 'multiple-choice':
    case 'two-stage':
      return question.correctIndex;
    case 'multi-select':
      // For multi-select, check each correct option individually.
      // Return the index of the longest correct option to detect
      // if any correct answer is a length outlier.
      return question.correctIndices.reduce(
        (longest, idx) =>
          longest === undefined
            ? idx
            : question.options[idx].length > question.options[longest].length
              ? idx
              : longest,
        undefined as number | undefined
      );
    default:
      return undefined;
  }
}
