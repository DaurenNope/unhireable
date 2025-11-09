export interface AssessmentQuestion {
  id: string;
  type: "multi_select" | "single_choice" | "skill_selector" | "text_input" | "slider";
  question: string;
  options?: string[];
  skills?: string[];
  proficiency_levels?: string[];
  min?: number;
  max?: number;
  default?: number;
  placeholder?: string;
  required: boolean;
}

export type AssessmentAnswer = 
  | string[]
  | string
  | Record<string, string> // For skill selector
  | number; // For slider

export interface AssessmentResponse {
  assessment_id: number;
  user_id: string;
  current_question: number;
  total_questions: number;
  is_completed: boolean;
  progress_percentage?: number;
  completed_at?: string;
}

export interface AssessmentStartResponse {
  message: string;
  current_question: number;
  assessment_id: number;
  total_questions: number;
}

export interface QuestionResponse {
  question: AssessmentQuestion;
  question_number: number;
  total_questions: number;
}

export interface AnswerResponse {
  next_question: AssessmentQuestion | null;
  question_number: number;
  total_questions: number;
  assessment_complete?: boolean;
}

export interface AssessmentCompleteRequest {
  user_id: string;
  all_answers: Record<string, AssessmentAnswer>;
}

export interface AssessmentCompleteResponse {
  message: string;
  assessment_id: number;
  next_steps: string[];
}
