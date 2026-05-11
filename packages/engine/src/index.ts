export { CourseEngine } from './engine/CourseEngine.js';
export { SNAPSHOT_VERSION } from './engine/constants.js';
export { InvalidTransitionError, EngineError } from './engine/errors.js';
export { ClaudeProvider } from './provider/ClaudeProvider.js';
export { createDefaultProvider } from './provider/factory.js';
export { RateLimiter } from './provider/rate-limiter.js';
export { ProviderError } from './provider/types.js';
export { StudentModel } from './student/StudentModel.js';
export { AdaptiveSelector } from './student/AdaptiveSelector.js';
export { summarizeCourseProgress } from './student/progress-summary.js';
export { SyllabusParser, validateCurriculumPlan } from './curriculum/SyllabusParser.js';
export { CurriculumManager } from './curriculum/CurriculumManager.js';
export { ContentGenerator } from './content/ContentGenerator.js';
export { ContentManager } from './content/ContentManager.js';
export { CodeEvaluator } from './content/CodeEvaluator.js';
export { checkQuestionQuality } from './content/quality-filters.js';
export { Exporter } from './export/Exporter.js';
export { Importer } from './export/Importer.js';
export { validateEngineSnapshot } from './export/snapshot-validation.js';
export type { ExportBundle } from './export/Exporter.js';

export type {
  CourseEngineConfig,
  EngineSnapshot,
  EngineState,
  CurriculumPlan,
  Section,
  ContentItem,
  Question,
  Explanation,
  AnswerResult,
  StudentState,
  SessionProgress,
  TopicMastery,
  TopicMasteryLevel,
  TopicProgressSummary,
  SectionProgressSummary,
  CourseProgressSummary,
} from './engine/types.js';

export type {
  ApiCallEvent,
  EngineEvent,
  EngineEventMap,
  Listener,
} from './engine/events.js';

export type { Topic } from './curriculum/types.js';

export {
  buildSyllabusAnalysisPrompt,
  SYLLABUS_ANALYSIS_VERSION,
} from './prompts/syllabus-analysis.js';
export { buildExplanationPrompt, EXPLANATION_VERSION } from './prompts/explanation.js';
export {
  buildQuizGenerationPrompt,
  QUIZ_GENERATION_VERSION,
} from './prompts/quiz-generation.js';
export {
  buildCodeEvaluationPrompt,
  CODE_EVALUATION_VERSION,
} from './prompts/code-evaluation.js';
export type { PromptMessages } from './prompts/types.js';
export type { MasteryUpdate } from './student/StudentModel.js';

export type {
  CodeEvaluation,
  CodeEvaluationVerdict,
  CodeQuestion,
  CodeStudentAnswer,
  StudentAnswer,
  NonCodeStudentAnswer,
  QuestionType,
  MultipleChoiceQuestion,
  NumericInputQuestion,
  OrderingQuestion,
  MultiSelectQuestion,
  TwoStageQuestion,
} from './content/types.js';

export type { CodeAnswerEvaluator } from './content/CodeEvaluator.js';

export type {
  ProviderConfig,
  ProviderClient,
  ProviderRequest,
  ProviderResponse,
  ProviderErrorType,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  Message,
  MessageRole,
  ToolDefinition,
  ToolChoice,
} from './provider/types.js';

export type { QualityIssue } from './content/quality-filters.js';
export type { TopicContentGenerator } from './content/ContentGenerator.js';
export type { ClaudeProviderConfig } from './provider/ClaudeProvider.js';
export type { RateLimiterConfig } from './provider/rate-limiter.js';
