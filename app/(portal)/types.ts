/* ═══════════════════════════════════════════════════════════════
   TypeScript interfaces for Nu-Pure Compliance Portal pages
   Must match the shapes returned by /api/* routes (from lib/airtable.ts)
   ═══════════════════════════════════════════════════════════════ */

export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
}

export interface TrainingDocument {
  id: string;
  longName: string;
  documentCode: string;
  versionNumber: number | null;
  status: string;
  documentType: string;
  roomArea: string[];
  reTrainingFrequency: string;
  reviewedDate: string;
  nextReviewDate: string;
  daysUntilReview: number | null;
  documentUpload: AirtableAttachment[];
}

export interface TrainingRecord {
  id: string;
  name: string;
  employeeName: string;
  employmentStatus: string;
  longName: string;
  documentCode: string;
  documentType: string;
  documentStatus: string;
  versionNumber: number | null;
  reTrainingFrequency: string;
  dateOfTraining?: string;
  refresherTrainingDate?: string;
  certificate: AirtableAttachment[];
  siteAssigned: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  siteName: string;
  email: string;
  phone: string;
  suburb: string;
  state: string;
}

export interface SanitationTask {
  id: string;
  cleaningTask: string;
  area: string;
  area2: string;
  department: string;
  assetElement: string;
  cleaningFrequency: string;
  frequencyInDays: number | null;
  permitRequirement: string;
  docGotzinger: string;
  areaGroup: string;
  procedureDocument: AirtableAttachment[];
  procedureSignOffUrl: string;
}

export interface ScheduleEvent {
  id: string;
  eventId: string;
  notes: string;
  assignee: string;
  status: string;
  cleaningTask: string;
  area: string;
  area2: string;
  department: string;
  assetElement: string;
  cleaningFrequency: string;
  lastCleaningDate: string;
  actualCompletionDate: string;
  nextCleanDate: string;
  daysUntilDue: number | null;
  weekNumber: number | null;
  employees: string[];
  comments: string;
  report: AirtableAttachment[];
  preCleanPhoto1: AirtableAttachment[];
  postCleanPhoto1: AirtableAttachment[];
}

export interface HandoverReport {
  id: string;
  reportNumber: string;
  date: string;
  managerSupervisor: string;
  area: string;
  comments: string;
  report: AirtableAttachment[];
}

export interface PreOpReport {
  id: string;
  reportNumber: string;
  date: string;
  report: AirtableAttachment[];
  comments: string;
}

export interface DashboardStats {
  totalDocuments: number;
  trainingCompliance: number;
  scheduleAdherence: number;
  reportsThisMonth: number;
  staffCount: number;
}
