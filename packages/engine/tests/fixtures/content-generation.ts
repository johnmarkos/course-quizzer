// --- Fixture: Content Generation Responses ---
// Recorded fixtures for explanation and quiz generation.

import type { ProviderResponse } from '../../src/provider/types.js';

export function explanationResponse(title: string, content: string): ProviderResponse {
  return {
    id: 'msg_explanation',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_expl',
        name: 'create_explanation',
        input: { title, content },
      },
    ],
    model: 'claude-sonnet-4-20250514',
    stopReason: 'tool_use',
    usage: { inputTokens: 200, outputTokens: 300 },
  };
}

export function quizResponse(questions: Record<string, unknown>[]): ProviderResponse {
  return {
    id: 'msg_quiz',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_quiz',
        name: 'create_quiz_questions',
        input: { questions },
      },
    ],
    model: 'claude-sonnet-4-20250514',
    stopReason: 'tool_use',
    usage: { inputTokens: 300, outputTokens: 800 },
  };
}

export function textOnlyResponse(): ProviderResponse {
  return {
    id: 'msg_text',
    content: [{ type: 'text', text: 'I cannot generate that content.' }],
    model: 'claude-sonnet-4-20250514',
    stopReason: 'end_turn',
    usage: { inputTokens: 100, outputTokens: 20 },
  };
}

// --- Sample Quiz Questions ---

export const GOOD_MCQ = {
  type: 'multiple-choice',
  question: 'What is the time complexity of binary search?',
  options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
  correctIndex: 1,
};

export const GOOD_NUMERIC = {
  type: 'numeric-input',
  question: 'What is the value of 2^10?',
  correctValue: 1024,
  tolerance: 0,
};

export const GOOD_ORDERING = {
  type: 'ordering',
  question:
    'Order these sorting algorithms by worst-case time complexity (fastest to slowest):',
  items: ['Bubble Sort', 'Merge Sort', 'Quick Sort'],
  correctOrder: [1, 2, 0],
};

export const GOOD_MULTI_SELECT = {
  type: 'multi-select',
  question: 'Select ALL stable sorting algorithms:',
  options: ['Merge Sort', 'Quick Sort', 'Insertion Sort', 'Heap Sort'],
  correctIndices: [0, 2],
};

export const GOOD_TWO_STAGE = {
  type: 'two-stage',
  question: 'What data structure does BFS use?',
  options: ['Stack', 'Queue', 'Heap'],
  correctIndex: 1,
  followUp: 'Why is a queue appropriate for BFS?',
  followUpOptions: [
    'It processes nodes in FIFO order, exploring level by level',
    'It processes nodes in LIFO order',
    'It always picks the smallest element',
  ],
  followUpCorrectIndex: 0,
};

// Question with correct answer much longer than others (should be filtered)
export const LENGTH_OUTLIER_MCQ = {
  type: 'multiple-choice',
  question: 'What is an algorithm?',
  options: [
    'A number',
    'A color',
    'A well-defined computational procedure that takes some value or set of values as input and produces some value or set of values as output, transforming the input to the output through a finite sequence of steps',
    'A food',
  ],
  correctIndex: 2,
};

// Front-matter question (should be filtered)
export const FRONT_MATTER_MCQ = {
  type: 'multiple-choice',
  question: 'Who is the author of the textbook used in this course?',
  options: ['Cormen', 'Knuth', 'Dijkstra', 'Turing'],
  correctIndex: 0,
};

// Question with duplicate options (should be filtered)
export const DUPLICATE_OPTIONS_MCQ = {
  type: 'multiple-choice',
  question: 'What is 2 + 2?',
  options: ['4', '3', '4', '5'],
  correctIndex: 0,
};
