// --- Recorded Fixture: Quiz Generation v1.4 ---
// Captured-format Claude responses for the expanded v1.4 quiz schema.
// These cover quantitative, creative-practical, and programming topics.

import type { QuestionType } from '../../../src/content/types.js';
import type { Topic } from '../../../src/curriculum/types.js';
import type { ProviderResponse } from '../../../src/provider/types.js';

export type RecordedV14QuizCase = {
  label: string;
  courseTitle: string;
  sectionTitle: string;
  topic: Topic;
  explanationContent: string;
  expectedTypes: QuestionType[];
  response: ProviderResponse;
};

export const RECORDED_V14_QUIZ_CASES: RecordedV14QuizCase[] = [
  {
    label: 'statistics confidence intervals',
    courseTitle: 'Applied Statistics',
    sectionTitle: 'Inference from Samples',
    topic: {
      id: 'confidence-intervals',
      title: 'Confidence Intervals',
      description:
        'Using sample statistics, standard error, and critical values to estimate plausible population parameters.',
    },
    explanationContent:
      'A confidence interval estimates a population parameter by combining a sample statistic with a margin of error. For a mean, the margin of error depends on the standard error and a critical value chosen from the confidence level. A 95% confidence interval means that the method would capture the true parameter in about 95% of repeated samples.',
    expectedTypes: ['multiple-choice', 'numeric-input', 'multi-select'],
    response: {
      id: 'msg_quiz_v14_stats_01',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_quiz_v14_stats_01',
          name: 'create_quiz_questions',
          input: {
            questions: [
              {
                type: 'multiple-choice',
                question:
                  'What does a 95% confidence interval describe about the estimation method?',
                options: [
                  'It captures the true parameter in about 95% of repeated samples',
                  'It proves the sample mean has a 95% chance of being correct',
                  'It guarantees 95% of observations fall inside the interval',
                  'It makes the population standard deviation 95% smaller',
                ],
                correctIndex: 0,
              },
              {
                type: 'numeric-input',
                question:
                  'A sample mean is 42 and the margin of error is 3. What is the upper end of the confidence interval?',
                correctValue: 45,
                tolerance: 0,
              },
              {
                type: 'multi-select',
                question:
                  'Select ALL quantities that directly affect the margin of error for a confidence interval:',
                options: [
                  'The standard error of the statistic',
                  'The chosen confidence level',
                  'The alphabetical order of variables',
                  'The critical value used by the method',
                  'The color of the graph labels',
                ],
                correctIndices: [0, 1, 3],
              },
            ],
          },
        },
      ],
      model: 'claude-sonnet-4-20250514',
      stopReason: 'tool_use',
      usage: { inputTokens: 760, outputTokens: 430 },
    },
  },
  {
    label: 'watercolor gradient washes',
    courseTitle: 'Beginning Watercolor',
    sectionTitle: 'Brush Control',
    topic: {
      id: 'gradient-washes',
      title: 'Gradient Washes',
      description:
        'Creating smooth value transitions by controlling pigment load, water, brush angle, and timing.',
    },
    explanationContent:
      'A gradient wash moves from darker pigment to lighter pigment by gradually diluting the paint while the paper remains damp. Smooth transitions depend on keeping a wet edge, using consistent brush strokes, and adding clean water before hard edges form. Students should prepare paint, test the value range, and work steadily from top to bottom.',
    expectedTypes: ['ordering', 'checklist', 'self-evaluation'],
    response: {
      id: 'msg_quiz_v14_watercolor_01',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_quiz_v14_watercolor_01',
          name: 'create_quiz_questions',
          input: {
            questions: [
              {
                type: 'ordering',
                question:
                  'Order these actions for painting a smooth gradient wash from first to last:',
                items: [
                  'Pull the wet edge downward with steady strokes',
                  'Mix a darker starting puddle of paint',
                  'Add clean water to lighten the next strokes',
                  'Let the wash dry without reworking it',
                ],
                correctOrder: [1, 0, 2, 3],
              },
              {
                type: 'checklist',
                question: 'Check each preparation step before starting a gradient wash:',
                items: [
                  'Tape the paper so it stays flat while damp',
                  'Mix enough pigment for the first dark pass',
                  'Keep clean water ready for gradual dilution',
                  'Test the brush stroke on scrap paper first',
                ],
              },
              {
                type: 'self-evaluation',
                question: 'How well can you control the wet edge during a gradient wash?',
                options: [
                  'I lose the wet edge before the wash is complete',
                  'I can keep it moving with occasional hard edges',
                  'I can maintain a smooth edge through the whole wash',
                ],
              },
            ],
          },
        },
      ],
      model: 'claude-sonnet-4-20250514',
      stopReason: 'tool_use',
      usage: { inputTokens: 720, outputTokens: 390 },
    },
  },
  {
    label: 'javascript array filtering',
    courseTitle: 'JavaScript Fundamentals',
    sectionTitle: 'Array Transformations',
    topic: {
      id: 'array-filtering',
      title: 'Array Filtering',
      description:
        'Using Array.prototype.filter to create a new array containing only elements that pass a predicate function.',
    },
    explanationContent:
      'Array filtering keeps items that satisfy a predicate and leaves the original array unchanged. The callback receives each element and returns true to keep it or false to discard it. A good filtering solution names the input clearly, chooses a readable predicate, and returns the filtered array rather than mutating the original collection.',
    expectedTypes: ['checklist', 'code', 'self-evaluation'],
    response: {
      id: 'msg_quiz_v14_javascript_01',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_quiz_v14_javascript_01',
          name: 'create_quiz_questions',
          input: {
            questions: [
              {
                type: 'checklist',
                question: 'Check each step for designing a filter-based solution:',
                items: [
                  'Identify the input array and item shape first',
                  'Write a predicate that returns true to keep',
                  'Return the new array produced by filter',
                  'Avoid mutating the original array in place',
                ],
              },
              {
                type: 'code',
                question:
                  'Write a JavaScript function that returns only scores greater than or equal to 70.',
                language: 'javascript',
                initialCode:
                  'function passingScores(scores) {\n  // return a filtered array\n}',
              },
              {
                type: 'self-evaluation',
                question:
                  'How confidently can you write a filter callback without changing the original array?',
                options: [
                  'I need help choosing the predicate',
                  'I can do it with a reference nearby',
                  'I can do it independently and explain why it works',
                ],
              },
            ],
          },
        },
      ],
      model: 'claude-sonnet-4-20250514',
      stopReason: 'tool_use',
      usage: { inputTokens: 740, outputTokens: 410 },
    },
  },
];
