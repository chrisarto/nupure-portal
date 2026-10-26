/**
 * Airtable Data Layer — Nu-Pure Compliance Portal
 *
 * Server-side only. All fetch helpers read credentials from process.env
 * and must never be imported in client components.
 */

// ─── Environment helpers ───────────────────────────────────────────────────────

const getApiKey = (): string => {
  const key = process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error("Missing env var AIRTABLE_API_KEY");
  return key;
};

const getBaseOps = (): string => {
  const id = process.env.AIRTABLE_BASE_OPS;
  if (!id) throw new Error("Missing env var AIRTABLE_BASE_OPS");
  return id;
};

const getBaseTraining = (): string => {
  const id = process.env.AIRTABLE_BASE_TRAINING;
  if (!id) throw new Error("Missing env var AIRTABLE_BASE_TRAINING");
  return id;
};

// ─── Type definitions ──────────────────────────────────────────────────────────

export interface AirtableThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  thumbnails?: {
    small?: AirtableThumbnail;
    large?: AirtableThumbnail;
    full?: AirtableThumbnail;
  };
}

/** General Schedule — tblgvbNcwzMC8iB0F */
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

/** Active Live Schedule 1 — tblos7krMNG16W4xc */
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

/** Handover Reports — tbltc3WlN061EXvbm */
export interface HandoverReport {
  id: string;
  reportNumber: string;
  date: string;
  managerSupervisor: string;
  area: string;
  comments: string;
  report: AirtableAttachment[];
}

/** Fresh Meat-Pre-op Reports — tbl4uB2uBBKgOYzfS */
export interface PreOpReport {
  id: string;
  reportNumber: string;
  date: string;
  report: AirtableAttachment[];
  comments: string;
}

/** Training Procedures — tblwtH46TSh45tpnD */
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

/** Training Record — tblKDwLcNcbuaUdUQ */
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
  dateOfTraining: string;
  refresherTrainingDate: string;
  trainingStatus: string;
  certificate: Array<{ id: string; url: string; filename: string; size: number; type: string; storagePath?: string }>;
  siteAssigned: string;
}

/** Employee record (All Employees — tblgNsUGNVoNLOhb6 in Training base) */
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

// ─── Raw Airtable response types ───────────────────────────────────────────────

interface AirtableRecord<T> {
  id: string;
  createdTime: string;
  fields: T;
}

interface AirtableListResponse<T> {
  records: AirtableRecord<T>[];
  offset?: string;
}

// ─── Generic fetch helper ──────────────────────────────────────────────────────

export interface FetchOptions {
  baseId: string;
  tableId: string;
  viewId?: string;
  fields?: string[];
  filterByFormula?: string;
  sort?: Array<{ field: string; direction?: "asc" | "desc" }>;
  maxRecords?: number;
}

// Global queue to enforce Airtable's 5 req/sec limit across the entire Next.js process
let requestQueue: Promise<void> = Promise.resolve();

async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const fetchPromise = requestQueue.then(async () => {
    // Wait 250ms between requests (max 4 per second) to stay well under the 5/sec limit
    await new Promise((resolve) => setTimeout(resolve, 250));
    return fetch(url, options);
  });
  
  // Chain the queue without holding onto the response data
  requestQueue = fetchPromise.then(() => {}).catch(() => {});
  
  return fetchPromise;
}

export async function fetchAirtableRecords<TFields extends Record<string, unknown>, TOut>(
  options: FetchOptions,
  mapRecord: (record: AirtableRecord<TFields>) => TOut,
): Promise<TOut[]> {
  const { baseId, tableId, viewId, fields, filterByFormula, sort, maxRecords } = options;
  const apiKey = getApiKey();
  const baseUrl = `https://api.airtable.com/v0/${baseId}/${tableId}`;

  const allRecords: TOut[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (viewId) params.set("view", viewId);
    if (filterByFormula) params.set("filterByFormula", filterByFormula);
    if (maxRecords) params.set("maxRecords", String(maxRecords));
    if (offset) params.set("offset", offset);

    if (fields) {
      for (const f of fields) {
        params.append("fields[]", f);
      }
    }

    if (sort) {
      sort.forEach((s, i) => {
        params.append(`sort[${i}][field]`, s.field);
        if (s.direction) params.append(`sort[${i}][direction]`, s.direction);
      });
    }

    const url = `${baseUrl}?${params.toString()}`;

    let res: Response | undefined;
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      res = await rateLimitedFetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      });

      if (res.status === 429 || res.status === 422) {
        retries++;
        if (res.status === 422 && retries >= 2) {
          // If iterator fails twice, it's dead. We need to throw.
          break;
        }
        const delay = Math.min(1000 * Math.pow(2, retries), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      break;
    }

    if (!res || !res.ok) {
      const status = res ? res.status : "Unknown";
      const statusText = res ? res.statusText : "No Response";
      const errorBody = res ? await res.text() : "Request failed completely";
      throw new Error(
        `Airtable API error ${status}: ${statusText} — ${errorBody}`,
      );
    }

    const data: AirtableListResponse<TFields> = await res.json() as AirtableListResponse<TFields>;
    allRecords.push(...data.records.map(mapRecord));
    offset = data.offset;
  } while (offset);

  return allRecords;
}

// ─── Field type helpers ────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOpt = (v: unknown): string => (typeof v === 'string' ? v : '');
const numVal = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/**
 * Airtable date fields can come back as:
 *   - ISO string: "2024-04-09"
 *   - ISO datetime: "2024-04-09T00:00:00.000Z"
 *   - Number (epoch ms from formula fields)
 *   - Empty string or null when blank
 * Returns an ISO date string or empty string.
 */
const dateStr = (v: unknown): string => {
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number' && !isNaN(v)) return new Date(v).toISOString();
  return '';
};

const strArr = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
};

const attachArr = (v: unknown): AirtableAttachment[] => {
  if (Array.isArray(v)) return v as AirtableAttachment[];
  return [];
};

// For lookup fields that return arrays of values, get the first value
const firstStr = (v: unknown): string => {
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  if (typeof v === "string") return v;
  return "";
};

const firstNum = (v: unknown): number | null => {
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "number") return v[0];
  if (typeof v === "number") return v;
  return null;
};

// ─── Domain fetch functions ────────────────────────────────────────────────────

/** General Schedule (Master Sanitation Schedule) */
export async function fetchSanitationSchedule(
  filter?: string,
): Promise<SanitationTask[]> {
  return fetchAirtableRecords<Record<string, unknown>, SanitationTask>(
    {
      baseId: getBaseOps(),
      tableId: "tblgvbNcwzMC8iB0F",
      viewId: "viwgeUfUVORxSnjEC",
      filterByFormula: filter,
    },
    (rec) => ({
      id: rec.id,
      cleaningTask: str(rec.fields["Cleaning Task"]),
      area: str(rec.fields["Area"]),
      area2: str(rec.fields["Area 2"]),
      department: str(rec.fields["Department"]),
      assetElement: str(rec.fields["SCOPE OF WORK"]),
      cleaningFrequency: str(rec.fields["Frequency"]),
      frequencyInDays: numVal(rec.fields["Frequency in days"]),
      permitRequirement: str(rec.fields["Permit Requirement"]),
      docGotzinger: str(rec.fields["Doc-Nu-Pure"]),
      areaGroup: str(rec.fields["Area (1 of 3)"]),
      procedureDocument: attachArr(rec.fields["Procedure Document "]),
      procedureSignOffUrl: str(rec.fields["Procedure Sign off URL"]),
    }),
  );
}

/** Active Live Schedule 1 */
export async function fetchActiveSchedule(
  filter?: string,
): Promise<ScheduleEvent[]> {
  return fetchAirtableRecords<Record<string, unknown>, ScheduleEvent>(
    {
      baseId: getBaseOps(),
      tableId: "tblos7krMNG16W4xc",
      viewId: "viw6x8rAskQFcuwmP",
      filterByFormula: filter || "NOT({Status} = 'OverDue')",
    },
    (rec) => ({
      id: rec.id,
      eventId: str(rec.fields["Event ID"]),
      notes: str(rec.fields["Notes"]),
      assignee: str(rec.fields["Assignee"]),
      status: str(rec.fields["Status"]),
      cleaningTask: firstStr(rec.fields["Cleaning Task (from General Schedule)"]),
      area: firstStr(rec.fields["Area (from General Schedule)"]),
      area2: firstStr(rec.fields["Area 2 (from General Schedule)"]),
      department: firstStr(rec.fields["Department (from General Schedule)"]),
      assetElement: firstStr(rec.fields["Asset / Element (from General Schedule)"]),
      cleaningFrequency: firstStr(rec.fields["Frequency (from General Schedule)"]),
      lastCleaningDate: str(rec.fields["Last Cleaning Date"]),
      actualCompletionDate: str(rec.fields["Actual Clean Date"]),
      nextCleanDate: str(rec.fields["Projected Clean Date (date format)"]) || str(rec.fields["Projected Clean Date"]),
      daysUntilDue: firstNum(rec.fields["Days until Due"]),
      weekNumber: firstNum(rec.fields["Weeknumber "]),
      employees: Array.isArray(rec.fields["Assignee"]) ? strArr(rec.fields["Assignee"]) : [str(rec.fields["Assignee"])].filter(Boolean),
      comments: str(rec.fields["Comments"]),
      report: attachArr(rec.fields["Report"]),
      preCleanPhoto1: attachArr(rec.fields["Pre-clean photo 1"]),
      postCleanPhoto1: attachArr(rec.fields["Post Cleaning Photo 1"]),
    }),
  );
}

/** Handover Reports */
export async function fetchHandoverReports(
  filter?: string,
): Promise<HandoverReport[]> {
  return fetchAirtableRecords<Record<string, unknown>, HandoverReport>(
    {
      baseId: getBaseOps(),
      tableId: "tbltc3WlN061EXvbm",
      viewId: "viw0vYLVUUTLATUVD",
      filterByFormula: filter,
    },
    (rec) => ({
      id: rec.id,
      reportNumber: str(rec.fields['Report Number']),
      date: dateStr(rec.fields['Date']),
      managerSupervisor: str(rec.fields['Manager/ Supervisor']),
      area: str(rec.fields['Area']),
      comments: str(rec.fields['Comments']),
      report: attachArr(rec.fields['Report']),
    }),
  );
}

/** Fresh Meat Pre-Op Reports */
export async function fetchPreOpReports(
  filter?: string,
): Promise<PreOpReport[]> {
  return fetchAirtableRecords<Record<string, unknown>, PreOpReport>(
    {
      baseId: getBaseOps(),
      tableId: "tbl4uB2uBBKgOYzfS",
      viewId: "viw0jU1VDK3CRlF26",
      filterByFormula: filter,
    },
    (rec) => ({
      id: rec.id,
      reportNumber: str(rec.fields['Report Number']),
      date: dateStr(rec.fields['Date']),
      report: attachArr(rec.fields['Report']),
      comments: str(rec.fields['Comments']),
    }),
  );
}

/** Training Procedure Documents (Nu-Pure only) */
export async function fetchTrainingDocuments(
  filter?: string,
): Promise<TrainingDocument[]> {
  return fetchAirtableRecords<Record<string, unknown>, TrainingDocument>(
    {
      baseId: getBaseTraining(),
      tableId: "tblwtH46TSh45tpnD",
      viewId: "viwyxQLL6vVbydraK",
      filterByFormula: filter,
    },
    (rec) => ({
      id: rec.id,
      longName: str(rec.fields["Long Name"]),
      documentCode: str(rec.fields["Document Code"]),
      versionNumber: numVal(rec.fields["Version Number"]),
      status: str(rec.fields["Status"]),
      documentType: str(rec.fields["Document Type"]),
      roomArea: strArr(rec.fields["Room/Area"]),
      reTrainingFrequency: String(rec.fields["Re-Training Frequency"] || ""),
      reviewedDate: strOpt(rec.fields["Reviewed Date"]),
      nextReviewDate: strOpt(rec.fields["Next Review Date"]),
      daysUntilReview: numVal(rec.fields["days until review"]),
      documentUpload: attachArr(rec.fields["Document Link"]),
    }),
  );
}

/** Training Records (Nu-Pure staff only) */
export async function fetchTrainingRecords(
  filter?: string,
): Promise<TrainingRecord[]> {
  return fetchAirtableRecords<Record<string, unknown>, TrainingRecord>(
    {
      baseId: getBaseTraining(),
      tableId: "tblKDwLcNcbuaUdUQ",
      viewId: "viwfSdgg8kPV6uHpq",
      filterByFormula: filter,
    },
    (rec) => ({
      id: rec.id,
      name: str(rec.fields["Name"]),
      employeeName: firstStr(rec.fields["Full Name (from Notes)"]),
      employmentStatus: firstStr(rec.fields["Employement Status"]) || str(rec.fields["Employement Status"]),
      longName: firstStr(rec.fields["Long Name"]),
      documentCode: firstStr(rec.fields["Document Code (from Training Procedures 2)"]),
      documentType: firstStr(rec.fields["Document Type (from Training Procedures 2)"]),
      documentStatus: firstStr(rec.fields["Status (from Training Procedures 2)"]),
      versionNumber: firstNum(rec.fields["Version Number (from Training Procedures 2)"]),
      reTrainingFrequency: firstStr(rec.fields["Re-Training Frequency (from Training Procedures 2)"]),
      dateOfTraining: strOpt(rec.fields["Date of Traing Conducted"]),
      refresherTrainingDate: strOpt(rec.fields["Refresher Training Date"]),
      trainingStatus: str(rec.fields["status"]),
      certificate: attachArr(rec.fields["Attachments"]),
      siteAssigned: firstStr(rec.fields["Site Assigned"]),
    }),
  );
}

/** Nu-Pure Employees (from Training base — All Employees table) */
export async function fetchStaff(
  filter?: string,
): Promise<Employee[]> {
  return fetchAirtableRecords<Record<string, unknown>, Employee>(
    {
      baseId: getBaseTraining(),
      tableId: "tblgNsUGNVoNLOhb6",
      filterByFormula: filter || "AND(FIND('Nu-Pure', {Sites Assigned}), {Status }='Current ')",
    },
    (rec) => ({
      id: rec.id,
      firstName: str(rec.fields["First Name"]),
      lastName: str(rec.fields["Last Nmae"]),
      fullName: str(rec.fields["Full Name"]),
      status: str(rec.fields["Status "]),
      siteName: firstStr(rec.fields["Site Name (from Sites Assigned)"]),
      email: str(rec.fields["Email"]),
      phone: str(rec.fields["Phone Number"]),
      suburb: str(rec.fields["Suburb"]),
      state: str(rec.fields["State"]),
    }),
  );
}

