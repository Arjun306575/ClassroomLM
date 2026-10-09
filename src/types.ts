export interface WhiteboardContent {
  heading: string;
  bulletPoints: string[];
  diagramType?: "none" | "process_flow" | "comparison_table" | "anatomy_chart" | "timeline_chart" | "concept_map";
  diagramLabels?: string[];
  mathEquation?: string;
  drawCommands?: any[];
  imageUrl?: string;
}

export interface TimelineStep {
  timestamp: string;
  teacherGesture: "idle" | "explaining" | "pointing_whiteboard" | "celebrating" | "writing" | "thinking";
  spokenDialogue: string;
  bubbleCaption: string;
  translationText?: string;
  whiteboardContent: WhiteboardContent;
  audioBase64?: string;
  audioTranslationBase64?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  title: string;
  description: string;
  timeline: TimelineStep[];
  quiz: QuizQuestion[];
}

export interface DoubtResponse {
  dialogue: string;
  teacherGesture: "idle" | "explaining" | "pointing_whiteboard" | "celebrating" | "writing" | "thinking";
  whiteboardChanges: WhiteboardContent;
  transitionBack: string;
}
