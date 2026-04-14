// --- Content Types ---
// Represents generated learning content: explanations and questions.
// Question types match OpenQuizzer's proven set.

// --- Explanations ---

export type Explanation = {
  type: 'explanation';
  topicId: string;
  title: string;
  content: string; // markdown text, 2-3 paragraphs
};

// --- Question Types ---
// These mirror OpenQuizzer's 5 question types.

export type MultipleChoiceQuestion = {
  type: 'multiple-choice';
  id: string;
  topicId: string;
  question: string;
  options: string[];
  correctIndex: number;
};

export type NumericInputQuestion = {
  type: 'numeric-input';
  id: string;
  topicId: string;
  question: string;
  correctValue: number;
  tolerance?: number; // absolute tolerance, default 0
  unit?: string;
};

export type OrderingQuestion = {
  type: 'ordering';
  id: string;
  topicId: string;
  question: string;
  items: string[];
  correctOrder: number[]; // indices into items[] in correct sequence
};

export type MultiSelectQuestion = {
  type: 'multi-select';
  id: string;
  topicId: string;
  question: string;
  options: string[];
  correctIndices: number[];
};

export type TwoStageQuestion = {
  type: 'two-stage';
  id: string;
  topicId: string;
  question: string;
  options: string[];
  correctIndex: number;
  followUp: string;
  followUpOptions: string[];
  followUpCorrectIndex: number;
};

export type ChecklistQuestion = {
  type: 'checklist';
  id: string;
  topicId: string;
  question: string;
  items: string[];
};

export type CodeQuestion = {
  type: 'code';
  id: string;
  topicId: string;
  question: string;
  language: string;
  initialCode?: string;
  expectedPattern?: string; // Optional regex to check for correctness
};

export type SelfEvaluationQuestion = {
  type: 'self-evaluation';
  id: string;
  topicId: string;
  question: string;
  options: string[]; // Options for self-evaluation, e.g., ["Need more practice", "Got it"]
};

export type Question =
  | MultipleChoiceQuestion
  | NumericInputQuestion
  | OrderingQuestion
  | MultiSelectQuestion
  | TwoStageQuestion
  | ChecklistQuestion
  | CodeQuestion
  | SelfEvaluationQuestion;

export type QuestionType = Question['type'];

// --- Content Items ---
// A content item is either an explanation or a question.
// The engine emits these in the content/quiz loop order.

export type ContentItem = Explanation | Question;

// --- Answers ---

export type StudentAnswer =
  | { type: 'multiple-choice'; selectedIndex: number }
  | { type: 'numeric-input'; value: number }
  | { type: 'ordering'; order: number[] }
  | { type: 'multi-select'; selectedIndices: number[] }
  | {
      type: 'two-stage';
      selectedIndex: number;
      followUpSelectedIndex: number;
    }
  | { type: 'checklist'; checkedIndices: number[] }
  | { type: 'code'; code: string }
  | { type: 'self-evaluation'; selectedIndex: number };

export type AnswerResult = {
  correct: boolean;
  questionId: string;
  topicId: string;
  userAnswer: StudentAnswer;
  // Additional context the UI needs to render the result
  correctAnswer: string; // human-readable description of the correct answer
  explanation?: string; // optional explanation of why
};
