export interface ClassData {
  id?: string;
  userId: string;
  name: string;
  grade: string;
  school?: string;
  schoolFeatures?: string;
  currentProgress?: string;
  nextQuizContent?: string;
  lastPromotedYear?: number;
  createdAt?: any;
}

export interface ExamData {
  id?: string;
  userId: string;
  classId: string;
  name: string;
  date: string;
  scope?: string;
}

export interface StudentData {
  id?: string;
  userId: string;
  classId: string;
  name: string;
  status?: string;
  notes?: string;
}

export interface QuizScoreData {
  id?: string;
  userId: string;
  classId: string;
  studentId: string;
  date: string;
  score: number;
  progress?: string;
}

export interface ClassLogData {
  id?: string;
  userId: string;
  classId: string;
  date: string;
  content: string;
  homework?: string;
  attendance?: Record<string, boolean>;
  notes?: string;
  studentEvents?: Record<string, string>; // Mapping studentId to event description
  createdAt?: any;
}

export interface UserProfileData {
  id?: string; // This will be the userId
  teacherName: string;
  email: string;
  updatedAt?: any;
}
