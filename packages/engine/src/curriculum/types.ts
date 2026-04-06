// --- Curriculum Types ---
// Represents the structured plan produced by analyzing a syllabus.

export type Topic = {
  id: string;
  title: string;
  description: string;
};

export type Section = {
  id: string;
  title: string;
  topics: Topic[];
  order: number;
};

export type CurriculumPlan = {
  title: string;
  description: string;
  sections: Section[];
};
