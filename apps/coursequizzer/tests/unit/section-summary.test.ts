import { describe, it, expect } from 'vitest';
import { createEngineSession } from '../../src/lib/stores/engine-session.svelte.js';
import type { CurriculumPlan, ContentItem } from 'quizzer-engine';

function mockCurriculumPlan(): CurriculumPlan {
  return {
    title: 'Intro to Testing',
    description: 'A course about testing fundamentals.',
    sections: [
      {
        id: 's1',
        title: 'Unit Testing Basics',
        order: 0,
        topics: [
          {
            id: 't1',
            title: 'What is a Unit Test?',
            description: 'The fundamentals of unit testing.',
          },
          {
            id: 't2',
            title: 'Test Runners',
            description: 'Tools that run your tests.',
          },
        ],
      },
    ],
  };
}

function mockSectionContent(): ContentItem[] {
  return [
    {
      type: 'multiple-choice',
      id: 'q1',
      topicId: 't1',
      question: 'Q1?',
      options: ['A', 'B'],
      correctIndex: 0,
    },
    {
      type: 'multiple-choice',
      id: 'q2',
      topicId: 't2',
      question: 'Q2?',
      options: ['A', 'B'],
      correctIndex: 0,
    },
  ];
}

describe('section summary data', () => {
  it('provides topic mastery data at section complete state', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockSectionContent());

    // Answer Q1 correctly
    session.submitAnswer({
      type: 'multiple-choice',
      selectedIndex: 0,
    });
    session.nextItem();

    // Answer Q2 incorrectly
    session.submitAnswer({
      type: 'multiple-choice',
      selectedIndex: 1,
    });
    session.nextItem(); // should transition to sectionComplete

    expect(session.engineState).toBe('sectionComplete');
    expect(session.studentState).not.toBeNull();

    const mastery = session.studentState!.masteryByTopic;
    expect(mastery['t1']).toBeDefined();
    expect(mastery['t1'].score).toBeGreaterThan(0);
    expect(mastery['t1'].questionsCorrect).toBe(1);

    expect(mastery['t2']).toBeDefined();
    expect(mastery['t2'].score).toBe(0);
    expect(mastery['t2'].questionsCorrect).toBe(0);

    // Check if we can identify topics for the current section
    const currentSectionTopics = session.currentSection!.section.topics;
    expect(currentSectionTopics.length).toBe(2);
    expect(currentSectionTopics[0].id).toBe('t1');
    expect(currentSectionTopics[1].id).toBe('t2');
  });
});
