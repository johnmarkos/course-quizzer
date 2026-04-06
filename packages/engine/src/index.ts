export { CourseEngine } from './engine/CourseEngine.js';
export { InvalidTransitionError, EngineError } from './engine/errors.js';
export { StudentModel } from './student/StudentModel.js';

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
