// --- Recorded Fixture: MIT Algorithms Full Lifecycle ---
// Realistic API responses for the first section of a MIT 6.006 curriculum.
// Used for deterministic CI testing of the full engine lifecycle.

import type { ProviderResponse } from '../../../src/provider/types.js';

// Step 1: Syllabus → Curriculum Plan
export const SYLLABUS_RESPONSE: ProviderResponse = {
  id: 'msg_01ABC123',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_01XYZ',
      name: 'create_curriculum_plan',
      input: {
        title: 'Introduction to Algorithms',
        description:
          'An introduction to mathematical modeling of computational problems, common algorithms, algorithmic paradigms, and data structures.',
        sections: [
          {
            id: 'algorithmic-thinking',
            title: 'Algorithmic Thinking and Peak Finding',
            order: 0,
            topics: [
              {
                id: 'computational-problems',
                title: 'Computational Problems',
                description:
                  'Understanding what constitutes a computational problem and how to model real-world tasks as formal problems.',
              },
              {
                id: 'peak-finding',
                title: 'Peak Finding',
                description:
                  'Algorithms for finding a peak element in 1D and 2D arrays, introducing divide-and-conquer thinking.',
              },
            ],
          },
          {
            id: 'sorting-trees',
            title: 'Sorting and Trees',
            order: 1,
            topics: [
              {
                id: 'insertion-sort',
                title: 'Insertion Sort',
                description:
                  'A simple comparison-based sorting algorithm that builds the sorted array one element at a time.',
              },
              {
                id: 'merge-sort',
                title: 'Merge Sort',
                description:
                  'A divide-and-conquer sorting algorithm that recursively splits and merges subarrays.',
              },
              {
                id: 'heaps-bsts',
                title: 'Heaps and Binary Search Trees',
                description:
                  'Tree-based data structures: max/min heaps for priority queues and BSTs for ordered data.',
              },
            ],
          },
          {
            id: 'hashing',
            title: 'Hashing',
            order: 2,
            topics: [
              {
                id: 'hash-functions',
                title: 'Hash Functions',
                description:
                  'Functions that map keys to array indices, enabling constant-time average lookups.',
              },
              {
                id: 'collision-resolution',
                title: 'Collision Resolution',
                description:
                  'Techniques for handling hash collisions: chaining and open addressing.',
              },
            ],
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 650, outputTokens: 420 },
};

// Step 2: Explanation for "Computational Problems"
export const EXPLANATION_COMPUTATIONAL_PROBLEMS: ProviderResponse = {
  id: 'msg_02DEF456',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_02ABC',
      name: 'create_explanation',
      input: {
        title: 'What Are Computational Problems?',
        content:
          'A **computational problem** is a precise specification of a relationship between inputs and desired outputs. When we study algorithms, we formalize real-world tasks into these input-output relationships so we can reason about correctness and efficiency.\n\nFor example, the **sorting problem** takes as input a sequence of numbers and must produce an output where those numbers appear in non-decreasing order. The key insight is that there are many *instances* of this problem (different input sequences), but a single algorithm must work correctly for all of them.\n\nAn **algorithm** is a well-defined computational procedure that transforms any valid input into the correct output through a finite sequence of steps. We evaluate algorithms along two dimensions: **correctness** (does it always produce the right answer?) and **efficiency** (how many resources — time and space — does it consume as the input grows?).',
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 380, outputTokens: 250 },
};

// Step 3: Quiz burst for "Computational Problems"
export const QUIZ_COMPUTATIONAL_PROBLEMS: ProviderResponse = {
  id: 'msg_03GHI789',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_03DEF',
      name: 'create_quiz_questions',
      input: {
        questions: [
          {
            type: 'multiple-choice',
            question:
              'Which of the following best describes what an algorithm must guarantee?',
            options: [
              'It runs in constant time for all inputs',
              'It produces the correct output for every valid input in finite steps',
              'It uses the least possible memory',
              'It handles invalid inputs gracefully',
            ],
            correctIndex: 1,
          },
          {
            type: 'multi-select',
            question:
              'Select ALL dimensions along which we typically evaluate an algorithm:',
            options: [
              'Correctness',
              'Time efficiency',
              'Code readability',
              'Space efficiency',
              'Language compatibility',
            ],
            correctIndices: [0, 1, 3],
          },
          {
            type: 'numeric-input',
            question:
              'If a sorting algorithm processes a list of 5 elements, how many possible orderings (permutations) of those elements exist?',
            correctValue: 120,
            tolerance: 0,
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 720, outputTokens: 380 },
};

// Step 4: Explanation for "Peak Finding"
export const EXPLANATION_PEAK_FINDING: ProviderResponse = {
  id: 'msg_04JKL012',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_04GHI',
      name: 'create_explanation',
      input: {
        title: 'Peak Finding in Arrays',
        content:
          'A **peak** in a 1D array is an element that is greater than or equal to its neighbors. For example, in `[1, 3, 7, 4, 2]`, the value 7 at index 2 is a peak because it is ≥ both 3 and 4.\n\nThe naive approach scans left to right, checking each element — this takes **O(n)** time. But we can do better with **divide and conquer**: look at the middle element, and if its left neighbor is larger, recurse on the left half; if its right neighbor is larger, recurse on the right half; otherwise, the middle element is a peak. This gives us **O(log n)** time.\n\nPeak finding is a foundational example because it demonstrates a core algorithmic pattern: by exploiting the problem structure (a peak must exist in the "uphill" half), we reduce the search space by half at each step, achieving logarithmic rather than linear time.',
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 400, outputTokens: 270 },
};

// Step 5: Quiz burst for "Peak Finding"
export const QUIZ_PEAK_FINDING: ProviderResponse = {
  id: 'msg_05MNO345',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_05JKL',
      name: 'create_quiz_questions',
      input: {
        questions: [
          {
            type: 'multiple-choice',
            question:
              'What is the time complexity of the divide-and-conquer peak finding algorithm on a 1D array of n elements?',
            options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
            correctIndex: 1,
          },
          {
            type: 'ordering',
            question:
              'Order these steps of the 1D peak finding algorithm from first to last:',
            items: [
              'If the middle is a peak, return it',
              'Look at the middle element of the current range',
              'Recurse on the half with the larger neighbor',
              'Compare the middle element to its neighbors',
            ],
            correctOrder: [1, 3, 0, 2],
          },
          {
            type: 'two-stage',
            question: 'In the array [1, 5, 3, 8, 4], which values are peaks?',
            options: ['Only 5', 'Only 8', 'Both 5 and 8', '1 and 4'],
            correctIndex: 2,
            followUp:
              'Why is 5 considered a peak even though 8 is larger elsewhere in the array?',
            followUpOptions: [
              'A peak only needs to be ≥ its immediate neighbors, not the global maximum',
              'The first element found is always the peak',
              'Peaks are defined relative to the array median',
            ],
            followUpCorrectIndex: 0,
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 750, outputTokens: 410 },
};
