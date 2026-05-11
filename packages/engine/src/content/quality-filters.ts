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
      reason: getLengthOutlierReason(question),
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
// the question is too guessable. Unkeyed practical items are also checked
// for uneven detail levels so generated sets remain balanced.

function isLengthOutlier(question: Question): boolean {
  switch (question.type) {
    case 'multiple-choice':
    case 'multi-select':
      return hasKeyedLengthOutlierInSet(
        getOptions(question),
        getCorrectIndices(question)
      );
    case 'two-stage':
      return (
        hasKeyedLengthOutlierInSet(getOptions(question), getCorrectIndices(question)) ||
        hasKeyedLengthOutlierInSet(question.followUpOptions, [
          question.followUpCorrectIndex,
        ])
      );
    case 'checklist':
      // Checklist items are all expected actions, so compare any unusually long item.
      return hasAnyLengthOutlierInSet(question.items);
    case 'self-evaluation':
      // Self-evaluation options are unkeyed, so compare any unusually long option.
      return hasAnyLengthOutlierInSet(question.options);
    case 'numeric-input':
      return false; // Numeric answers have no text options to compare.
    case 'ordering':
      return false; // Ordering items are sequence entries, not answer options.
    case 'code':
      return false; // Code prompts are open-ended and have no options to compare.
    default:
      return assertNever(question);
  }
}

/**
 * Check if the correct option is a length outlier within an option set.
 * Returns true if the correct answer is >2x the average length of
 * other options and longer than 30 characters.
 */
function hasKeyedLengthOutlierInSet(
  options: string[] | undefined,
  correctIndices: number[] | undefined
): boolean {
  if (!options || options.length < 3) return false;
  if (!correctIndices || correctIndices.length === 0) return false;

  return correctIndices.some((correctIndex) =>
    isLengthOutlierAtIndex(options, correctIndex)
  );
}

/**
 * Check if any option or item is a length outlier within an unkeyed set.
 * This is used for checklist and self-evaluation questions, which do not
 * have a single correct option but still become low-quality when one item
 * is much more detailed than its peers.
 */
function hasAnyLengthOutlierInSet(options: string[] | undefined): boolean {
  if (!options || options.length < 2) return false;

  return options.some((_, optionIndex) => isLengthOutlierAtIndex(options, optionIndex));
}

function isLengthOutlierAtIndex(options: string[], optionIndex: number): boolean {
  if (optionIndex < 0 || optionIndex >= options.length) return false;

  const candidateLength = options[optionIndex].length;
  const otherLengths = options
    .filter((_, currentIndex) => currentIndex !== optionIndex)
    .map((option) => option.length);
  const avgOtherLength =
    otherLengths.reduce((sum, len) => sum + len, 0) / otherLengths.length;

  // Flag if the candidate is more than 2x the average of its peers.
  return candidateLength > avgOtherLength * 2 && candidateLength > 30;
}

function getLengthOutlierReason(question: Question): string {
  switch (question.type) {
    case 'checklist':
      return 'Checklist item is significantly longer than other items (uneven detail level)';
    case 'self-evaluation':
      return 'Self-evaluation option is significantly longer than other options (uneven detail level)';
    case 'multiple-choice':
    case 'multi-select':
    case 'two-stage':
      return 'Correct answer is significantly longer than other options (too guessable)';
    case 'numeric-input':
    case 'ordering':
    case 'code':
      return 'Question contains a significantly longer text option';
    default:
      return assertNever(question);
  }
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
    case 'self-evaluation':
      return question.options;
    case 'checklist':
    case 'ordering':
      return question.items;
    case 'numeric-input':
      return undefined; // Numeric-input questions have no option strings.
    case 'code':
      return undefined; // Code questions are open-ended and have no option strings.
    default:
      return assertNever(question);
  }
}

function getCorrectIndices(question: Question): number[] | undefined {
  switch (question.type) {
    case 'multiple-choice':
    case 'two-stage':
      return [question.correctIndex];
    case 'multi-select':
      return [...question.correctIndices];
    case 'checklist':
      return undefined; // Checklist items are unkeyed.
    case 'self-evaluation':
      return undefined; // Self-evaluation options are unkeyed.
    case 'numeric-input':
      return undefined; // Numeric-input questions have no option index.
    case 'ordering':
      return undefined; // Ordering is graded by sequence, not a single option index.
    case 'code':
      return undefined; // Code is graded by pattern matching, not an option index.
    default:
      return assertNever(question);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled question type: ${JSON.stringify(value)}`);
}
