import { validateCurriculumPlan } from '../curriculum/SyllabusParser.js';
import { SNAPSHOT_VERSION } from '../engine/constants.js';
import type { CurriculumPlan, EngineSnapshot } from '../engine/types.js';
import type { AnswerResult, ContentItem, StudentAnswer } from '../content/types.js';
import type { StudentState } from '../student/types.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return isStringArray(value) && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isValidIndex(value: unknown, itemCount: number): value is number {
  return isNonNegativeInteger(value) && value < itemCount;
}

function isUniqueIntegerArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(isNonNegativeInteger) &&
    new Set(value).size === value.length
  );
}

function isValidIndexArray(
  value: unknown,
  itemCount: number,
  options: { requireNonEmpty?: boolean } = {}
): value is number[] {
  return (
    isUniqueIntegerArray(value) &&
    (!options.requireNonEmpty || value.length > 0) &&
    value.every((entry) => entry < itemCount)
  );
}

function isValidPermutation(value: unknown, itemCount: number): value is number[] {
  return (
    isValidIndexArray(value, itemCount) &&
    value.length === itemCount &&
    value.every((entry) => entry < itemCount)
  );
}

function isValidEngineState(value: unknown): boolean {
  return (
    value === 'idle' ||
    value === 'planning' ||
    value === 'ready' ||
    value === 'loading' ||
    value === 'practicing' ||
    value === 'grading' ||
    value === 'answered' ||
    value === 'sectionComplete' ||
    value === 'complete' ||
    value === 'error'
  );
}

function isValidStudentState(value: unknown): value is StudentState {
  if (!isPlainObject(value)) return false;
  if (!isPlainObject(value.masteryByTopic) || !isStringArray(value.gaps)) return false;

  return Object.entries(value.masteryByTopic).every(([topicId, mastery]) => {
    if (!isPlainObject(mastery)) return false;
    return (
      mastery.topicId === topicId &&
      isFiniteNumber(mastery.score) &&
      mastery.score >= 0 &&
      mastery.score <= 1 &&
      isNonNegativeInteger(mastery.questionsAnswered) &&
      isNonNegativeInteger(mastery.questionsCorrect) &&
      mastery.questionsCorrect <= mastery.questionsAnswered
    );
  });
}

function isValidStudentAnswer(value: unknown): value is StudentAnswer {
  if (!isPlainObject(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'multiple-choice':
      return isNonNegativeInteger(value.selectedIndex);
    case 'numeric-input':
      return isFiniteNumber(value.value);
    case 'ordering':
      return isUniqueIntegerArray(value.order);
    case 'multi-select':
      return isUniqueIntegerArray(value.selectedIndices);
    case 'two-stage':
      return (
        isNonNegativeInteger(value.selectedIndex) &&
        isNonNegativeInteger(value.followUpSelectedIndex)
      );
    case 'checklist':
      return isUniqueIntegerArray(value.checkedIndices);
    case 'code':
      return typeof value.code === 'string';
    case 'self-evaluation':
      return isNonNegativeInteger(value.selectedIndex);
    default:
      return false;
  }
}

function isValidAnswerResult(value: unknown): value is AnswerResult {
  if (!isPlainObject(value)) return false;

  const hasValidCodeEvaluation =
    value.codeEvaluation === undefined ||
    (isPlainObject(value.codeEvaluation) &&
      (value.codeEvaluation.verdict === 'correct' ||
        value.codeEvaluation.verdict === 'partial' ||
        value.codeEvaluation.verdict === 'incorrect') &&
      typeof value.codeEvaluation.feedback === 'string');

  return (
    typeof value.correct === 'boolean' &&
    typeof value.questionId === 'string' &&
    typeof value.topicId === 'string' &&
    typeof value.correctAnswer === 'string' &&
    (value.explanation === undefined || typeof value.explanation === 'string') &&
    hasValidCodeEvaluation &&
    isValidStudentAnswer(value.userAnswer)
  );
}

function isValidContentItem(value: unknown): value is ContentItem {
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
        isNonEmptyStringArray(value.options) &&
        isValidIndex(value.correctIndex, value.options.length)
      );
    case 'numeric-input':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isFiniteNumber(value.correctValue) &&
        (value.tolerance === undefined ||
          (isFiniteNumber(value.tolerance) && value.tolerance >= 0)) &&
        (value.unit === undefined || typeof value.unit === 'string')
      );
    case 'ordering':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isNonEmptyStringArray(value.items) &&
        isValidPermutation(value.correctOrder, value.items.length)
      );
    case 'multi-select':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isNonEmptyStringArray(value.options) &&
        isValidIndexArray(value.correctIndices, value.options.length, {
          requireNonEmpty: true,
        })
      );
    case 'two-stage':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isNonEmptyStringArray(value.options) &&
        isValidIndex(value.correctIndex, value.options.length) &&
        typeof value.followUp === 'string' &&
        isNonEmptyStringArray(value.followUpOptions) &&
        isValidIndex(value.followUpCorrectIndex, value.followUpOptions.length)
      );
    case 'checklist':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isNonEmptyStringArray(value.items)
      );
    case 'code':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        typeof value.language === 'string' &&
        (value.initialCode === undefined || typeof value.initialCode === 'string')
      );
    case 'self-evaluation':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isNonEmptyStringArray(value.options)
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

function isValidSnapshotPosition(snapshot: EngineSnapshot): boolean {
  const hasNoActivePosition =
    snapshot.currentSectionIndex === -1 &&
    snapshot.currentItemIndex === -1 &&
    snapshot.sectionItems.length === 0;

  if (snapshot.state === 'idle' || snapshot.state === 'planning') {
    return snapshot.curriculum === null && hasNoActivePosition;
  }

  if (snapshot.state === 'ready') {
    return snapshot.curriculum !== null && hasNoActivePosition;
  }

  if (snapshot.curriculum === null) {
    return false;
  }

  const hasValidSectionIndex =
    snapshot.currentSectionIndex >= 0 &&
    snapshot.currentSectionIndex < snapshot.curriculum.sections.length;

  if (!hasValidSectionIndex) {
    return false;
  }

  switch (snapshot.state) {
    case 'loading':
    case 'error':
      return snapshot.currentItemIndex === -1 && snapshot.sectionItems.length === 0;
    case 'practicing':
    case 'grading':
    case 'answered':
      return (
        snapshot.sectionItems.length > 0 &&
        snapshot.currentItemIndex >= 0 &&
        snapshot.currentItemIndex < snapshot.sectionItems.length
      );
    case 'sectionComplete':
      return (
        snapshot.sectionItems.length > 0 &&
        snapshot.currentItemIndex === snapshot.sectionItems.length
      );
    case 'complete':
      return (
        snapshot.currentSectionIndex === snapshot.curriculum.sections.length - 1 &&
        snapshot.sectionItems.length > 0 &&
        snapshot.currentItemIndex === snapshot.sectionItems.length
      );
    default:
      return false;
  }
}

// --- Canonical copies ---

function setRecordEntry<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function copyStudentAnswer(answer: StudentAnswer): StudentAnswer {
  switch (answer.type) {
    case 'multiple-choice':
      return { type: answer.type, selectedIndex: answer.selectedIndex };
    case 'numeric-input':
      return { type: answer.type, value: answer.value };
    case 'ordering':
      return { type: answer.type, order: [...answer.order] };
    case 'multi-select':
      return { type: answer.type, selectedIndices: [...answer.selectedIndices] };
    case 'two-stage':
      return {
        type: answer.type,
        selectedIndex: answer.selectedIndex,
        followUpSelectedIndex: answer.followUpSelectedIndex,
      };
    case 'checklist':
      return { type: answer.type, checkedIndices: [...answer.checkedIndices] };
    case 'code':
      return { type: answer.type, code: answer.code };
    case 'self-evaluation':
      return { type: answer.type, selectedIndex: answer.selectedIndex };
  }
}

function copyAnswerResult(result: AnswerResult): AnswerResult {
  const copy: AnswerResult = {
    correct: result.correct,
    questionId: result.questionId,
    topicId: result.topicId,
    userAnswer: copyStudentAnswer(result.userAnswer),
    correctAnswer: result.correctAnswer,
  };

  if (result.explanation !== undefined) {
    copy.explanation = result.explanation;
  }

  if (result.codeEvaluation !== undefined) {
    copy.codeEvaluation = {
      verdict: result.codeEvaluation.verdict,
      feedback: result.codeEvaluation.feedback,
    };
  }

  return copy;
}

function copyContentItem(item: ContentItem): ContentItem {
  switch (item.type) {
    case 'explanation':
      return {
        type: item.type,
        topicId: item.topicId,
        title: item.title,
        content: item.content,
      };
    case 'multiple-choice':
      return {
        type: item.type,
        id: item.id,
        topicId: item.topicId,
        question: item.question,
        options: [...item.options],
        correctIndex: item.correctIndex,
      };
    case 'numeric-input': {
      const copy: ContentItem = {
        type: item.type,
        id: item.id,
        topicId: item.topicId,
        question: item.question,
        correctValue: item.correctValue,
      };
      if (item.tolerance !== undefined) copy.tolerance = item.tolerance;
      if (item.unit !== undefined) copy.unit = item.unit;
      return copy;
    }
    case 'ordering':
      return {
        type: item.type,
        id: item.id,
        topicId: item.topicId,
        question: item.question,
        items: [...item.items],
        correctOrder: [...item.correctOrder],
      };
    case 'multi-select':
      return {
        type: item.type,
        id: item.id,
        topicId: item.topicId,
        question: item.question,
        options: [...item.options],
        correctIndices: [...item.correctIndices],
      };
    case 'two-stage':
      return {
        type: item.type,
        id: item.id,
        topicId: item.topicId,
        question: item.question,
        options: [...item.options],
        correctIndex: item.correctIndex,
        followUp: item.followUp,
        followUpOptions: [...item.followUpOptions],
        followUpCorrectIndex: item.followUpCorrectIndex,
      };
    case 'checklist':
      return {
        type: item.type,
        id: item.id,
        topicId: item.topicId,
        question: item.question,
        items: [...item.items],
      };
    case 'code': {
      const copy: ContentItem = {
        type: item.type,
        id: item.id,
        topicId: item.topicId,
        question: item.question,
        language: item.language,
      };
      if (item.initialCode !== undefined) copy.initialCode = item.initialCode;
      return copy;
    }
    case 'self-evaluation':
      return {
        type: item.type,
        id: item.id,
        topicId: item.topicId,
        question: item.question,
        options: [...item.options],
      };
  }
}

function copyGeneratedContentRecord(
  allGeneratedContent: Record<string, ContentItem[]> | undefined
): Record<string, ContentItem[]> {
  const copy: Record<string, ContentItem[]> = {};
  if (!allGeneratedContent) return copy;

  for (const [sectionId, items] of Object.entries(allGeneratedContent)) {
    setRecordEntry(copy, sectionId, items.map(copyContentItem));
  }

  return copy;
}

function copyStudentState(state: StudentState): StudentState {
  const masteryByTopic: StudentState['masteryByTopic'] = {};

  for (const [topicId, mastery] of Object.entries(state.masteryByTopic)) {
    setRecordEntry(masteryByTopic, topicId, {
      topicId: mastery.topicId,
      score: mastery.score,
      questionsAnswered: mastery.questionsAnswered,
      questionsCorrect: mastery.questionsCorrect,
    });
  }

  return {
    masteryByTopic,
    gaps: [...state.gaps],
  };
}

function copyEngineSnapshot(snapshot: EngineSnapshot): EngineSnapshot {
  return {
    version: snapshot.version,
    state: snapshot.state,
    curriculum:
      snapshot.curriculum === null ? null : validateCurriculumPlan(snapshot.curriculum),
    currentSectionIndex: snapshot.currentSectionIndex,
    currentItemIndex: snapshot.currentItemIndex,
    sectionItems: snapshot.sectionItems.map(copyContentItem),
    allGeneratedContent: copyGeneratedContentRecord(snapshot.allGeneratedContent),
    studentState: copyStudentState(snapshot.studentState),
    lastAnswerResult:
      snapshot.lastAnswerResult === null
        ? null
        : copyAnswerResult(snapshot.lastAnswerResult),
  };
}

export function validateEngineSnapshot(value: unknown): EngineSnapshot | null {
  if (!isPlainObject(value)) return null;

  const snapshot = value as EngineSnapshot;
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

  if (!isValidSnapshotPosition(snapshot)) {
    return null;
  }

  return copyEngineSnapshot(snapshot);
}
