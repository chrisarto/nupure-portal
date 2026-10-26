/* ═══════════════════════════════════════════════════════════════
   Shared type definitions for Nu-Pure Compliance Portal
   Single source of truth — imported by all API routes and pages.
   ═══════════════════════════════════════════════════════════════ */

export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  storagePath?: string;
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
  trainingStatus: string;
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
  photo?: AirtableAttachment[];
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

/** Generic paginated API response */
export interface ApiResponse<T> {
  data: T[];
  count: number;
}

/* ═══════════════════════════════════════════════════════════════
   Dynamic Form Engine — Stage 3
   ═══════════════════════════════════════════════════════════════ */

export interface FormItem {
  id: string;
  label: string;
}

export interface FormSection {
  id: string;
  title: string;
  items: FormItem[];
}

export interface FormTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  form_type: string;
  sections: FormSection[];
  is_active: boolean;
  version: number;
  created_at: string;
}

export type ItemResult = 'pass' | 'fail' | 'reclean' | null;

export interface ItemResponse {
  result: ItemResult;
  comment?: string;
  photoUrl?: string; // Legacy
  photoUrls?: string[]; // New
}

export interface FormResponses {
  [itemId: string]: ItemResponse;
}

export interface FormSubmission {
  id: string;
  template_id: string;
  template_slug: string;
  template_name: string;
  submitted_by: string;
  submitted_by_email: string;
  site: string;
  area: string;
  responses: FormResponses;
  score_total: number | null;
  score_pass: number | null;
  score_fail: number | null;
  score_reclean: number | null;
  overall_score: number | null;
  status: 'draft' | 'submitted';
  pdf_url: string | null;
  notes: string;
  submitted_at: string | null;
  created_at: string;
  reclean_signed_off_by: string | null;
  reclean_signed_off_at: string | null;
}



/* ═══════════════════════════════════════════════════════════════
   Submission list & detail — Stage 4 (Portal Tab + Detail Viewer)
   ═══════════════════════════════════════════════════════════════ */

/** Row returned by GET /api/submissions (list) */
export interface SubmissionRecord {
  id: string;
  template_id: string;
  template_slug: string;
  template_name: string;
  submitted_by: string | null;
  submitted_by_email: string | null;
  site: string | null;
  area: string | null;
  score_total: number | null;
  score_pass: number | null;
  score_fail: number | null;
  score_reclean: number | null;
  overall_score: number | null;
  status: 'draft' | 'submitted';
  submitted_at: string | null;
  created_at: string;
  reclean_signed_off_by: string | null;
  reclean_signed_off_at: string | null;
}

export interface SectionScore {
  score: number;
  pass: number;
  fail: number;
  reclean: number;
  total: number;
}

/** Full record returned by GET /api/submissions/[id] */
export interface SubmissionDetail extends SubmissionRecord {
  responses: FormResponses;
  section_scores: Record<string, SectionScore>;
  notes: string | null;
  pdf_url: string | null;
}

/* ═══════════════════════════════════════════════════════════════
   Management — Meeting Minutes & Swab Roll-Up Reports
   ═══════════════════════════════════════════════════════════════ */

export interface MeetingMinute {
  id: string;
  title: string | null;
  meeting_date: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  notes: string | null;
  created_at: string;
}

export interface SwabRollupReport {
  id: string;
  title: string;
  report_type: 'weekly' | 'monthly';
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  notes: string | null;
  created_at: string;
}

