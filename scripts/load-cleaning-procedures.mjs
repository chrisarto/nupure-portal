import fs from 'fs';
import path from 'path';
import './env.mjs';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_TRAINING || 'appPTtErtzoAx7NAb';
const DOCS_TABLE = 'tblwtH46TSh45tpnD';
const TRAINING_TABLE = 'tblKDwLcNcbuaUdUQ';
const EMPLOYEES_TABLE = 'tblgNsUGNVoNLOhb6';
const NU_PURE_SITE_ID = 'reckkI3UVCSarhLI2';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SB_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

const PDF_LOCAL_PATH = path.resolve('public/docs/NuPure_Cleaning_Procedures.pdf');

const PROCEDURES_TO_LOAD = [
  {
    code: 'MJH-SOP-NUPURE-001',
    longName: 'Nu-Pure Beverages — Site Work Procedure & Standard Operating Procedures Manual (Master Manual)',
    docType: 'Work Method Statement',
    status: 'Control Document',
    version: 1.0,
    areas: [
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
      'Hygiene Services & Consumables',
    ],
  },
  {
    code: 'MJH-SOP-NP-01',
    longName: 'SOP-01 — Offices, Boardrooms, Meetings, Reception & General Floor Areas (BLUE Zone)',
    docType: 'Work Method Statement',
    status: 'Control Document',
    version: 1.0,
    areas: [
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
    ],
  },
  {
    code: 'MJH-SOP-NP-02',
    longName: 'SOP-02 — Lunchrooms, Kitchenettes, Appliances & Friday Refrigerator Interior (GREEN Zone)',
    docType: 'Work Method Statement',
    status: 'Control Document',
    version: 1.0,
    areas: [
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
    ],
  },
  {
    code: 'MJH-SOP-NP-03',
    longName: 'SOP-03 — Male, Female, Accessible & Unisex Amenities and Showers (RED / YELLOW Zone)',
    docType: 'Work Method Statement',
    status: 'Control Document',
    version: 1.0,
    areas: [
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
    ],
  },
  {
    code: 'MJH-SOP-NP-04',
    longName: 'SOP-04 — Production Laboratory Floor & Designated General Waste ONLY (Strict Lab Exclusion)',
    docType: 'Work Method Statement',
    status: 'Control Document',
    version: 1.0,
    areas: ['Production Areas'],
  },
  {
    code: 'MJH-SOP-NP-05',
    longName: 'SOP-05 — Managed Weekly Sanitary-Waste Service (Units SB-01 to SB-10)',
    docType: 'Work Method Statement',
    status: 'Control Document',
    version: 1.0,
    areas: [
      'Hygiene Services & Consumables',
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
    ],
  },
  {
    code: 'MJH-SOP-NP-06',
    longName: 'SOP-06 — Automatic Air-Freshener Dispenser Service (Units AF-01 to AF-09)',
    docType: 'Work Method Statement',
    status: 'Control Document',
    version: 1.0,
    areas: [
      'Hygiene Services & Consumables',
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
    ],
  },
  {
    code: 'MJH-SOP-NP-07',
    longName: 'SOP-07 — Weekly Consumable Stocktake & Requisition (18-Line Master)',
    docType: 'Work Method Statement',
    status: 'Control Document',
    version: 1.0,
    areas: ['Hygiene Services & Consumables'],
  },
  {
    code: 'MJH-SOP-NP-08',
    longName: 'SOP-08 — Portal Cleaning Reports, Daily Completion PDF & QR Required Actions',
    docType: 'Work Method Statement',
    status: 'Control Document',
    version: 1.0,
    areas: [
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
      'Hygiene Services & Consumables',
    ],
  },
];

// Map room codes to their SOP code
const ROOM_SOP_MAP = {
  'NP-HO-01': 'MJH-SOP-NP-01',
  'NP-HO-02': 'MJH-SOP-NP-01',
  'NP-HO-03': 'MJH-SOP-NP-01',
  'NP-HO-04': 'MJH-SOP-NP-01',
  'NP-HO-05': 'MJH-SOP-NP-03',
  'NP-HO-06': 'MJH-SOP-NP-02',
  'NP-HO-07': 'MJH-SOP-NP-01',
  'NP-PR-01': 'MJH-SOP-NP-01',
  'NP-PR-02': 'MJH-SOP-NP-01',
  'NP-PR-03': 'MJH-SOP-NP-01',
  'NP-PR-04': 'MJH-SOP-NP-04',
  'NP-PR-05': 'MJH-SOP-NP-02',
  'NP-PR-06': 'MJH-SOP-NP-03',
  'NP-PR-07': 'MJH-SOP-NP-03',
  'NP-WH-01': 'MJH-SOP-NP-01',
  'NP-WH-02': 'MJH-SOP-NP-02',
  'NP-WH-03': 'MJH-SOP-NP-01',
  'NP-WH-04': 'MJH-SOP-NP-01',
  'NP-WH-05': 'MJH-SOP-NP-03',
  'NP-WH-06': 'MJH-SOP-NP-03',
  'NP-MZ-01': 'MJH-SOP-NP-01',
  'NP-MZ-02': 'MJH-SOP-NP-02',
  'NP-MZ-03': 'MJH-SOP-NP-01',
  'NP-MZ-04': 'MJH-SOP-NP-01',
  'NP-MZ-05': 'MJH-SOP-NP-03',
  'NP-MZ-06': 'MJH-SOP-NP-03',
  'NP-GH-01': 'MJH-SOP-NP-03',
  'NP-GH-02': 'MJH-SOP-NP-02',
  'NP-GH-03': 'MJH-SOP-NP-01',
  'NP-HY-01': 'MJH-SOP-NP-05',
  'NP-HY-02': 'MJH-SOP-NP-06',
};

async function ensurePublicStorageAndUploadPdf() {
  console.log('1. Uploading NuPure_Cleaning_Procedures.pdf to Supabase Storage...');
  const pdfBuffer = fs.readFileSync(PDF_LOCAL_PATH);

  // Ensure 'documents' bucket exists and is public
  await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: SB_HEADERS,
    body: JSON.stringify({ id: 'documents', name: 'documents', public: true }),
  });
  await fetch(`${SUPABASE_URL}/storage/v1/bucket/documents`, {
    method: 'PUT',
    headers: SB_HEADERS,
    body: JSON.stringify({ id: 'documents', name: 'documents', public: true }),
  });

  // Upload to public 'documents' bucket so Airtable can fetch via public HTTPS URL
  const pubPath = 'NuPure_Cleaning_Procedures.pdf';
  const pubUpload = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${pubPath}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: pdfBuffer,
  });
  if (!pubUpload.ok) {
    throw new Error(`Public bucket upload failed: ${await pubUpload.text()}`);
  }
  const publicPdfUrl = `${SUPABASE_URL}/storage/v1/object/public/documents/${pubPath}`;
  console.log(`   ✓ Public PDF URL: ${publicPdfUrl}`);

  // Also upload to 'nupure-attachments' bucket for signed-url compatibility
  const storagePath = 'training-documents/MJH-SOP-NUPURE-001/NuPure_Cleaning_Procedures.pdf';
  const privUpload = await fetch(`${SUPABASE_URL}/storage/v1/object/nupure-attachments/${storagePath}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: pdfBuffer,
  });
  if (!privUpload.ok) {
    throw new Error(`nupure-attachments upload failed: ${await privUpload.text()}`);
  }
  console.log(`   ✓ Private attachment path: supabase-storage://${storagePath}`);

  return { publicPdfUrl, storagePath, size: pdfBuffer.length };
}

async function upsertAirtableProcedures(publicPdfUrl) {
  console.log('\n2. Upserting 9 Nu-Pure Cleaning Procedures in Airtable (tblwtH46TSh45tpnD)...');
  // Fetch existing Nu Pure docs to check for existing Document Codes
  const formula = 'OR(FIND("Nu Pure", ARRAYJOIN({Site Name (from Grid view)})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Site Assigned})), FIND("MJH-SOP", {Document Code}))';
  const params = new URLSearchParams({ pageSize: '100', filterByFormula: formula });
  const existingRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}?${params}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  const existingJson = await existingRes.json();
  const existingByCode = new Map();
  for (const r of existingJson.records || []) {
    const code = String(r.fields['Document Code'] || '').trim();
    if (code) existingByCode.set(code, r);
  }

  const airtableRecords = [];
  for (const proc of PROCEDURES_TO_LOAD) {
    const existing = existingByCode.get(proc.code);
    const fields = {
      'Document Code': proc.code,
      'Long Name': proc.longName,
      'Document Type': proc.docType,
      'Status': proc.status,
      'Version Number': proc.version,
      'Date Created': '2026-11-10',
      'Reviewed Date': '2026-11-10',
      'Review Period (years)': 1,
      'Re-Training Frequency': 1,
      'Requires Practical': true,
      'Site Assigned': [NU_PURE_SITE_ID],
      'Room/Area': proc.areas,
      'Document Link': [
        {
          url: publicPdfUrl,
          filename: `${proc.code} - NuPure_Cleaning_Procedures.pdf`,
        },
      ],
    };

    if (existing) {
      const patchRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}/${existing.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields, typecast: true }),
      });
      if (!patchRes.ok) {
        console.error(`   ! Failed to update ${proc.code}:`, await patchRes.text());
      } else {
        const updated = await patchRes.json();
        airtableRecords.push(updated);
        console.log(`   ✓ Updated Airtable record [${updated.id}]: ${proc.code} — ${proc.longName}`);
      }
    } else {
      const postRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields, typecast: true }),
      });
      if (!postRes.ok) {
        console.error(`   ! Failed to create ${proc.code}:`, await postRes.text());
      } else {
        const created = await postRes.json();
        airtableRecords.push(created);
        console.log(`   ✓ Created Airtable record [${created.id}]: ${proc.code} — ${proc.longName}`);
      }
    }
  }

  return airtableRecords;
}

async function syncAllNuPureDocsToSupabase(storagePath, pdfSize) {
  console.log('\n3. Syncing all Nu-Pure Training & Procedure Documents from Airtable to Supabase...');
  // Wait 2 seconds for Airtable attachment processing
  await new Promise(r => setTimeout(r, 2500));

  const formula = 'OR(FIND("Nu Pure", ARRAYJOIN({Site Name (from Grid view)})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Site Assigned})))';
  const params = new URLSearchParams({ pageSize: '100', filterByFormula: formula });
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}?${params}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Airtable fetch failed: ${await res.text()}`);
  const json = await res.json();
  const records = json.records || [];

  const rows = [];
  for (const rec of records) {
    const fields = { ...rec.fields };
    const code = String(fields['Document Code'] || '').trim();

    if (code.startsWith('MJH-SOP')) {
      const attObj = {
        id: `att_${rec.id}`,
        url: `supabase-storage://${storagePath}`,
        storagePath,
        filename: `${code} - NuPure_Cleaning_Procedures.pdf`,
        size: pdfSize,
        type: 'application/pdf',
      };
      fields['Document Link'] = [attObj];
      fields['Document Upload'] = [attObj];
    } else {
      for (const [field, folder] of [
        ['Document Upload', 'documents'],
        ['Document Link', 'training-documents'],
      ]) {
        if (Array.isArray(fields[field]) && fields[field].length > 0) {
          const updatedAtts = [];
          for (const att of fields[field]) {
            try {
              const safeName = (att.filename || 'doc.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
              const sp = `${folder}/${rec.id}/${att.id}-${safeName}`;
              const fileRes = await fetch(att.url);
              if (fileRes.ok) {
                const buf = await fileRes.arrayBuffer();
                await fetch(`${SUPABASE_URL}/storage/v1/object/nupure-attachments/${sp}`, {
                  method: 'POST',
                  headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    'Content-Type': att.type || 'application/pdf',
                    'x-upsert': 'true',
                  },
                  body: buf,
                });
                updatedAtts.push({ ...att, url: `supabase-storage://${sp}`, storagePath: sp });
              } else {
                updatedAtts.push(att);
              }
            } catch {
              updatedAtts.push(att);
            }
          }
          fields[field] = updatedAtts;
        }
      }
    }

    rows.push({
      airtable_id: rec.id,
      data: fields,
      synced_at: new Date().toISOString(),
    });
  }

  const upRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_training_documents`, {
    method: 'POST',
    headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!upRes.ok) throw new Error(`nupure_training_documents upsert failed: ${await upRes.text()}`);
  console.log(`   ✓ Synced ${rows.length} total Nu-Pure documents into nupure_training_documents`);
  return rows;
}

async function linkProceduresToSanitationTasks(storagePath, pdfSize) {
  console.log('\n4. Linking Cleaning Procedures PDF & SOP Codes to nupure_sanitation_tasks...');
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_sanitation_tasks?select=*`, {
    headers: SB_HEADERS,
  });
  if (!getRes.ok) throw new Error(`Failed to fetch nupure_sanitation_tasks: ${await getRes.text()}`);
  const tasks = await getRes.json();

  const updatedRows = tasks.map(row => {
    const data = { ...(row.data || {}) };
    const roomCode = String(data['DOC_Gotzinger'] || '').trim();
    const sopCode = ROOM_SOP_MAP[roomCode] || 'MJH-SOP-NUPURE-001';
    const attObj = {
      id: `att_sop_${roomCode || row.airtable_id}`,
      url: `supabase-storage://${storagePath}`,
      storagePath,
      filename: `${sopCode} — NuPure_Cleaning_Procedures.pdf`,
      size: pdfSize,
      type: 'application/pdf',
    };
    data['Procedure Document'] = [attObj];
    data['SOP Reference'] = sopCode;
    data['Master Manual'] = 'MJH-SOP-NUPURE-001';
    return {
      airtable_id: row.airtable_id,
      data,
      synced_at: new Date().toISOString(),
    };
  });

  if (updatedRows.length > 0) {
    const upRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_sanitation_tasks`, {
      method: 'POST',
      headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(updatedRows),
    });
    if (!upRes.ok) throw new Error(`nupure_sanitation_tasks update failed: ${await upRes.text()}`);
  }
  console.log(`   ✓ Linked ${updatedRows.length} Sanitation Tasks to NuPure_Cleaning_Procedures.pdf`);
}

async function linkStaffTrainingRecords(airtableProcedures, publicPdfUrl, storagePath, pdfSize) {
  console.log('\n5. Checking Nu-Pure Employees & Linking Training Records in Airtable + Supabase...');
  // Check employees in Supabase & Airtable
  const sbEmpRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_employees?select=*`, {
    headers: SB_HEADERS,
  });
  const sbEmployees = sbEmpRes.ok ? await sbEmpRes.json() : [];
  console.log(`   • Found ${sbEmployees.length} employees in nupure_employees`);

  const empFormula = 'OR(FIND("Nu Pure", ARRAYJOIN({Sites Assigned})), FIND("Nu Pure", ARRAYJOIN({Site Name (from Sites Assigned)})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Sites Assigned})))';
  const empParams = new URLSearchParams({ pageSize: '50', filterByFormula: empFormula });
  const atEmpRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${EMPLOYEES_TABLE}?${empParams}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  const atEmpJson = atEmpRes.ok ? await atEmpRes.json() : { records: [] };
  const atEmployees = atEmpJson.records || [];
  console.log(`   • Found ${atEmployees.length} Nu Pure employees in Airtable`);

  for (const e of atEmployees) {
    console.log(`     - [${e.id}] ${e.fields['Full Name'] || e.fields['First Name']}`);
  }

  // Upsert Nu Pure employees into Supabase nupure_employees
  if (atEmployees.length > 0) {
    const empRows = atEmployees.map(e => ({
      airtable_id: e.id,
      data: e.fields,
      synced_at: new Date().toISOString(),
    }));
    const upEmp = await fetch(`${SUPABASE_URL}/rest/v1/nupure_employees`, {
      method: 'POST',
      headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(empRows),
    });
    if (!upEmp.ok) console.warn('   ! nupure_employees upsert warning:', await upEmp.text());
    else console.log(`   ✓ Synced ${empRows.length} Nu-Pure Employees into nupure_employees`);
  }

  // Check existing training records for Nu Pure in Airtable
  const trFormula = 'OR(FIND("Nu Pure", ARRAYJOIN({Site Assigned})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Site Assigned})))';
  const trParams = new URLSearchParams({ pageSize: '100', filterByFormula: trFormula });
  const atTrRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TRAINING_TABLE}?${trParams}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  const atTrJson = atTrRes.ok ? await atTrRes.json() : { records: [] };
  const existingTraining = atTrJson.records || [];
  console.log(`   • Found ${existingTraining.length} existing Nu Pure training records in Airtable`);

  // For each Nu Pure employee in Airtable, ensure they have a Current Training Record for MJH-SOP-NUPURE-001 and SOP-01..08
  if (atEmployees.length > 0 && airtableProcedures.length > 0) {
    for (const emp of atEmployees) {
      const empId = emp.id;
      const empName = String(emp.fields['Full Name'] || '').trim();
      for (const proc of airtableProcedures) {
        const procId = proc.id;
        const procCode = String(proc.fields['Document Code'] || '').trim();
        const alreadyExists = existingTraining.some(tr => {
          const empLinks = tr.fields['Name of Employee'] || [];
          const procLinks = tr.fields['Training Procedure'] || [];
          return empLinks.includes(empId) && procLinks.includes(procId);
        });
        if (!alreadyExists) {
          const createTrRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TRAINING_TABLE}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: {
                'Name of Employee': [empId],
                'Training Procedure': [procId],
                status: 'Current',
                'Date of Traing Conducted': '2026-11-10',
              },
              typecast: true,
            }),
          });
          if (createTrRes.ok) {
            const trCreated = await createTrRes.json();
            console.log(`   ✓ Created Airtable Training Record [${trCreated.id}] for ${empName} -> ${procCode}`);
          } else {
            console.warn(`   ! Could not create training record for ${empName} -> ${procCode}:`, await createTrRes.text());
          }
        } else {
          console.log(`   • Training Record already exists for ${empName} -> ${procCode}`);
        }
      }
    }
  }

  // Re-fetch all Nu Pure training records from Airtable and sync to Supabase nupure_training_records
  const finalTrRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TRAINING_TABLE}?${trParams}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  if (finalTrRes.ok) {
    const finalTrJson = await finalTrRes.json();
    const trRows = (finalTrJson.records || []).map(r => ({
      airtable_id: r.id,
      data: r.fields,
      synced_at: new Date().toISOString(),
    }));
    if (trRows.length > 0) {
      const upTr = await fetch(`${SUPABASE_URL}/rest/v1/nupure_training_records`, {
        method: 'POST',
        headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(trRows),
      });
      if (!upTr.ok) console.warn('   ! nupure_training_records upsert warning:', await upTr.text());
      else console.log(`   ✓ Synced ${trRows.length} Nu-Pure Training Records into nupure_training_records`);
    }
  }
}

async function main() {
  const { publicPdfUrl, storagePath, size } = await ensurePublicStorageAndUploadPdf();
  const airtableProcedures = await upsertAirtableProcedures(publicPdfUrl);
  await syncAllNuPureDocsToSupabase(storagePath, size);
  await linkProceduresToSanitationTasks(storagePath, size);
  await linkStaffTrainingRecords(airtableProcedures, publicPdfUrl, storagePath, size);
  console.log('\n✅ Completed loading NuPure_Cleaning_Procedures.pdf into Supabase Storage, Airtable, and Supabase DB!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
