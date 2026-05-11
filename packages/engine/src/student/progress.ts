import { getMasteryStatus } from './mastery-policy.js';
import type { CurriculumPlan, Section, Topic } from '../curriculum/types.js';
import type {
  CourseProgressSummary,
  SectionProgressSummary,
  StudentState,
  TopicMastery,
  TopicProgress,
} from './types.js';

export type CourseProgressInput = {
  currentSectionIndex: number;
  studentState: StudentState;
};

function getTopicMastery(studentState: StudentState, topicId: string): TopicMastery {
  const mastery = studentState.masteryByTopic[topicId];
  return (
    mastery ?? {
      topicId,
      score: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
    }
  );
}

export function summarizeTopicProgress(
  topic: Topic,
  studentState: StudentState
): TopicProgress {
  const mastery = getTopicMastery(studentState, topic.id);
  const status = getMasteryStatus(mastery.score);

  return {
    topicId: topic.id,
    title: topic.title,
    score: mastery.score,
    questionsAnswered: mastery.questionsAnswered,
    questionsCorrect: mastery.questionsCorrect,
    status,
    needsReview: status === 'struggling',
  };
}

export function summarizeSectionProgress(
  section: Section,
  sectionIndex: number,
  currentSectionIndex: number,
  studentState: StudentState
): SectionProgressSummary {
  const topics = section.topics.map((topic) =>
    summarizeTopicProgress(topic, studentState)
  );
  const attemptedTopics = topics.filter((topic) => topic.questionsAnswered > 0);
  const mastery =
    attemptedTopics.length > 0
      ? attemptedTopics.reduce((total, topic) => total + topic.score, 0) /
        attemptedTopics.length
      : 0;

  return {
    sectionId: section.id,
    title: section.title,
    started: sectionIndex < currentSectionIndex || attemptedTopics.length > 0,
    topicsAttempted: attemptedTopics.length,
    topicsTotal: topics.length,
    mastery,
    topics,
  };
}

export function summarizeCourseProgress(
  curriculum: CurriculumPlan,
  input: CourseProgressInput
): CourseProgressSummary {
  const sections = curriculum.sections.map((section, index) =>
    summarizeSectionProgress(
      section,
      index,
      input.currentSectionIndex,
      input.studentState
    )
  );
  const allMasteries = Object.values(input.studentState.masteryByTopic);
  const attemptedMasteries = allMasteries.filter(
    (mastery) => mastery.questionsAnswered > 0
  );
  const totalQuestionsAnswered = allMasteries.reduce(
    (total, mastery) => total + mastery.questionsAnswered,
    0
  );
  const overallMastery =
    attemptedMasteries.length > 0
      ? attemptedMasteries.reduce((total, mastery) => total + mastery.score, 0) /
        attemptedMasteries.length
      : 0;

  return {
    currentSectionIndex: input.currentSectionIndex,
    totalSections: curriculum.sections.length,
    overallMastery,
    totalQuestionsAnswered,
    sections,
    hasProgress: totalQuestionsAnswered > 0,
  };
}
