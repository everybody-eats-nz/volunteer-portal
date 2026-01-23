import type {
  Survey,
  SurveyAssignment,
  SurveyResponse,
  SurveyToken,
  SurveyTriggerType,
  SurveyAssignmentStatus,
} from "@/generated/client";

// Re-export Prisma types
export type {
  Survey,
  SurveyAssignment,
  SurveyResponse,
  SurveyToken,
  SurveyTriggerType,
  SurveyAssignmentStatus,
};

// Question types supported by the survey system
export type SurveyQuestionType =
  | "text_short" // Single line text input
  | "text_long" // Multi-line textarea
  | "multiple_choice_single" // Radio buttons
  | "multiple_choice_multi" // Checkboxes
  | "rating_scale" // 1-5 or 1-10 scale
  | "yes_no"; // Boolean choice

// Survey question definition
export interface SurveyQuestion {
  id: string; // Unique identifier for the question
  type: SurveyQuestionType;
  text: string; // The question text
  required: boolean;
  // For multiple choice questions
  options?: string[];
  // For rating scale questions
  minValue?: number;
  maxValue?: number;
  minLabel?: string; // e.g., "Not at all likely"
  maxLabel?: string; // e.g., "Extremely likely"
  // For text questions
  placeholder?: string;
  maxLength?: number;
}

// Survey answer definition
export interface SurveyAnswer {
  questionId: string;
  value: string | string[] | number | boolean | null;
}

// Survey with parsed questions (for API responses)
export interface SurveyWithQuestions extends Omit<Survey, "questions"> {
  questions: SurveyQuestion[];
}

// Survey assignment with relations
export interface SurveyAssignmentWithSurvey extends SurveyAssignment {
  survey: SurveyWithQuestions;
}

// Survey assignment with full details (for admin views)
export interface SurveyAssignmentWithDetails extends SurveyAssignment {
  survey: SurveyWithQuestions;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  response?: SurveyResponse | null;
}

// Response with parsed answers
export interface SurveyResponseWithAnswers
  extends Omit<SurveyResponse, "answers"> {
  answers: SurveyAnswer[];
}

// Survey creation input
export interface CreateSurveyInput {
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  triggerType: SurveyTriggerType;
  triggerValue: number;
  triggerMaxValue?: number | null; // Maximum threshold (optional)
  isActive?: boolean;
}

// Survey update input
export interface UpdateSurveyInput extends Partial<CreateSurveyInput> {
  id: string;
}

// Survey response submission input
export interface SubmitSurveyInput {
  answers: SurveyAnswer[];
}

// Trigger type display info
export const SURVEY_TRIGGER_DISPLAY: Record<
  SurveyTriggerType,
  { label: string; valueLabel: string; maxValueLabel: string; description: string }
> = {
  SHIFTS_COMPLETED: {
    label: "Shifts Completed",
    valueLabel: "Minimum shifts",
    maxValueLabel: "Maximum shifts",
    description: "Triggers when volunteer completes specified number of shifts",
  },
  HOURS_VOLUNTEERED: {
    label: "Hours Volunteered",
    valueLabel: "Minimum hours",
    maxValueLabel: "Maximum hours",
    description:
      "Triggers when volunteer reaches specified number of volunteer hours",
  },
  FIRST_SHIFT: {
    label: "First Shift",
    valueLabel: "Min days after",
    maxValueLabel: "Max days after",
    description:
      "Triggers specified number of days after volunteer completes their first shift",
  },
  MANUAL: {
    label: "Manual Assignment",
    valueLabel: "Not applicable",
    maxValueLabel: "Not applicable",
    description: "Survey is manually assigned by administrators",
  },
};

// Question type display info
export const QUESTION_TYPE_DISPLAY: Record<
  SurveyQuestionType,
  { label: string; description: string }
> = {
  text_short: {
    label: "Short Text",
    description: "Single line text input",
  },
  text_long: {
    label: "Long Text",
    description: "Multi-line text area",
  },
  multiple_choice_single: {
    label: "Single Choice",
    description: "Select one option from a list",
  },
  multiple_choice_multi: {
    label: "Multiple Choice",
    description: "Select multiple options from a list",
  },
  rating_scale: {
    label: "Rating Scale",
    description: "Numeric rating (e.g., 1-5 stars)",
  },
  yes_no: {
    label: "Yes/No",
    description: "Simple yes or no question",
  },
};
