import { validateCurriculumPlan } from '../curriculum/SyllabusParser.js';
import { SNAPSHOT_VERSION } from '../engine/constants.js';
import type { CurriculumPlan, EngineSnapshot } from '../engine/types.js';

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeSnapshot(snapshot: EngineSnapshot): EngineSnapshot {
  const copy = { ...snapshot };
  delete (copy as Record<string, unknown>)['apiKey'];
  return copy;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isValidEngineState(value: unknown): boolean {
  return (
    value === 'idle' ||
    value === 'planning' ||
    value === 'ready' ||
    value === 'loading' ||
    value === 'practicing' ||
    value === 'answered' ||
    value === 'sectionComplete' ||
    value === 'complete'
  );
}

function isValidStudentState(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (!isPlainObject(value.masteryByTopic) || !isStringArray(value.gaps)) return false;

  return Object.entries(value.masteryByTopic).every(([topicId, mastery]) => {
    if (!isPlainObject(mastery)) return false;
    return (
      mastery.topicId === topicId &&
      typeof mastery.score === 'number' &&
      typeof mastery.questionsAnswered === 'number' &&
      typeof mastery.questionsCorrect === 'number'
    );
  });
}

function isValidStudentAnswer(value: unknown): boolean {
  if (!isPlainObject(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'multiple-choice':
      return typeof value.selectedIndex === 'number';
    case 'numeric-input':
      return typeof value.value === 'number';
    case 'ordering':
      return (
        Array.isArray(value.order) &&
        value.order.every((entry) => typeof entry === 'number')
      );
    case 'multi-select':
      return (
        Array.isArray(value.selectedIndices) &&
        value.selectedIndices.every((entry) => typeof entry === 'number')
      );
    case 'two-stage':
      return (
        typeof value.selectedIndex === 'number' &&
        typeof value.followUpSelectedIndex === 'number'
      );
    case 'checklist':
      return (
        Array.isArray(value.checkedIndices) &&
        value.checkedIndices.every((entry) => typeof entry === 'number')
      );
    case 'code':
      return typeof value.code === 'string';
    case 'self-evaluation':
      return typeof value.selectedIndex === 'number';
    default:
      return false;
  }
}

function isValidAnswerResult(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.correct === 'boolean' &&
    typeof value.questionId === 'string' &&
    typeof value.topicId === 'string' &&
    typeof value.correctAnswer === 'string' &&
    (value.explanation === undefined || typeof value.explanation === 'string') &&
    isValidStudentAnswer(value.userAnswer)
  );
}

function isValidContentItem(value: unknown): boolean {
  if (!isPlainObject(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'explanation':
      return (
        typeof value.topicId === 'string' &&
        typeof value.title === 'string' &&
        typeof value.content === 'string'
      );
    case 'multiple-choice':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isStringArray(value.options) &&
        typeof value.correctIndex === 'number'
      );
    case 'numeric-input':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        typeof value.correctValue === 'number' &&
        (value.tolerance === undefined || typeof value.tolerance === 'number') &&
        (value.unit === undefined || typeof value.unit === 'string')
      );
    case 'ordering':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isStringArray(value.items) &&
        Array.isArray(value.correctOrder) &&
        value.correctOrder.every((entry) => typeof entry === 'number')
      );
    case 'multi-select':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isStringArray(value.options) &&
        Array.isArray(value.correctIndices) &&
        value.correctIndices.every((entry) => typeof entry === 'number')
      );
    case 'two-stage':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isStringArray(value.options) &&
        typeof value.correctIndex === 'number' &&
        typeof value.followUp === 'string' &&
        isStringArray(value.followUpOptions) &&
        typeof value.followUpCorrectIndex === 'number'
      );
    case 'checklist':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isStringArray(value.items)
      );
    case 'code':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        typeof value.language === 'string' &&
        (value.initialCode === undefined || typeof value.initialCode === 'string') &&
        (value.expectedPattern === undefined || typeof value.expectedPattern === 'string')
      );
    case 'self-evaluation':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isStringArray(value.options)
      );
    default:
      return false;
  }
}

function isValidCurriculum(value: unknown): value is CurriculumPlan {
  try {
    validateCurriculumPlan(value);
    return true;
  } catch {
    return false;
  }
}

function isValidGeneratedContentRecord(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    Object.values(value).every(
      (items) => Array.isArray(items) && items.every(isValidContentItem)
    )
  );
}

export function validateEngineSnapshot(value: unknown): EngineSnapshot | null {
  if (!isPlainObject(value)) return null;

  const snapshot = sanitizeSnapshot(value as EngineSnapshot);
  const supportedVersions = [3, SNAPSHOT_VERSION];
  const hasGeneratedContent = 'allGeneratedContent' in snapshot;

  if (
    !supportedVersions.includes(snapshot.version) ||
    !isValidEngineState(snapshot.state) ||
    !Number.isInteger(snapshot.currentSectionIndex) ||
    !Number.isInteger(snapshot.currentItemIndex) ||
    !Array.isArray(snapshot.sectionItems) ||
    !snapshot.sectionItems.every(isValidContentItem) ||
    (snapshot.version === SNAPSHOT_VERSION &&
      (!hasGeneratedContent ||
        !isValidGeneratedContentRecord(snapshot.allGeneratedContent))) ||
    (snapshot.version === 3 &&
      hasGeneratedContent &&
      snapshot.allGeneratedContent !== undefined &&
      !isValidGeneratedContentRecord(snapshot.allGeneratedContent)) ||
    !isValidStudentState(snapshot.studentState) ||
    (snapshot.curriculum !== null && !isValidCurriculum(snapshot.curriculum)) ||
    !('lastAnswerResult' in snapshot) ||
    (snapshot.lastAnswerResult !== null &&
      !isValidAnswerResult(snapshot.lastAnswerResult))
  ) {
    return null;
  }

  return deepCopy(snapshot);
}
