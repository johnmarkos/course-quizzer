export { CourseEngine, SNAPSHOT_VERSION } from './engine/CourseEngine.js';
export { InvalidTransitionError, EngineError } from './engine/errors.js';
export { ClaudeProvider } from './provider/ClaudeProvider.js';
export { RateLimiter } from './provider/rate-limiter.js';
export { ProviderError } from './provider/types.js';
export { StudentModel } from './student/StudentModel.js';
export { AdaptiveSelector } from './student/AdaptiveSelector.js';
export { SyllabusParser, validateCurriculumPlan } from './curriculum/SyllabusParser.js';
export { CurriculumManager } from './curriculum/CurriculumManager.js';
export { ContentGenerator } from './content/ContentGenerator.js';
export { ContentManager } from './content/ContentManager.js';
export { checkQuestionQuality } from './content/quality-filters.js';

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
} from './engine/types.js';

export type { EngineEvent, EngineEventMap, Listener } from './engine/events.js';

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
export type { PromptMessages } from './prompts/types.js';
export type { MasteryUpdate } from './student/StudentModel.js';

export type {
  StudentAnswer,
  QuestionType,
  MultipleChoiceQuestion,
  NumericInputQuestion,
  OrderingQuestion,
  MultiSelectQuestion,
  TwoStageQuestion,
} from './content/types.js';

export type {
  ProviderConfig,
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
export type { ClaudeProviderConfig } from './provider/ClaudeProvider.js';
export type { RateLimiterConfig } from './provider/rate-limiter.js';
