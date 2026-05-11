// --- Engine Types ---

import type { CurriculumPlan, Section } from '../curriculum/types.js';
import type {
  AnswerResult,
  CodeEvaluationClient,
  ContentItem,
  Question,
  Explanation,
} from '../content/types.js';
import type {
  CourseProgressSummary,
  SectionProgressSummary,
  SessionProgress,
  StudentState,
  TopicMastery,
  TopicMasteryLevel,
  TopicProgressSummary,
} from '../student/types.js';
import type { ProviderClient } from '../provider/types.js';
import type { TopicContentGenerator } from '../content/ContentGenerator.js';

export type EngineState =
  | 'idle' // no syllabus loaded
  | 'planning' // analyzing syllabus via LLM
  | 'ready' // curriculum plan available, no section started
  | 'loading' // generating content for a section
  | 'practicing' // student is viewing content or answering a question
  | 'answered' // student submitted an answer, viewing result
  | 'sectionComplete' // all items in the current section are done
  | 'complete' // all sections done
  | 'error'; // content generation failed

export type CourseEngineConfig = {
  apiKey: string;
  model?: string;
  provider?: ProviderClient;
  generator?: TopicContentGenerator;
  codeEvaluator?: CodeEvaluationClient;
  prefetch?: {
    enabled: boolean;
    generator?: TopicContentGenerator;
  };
};

export type EngineSnapshot = {
  version: number;
  state: EngineState;
  curriculum: CurriculumPlan | null;
  currentSectionIndex: number;
  currentItemIndex: number;
  sectionItems: ContentItem[];
  allGeneratedContent: Record<string, ContentItem[]>;
  studentState: StudentState;
  lastAnswerResult: AnswerResult | null;
};

// Re-export types that consumers need
export type {
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
};
