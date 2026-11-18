import fs from 'fs';
import path from 'path';
import './env.mjs';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_TRAINING || 'appPTtErtzoAx7NAb';
const DOCS_TABLE = 'tblwtH46TSh45tpnD';
const NU_PURE_SITE_ID = 'reckkI3UVCSarhLI2';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SB_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

const SDS_SOURCE_DIRS = [
  '\\\\mjserver\\Mj Services Working Folder\\NU Pure Beverages\\SDS',
  'Z:\\NU Pure Beverages\\SDS',
];

const SDS_ITEMS = [
  {
    code: 'SDS-FHCS00016',
    productCode: 'CHRC-41015A',
    shortName: 'Airlift Jelly Bean — General Purpose Disinfectant Deodoriser',
    longName: 'SDS — Airlift Jelly Bean (General Purpose Disinfectant Deodoriser — Research Products)',
    supplier: 'Research Products (Freudenberg Home & Cleaning Solutions)',
    sdsRef: 'FHCS00016',
    version: 5.0,
    issueDate: '2026-09-04', // Issued: 04/09/2026
    reviewDate: '2031-09-04', // +5 years: 04/09/2031
    reviewYears: 5,
    sourceFilename: 'Airlift_Jellybean SDS issued 04.09.2026.pdf',
    cleanFilename: 'Airlift_Jellybean_SDS_2026-09-04.pdf',
    stocktakeCategory: 'Approved Cleaning Chemicals & SDS Register',
    stocktakeItemName: 'Airlift Jelly Bean — General Purpose Disinfectant Deodoriser (CHRC-41015A)',
    stocktakeUnit: '5L Drum',
    parLevel: 4,
    currentStock: 3,
    sortOrder: 14,
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
    code: 'SDS-TBC00007',
    productCode: 'BLAZ',
    shortName: 'Blue Lazer — Bathroom & Washroom Cleaner',
    longName: 'SDS — Blue Lazer (Bathroom & Washroom Cleaner — True Blue Chemicals)',
    supplier: 'True Blue Chemicals',
    sdsRef: 'TBC00007',
    version: 2.0,
    issueDate: '2023-09-01', // Issued: 01.09.2023
    reviewDate: '2028-09-01', // +5 years: 01.09.2028
    reviewYears: 5,
    sourceFilename: 'Blue_Lazor SDS issue 01.09.2023.pdf',
    cleanFilename: 'Blue_Lazer_SDS_2023-09-01.pdf',
    stocktakeCategory: 'Approved Cleaning Chemicals & SDS Register',
    stocktakeItemName: 'Blue Lazer — Bathroom & Washroom Cleaner (BLAZ)',
    stocktakeUnit: '5L Drum',
    parLevel: 4,
    currentStock: 3,
    sortOrder: 15,
    areas: [
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
    ],
  },
  {
    code: 'SDS-TBC00051',
    productCode: 'USAL',
    shortName: 'Use All — Multi-Purpose Hard Surface & Floor Cleaner',
    longName: 'SDS — Use All (Hard Surface & Floor Cleaner — True Blue Chemicals)',
    supplier: 'True Blue Chemicals',
    sdsRef: 'TBC00051',
    version: 2.0,
    issueDate: '2023-09-01', // Issued: 01.09.2023
    reviewDate: '2028-09-01', // +5 years: 01.09.2028
    reviewYears: 5,
    sourceFilename: 'Use_all SDS issue 01.09.2023.pdf',
    cleanFilename: 'Use_All_SDS_2023-09-01.pdf',
    stocktakeCategory: 'Approved Cleaning Chemicals & SDS Register',
    stocktakeItemName: 'Use All — Multi-Purpose Hard Surface & Floor Cleaner (USAL)',
    stocktakeUnit: '5L Drum',
    parLevel: 4,
    currentStock: 3,
    sortOrder: 16,
    areas: [
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
    ],
  },
  {
    code: 'SDS-VSCN-IC',
    productCode: 'V-SCN-DUAL-IC-EU',
    shortName: 'V-Screen Dual (Ice Cool) — Urinal Screen',
    longName: 'SDS — V-Screen Dual Ice Cool (Urinal Screen — Vectair Systems)',
    supplier: 'Vectair Systems Ltd',
    sdsRef: 'SDS_1155',
    version: 4.0,
    issueDate: '2024-02-21', // Issued: 21/02/2024
    reviewDate: '2029-02-21', // +5 years: 21/02/2029
    reviewYears: 5,
    sourceFilename: 'V-Screen-Dual-Ice-Cool_-V-SCN-DUAL-IC-EU_EN_V04_21-02-2024-1.pdf',
    cleanFilename: 'V-Screen_Dual_Ice_Cool_SDS_2024-02-21.pdf',
    stocktakeCategory: 'Approved Cleaning Chemicals & SDS Register',
    stocktakeItemName: 'V-Screen Dual Ice Cool — Urinal Screens (V-SCN-DUAL-IC-EU)',
    stocktakeUnit: 'Pack',
    parLevel: 4,
    currentStock: 3,
    sortOrder: 17,
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

function resolveSourceFile(filename) {
  for (const dir of SDS_SOURCE_DIRS) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not find SDS file: ${filename}`);
}

function computeDaysUntilReview(reviewDateStr) {
  const now = new Date();
  const rev = new Date(`${reviewDateStr}T00:00:00Z`);
  return Math.round((rev.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function uploadSdsFiles() {
  console.log('1. Copying & Uploading 4 SDS PDFs to public/docs/sds and Supabase Storage...');
  const localSdsDir = path.resolve('public/docs/sds');
  fs.mkdirSync(localSdsDir, { recursive: true });

  const uploaded = [];
  for (const item of SDS_ITEMS) {
    const srcPath = resolveSourceFile(item.sourceFilename);
    const pdfBuffer = fs.readFileSync(srcPath);
    const localDest = path.join(localSdsDir, item.cleanFilename);
    fs.writeFileSync(localDest, pdfBuffer);

    const publicObjectPath = `sds/${item.cleanFilename}`;
    const pubRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${publicObjectPath}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: pdfBuffer,
    });
    if (!pubRes.ok) {
      throw new Error(`Failed to upload ${item.cleanFilename} to documents bucket: ${await pubRes.text()}`);
    }
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/documents/${publicObjectPath}`;

    const attachmentStoragePath = `training-documents/${item.code}/${item.cleanFilename}`;
    const privRes = await fetch(`${SUPABASE_URL}/storage/v1/object/nupure-attachments/${attachmentStoragePath}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: pdfBuffer,
    });
    if (!privRes.ok) {
      throw new Error(`Failed to upload ${item.cleanFilename} to nupure-attachments: ${await privRes.text()}`);
    }

    console.log(`   ✓ Uploaded ${item.code} (${item.cleanFilename}) -> ${publicUrl}`);
    uploaded.push({
      ...item,
      publicUrl,
      attachmentStoragePath,
      fileSize: pdfBuffer.length,
    });
  }
  return uploaded;
}

async function upsertSdsInAirtableAndSupabase(uploadedItems) {
  console.log('\n2. Upserting 4 SDS Documents in Airtable (tblwtH46TSh45tpnD) & Supabase (nupure_training_documents)...');
  const formula = 'OR(FIND("Nu Pure", ARRAYJOIN({Site Name (from Grid view)})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Site Assigned})), FIND("SDS-", {Document Code}))';
  const params = new URLSearchParams({ pageSize: '100', filterByFormula: formula });
  const existingRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}?${params}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  const existingJson = existingRes.ok ? await existingRes.json() : { records: [] };
  const existingByCode = new Map();
  for (const r of existingJson.records || []) {
    const code = String(r.fields['Document Code'] || '').trim();
    if (code) existingByCode.set(code, r);
  }

  const supabaseRows = [];
  for (const item of uploadedItems) {
    const existing = existingByCode.get(item.code);
    const fields = {
      'Document Code': item.code,
      'Long Name': item.longName,
      'Document Type': 'Safety Data Sheet',
      'Status': 'Control Document',
      'Version Number': item.version,
      'Date Created': item.issueDate,
      'Reviewed Date': item.issueDate,
      'Review Period (years)': 5,
      'Re-Training Frequency': 5,
      'Requires Practical': false,
      'Site Assigned': [NU_PURE_SITE_ID],
      'Room/Area': item.areas,
      'Document Link': [
        {
          url: item.publicUrl,
          filename: `${item.code} - ${item.cleanFilename}`,
        },
      ],
    };

    let recordId = existing?.id;
    let airtableFields = {};

    if (existing) {
      const patchRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}/${existing.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields, typecast: true }),
      });
      if (patchRes.ok) {
        const updated = await patchRes.json();
        recordId = updated.id;
        airtableFields = updated.fields || {};
        console.log(`   ✓ Updated Airtable SDS [${recordId}]: ${item.code} (Issued: ${item.issueDate}, Next Review: ${item.reviewDate})`);
      } else {
        console.warn(`   ! Airtable PATCH warning for ${item.code}:`, await patchRes.text());
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
      if (postRes.ok) {
        const created = await postRes.json();
        recordId = created.id;
        airtableFields = created.fields || {};
        console.log(`   ✓ Created Airtable SDS [${recordId}]: ${item.code} (Issued: ${item.issueDate}, Next Review: ${item.reviewDate})`);
      } else {
        console.warn(`   ! Airtable POST warning for ${item.code}:`, await postRes.text());
      }
    }

    if (!recordId) {
      recordId = `rec_sds_${item.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    }

    const attObj = {
      id: `att_${recordId}`,
      url: `supabase-storage://${item.attachmentStoragePath}`,
      storagePath: item.attachmentStoragePath,
      publicUrl: item.publicUrl,
      filename: `${item.code} - ${item.cleanFilename}`,
      size: item.fileSize,
      type: 'application/pdf',
    };

    const mergedData = {
      ...airtableFields,
      ...fields,
      'Reviewed Date': item.issueDate,
      'Next Review Date': `${item.reviewDate}T00:00:00.000Z`,
      'Review Period (years)': 5,
      'days until review': computeDaysUntilReview(item.reviewDate),
      'Site Name (from Grid view)': ['Nu Pure Beverages'],
      'Document Link': [attObj],
      'Document Upload': [attObj],
    };

    supabaseRows.push({
      airtable_id: recordId,
      data: mergedData,
      synced_at: new Date().toISOString(),
    });
  }

  const upRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_training_documents`, {
    method: 'POST',
    headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(supabaseRows),
  });
  if (!upRes.ok) {
    throw new Error(`nupure_training_documents upsert failed: ${await upRes.text()}`);
  }
  console.log(`   ✓ Synced ${supabaseRows.length} SDS records to nupure_training_documents in Supabase!`);
}

async function updateChemicalStocktakeList(uploadedItems) {
  console.log('\n3. Updating nupure_stocktake_items: Deactivating old placeholder chemicals & adding the 4 SDS products...');
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_stocktake_items?select=*`, {
    headers: SB_HEADERS,
  });
  if (!getRes.ok) throw new Error(`Failed to fetch stocktake items: ${await getRes.text()}`);
  const existingItems = await getRes.json();

  // Deactivate the old generic placeholder chemicals (NP-CH-DIS5, NP-CH-FLR5, NP-CH-BTH5, NP-CH-DSH5)
  const oldChemicalCodes = new Set(['NP-CH-DIS5', 'NP-CH-FLR5', 'NP-CH-BTH5', 'NP-CH-DSH5']);
  for (const item of existingItems) {
    if (
      oldChemicalCodes.has(item.product_code) ||
      (item.category && item.category.toLowerCase().includes('chemical') && !SDS_ITEMS.some(s => s.productCode === item.product_code))
    ) {
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_stocktake_items?id=eq.${item.id}`, {
        method: 'PATCH',
        headers: SB_HEADERS,
        body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
      });
      if (patchRes.ok) {
        console.log(`   ✓ Deactivated old chemical item: ${item.item_name} (${item.product_code})`);
      }
    }
  }

  // Upsert the 4 SDS chemical/hygiene items
  for (const sds of uploadedItems) {
    const match = existingItems.find(i => i.product_code === sds.productCode);
    if (match) {
      await fetch(`${SUPABASE_URL}/rest/v1/nupure_stocktake_items?id=eq.${match.id}`, {
        method: 'PATCH',
        headers: SB_HEADERS,
        body: JSON.stringify({
          category: sds.stocktakeCategory,
          item_name: sds.stocktakeItemName,
          product_code: sds.productCode,
          unit: sds.stocktakeUnit,
          par_level: sds.parLevel,
          current_stock: sds.currentStock,
          sort_order: sds.sortOrder,
          active: true,
          updated_at: new Date().toISOString(),
        }),
      });
      console.log(`   ✓ Updated active SDS stocktake item: ${sds.stocktakeItemName}`);
    } else {
      const postRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_stocktake_items`, {
        method: 'POST',
        headers: SB_HEADERS,
        body: JSON.stringify({
          category: sds.stocktakeCategory,
          item_name: sds.stocktakeItemName,
          product_code: sds.productCode,
          unit: sds.stocktakeUnit,
          par_level: sds.parLevel,
          current_stock: sds.currentStock,
          sort_order: sds.sortOrder,
          active: true,
        }),
      });
      if (!postRes.ok) {
        throw new Error(`Failed to insert stocktake item ${sds.productCode}: ${await postRes.text()}`);
      }
      console.log(`   ✓ Inserted active SDS stocktake item: ${sds.stocktakeItemName}`);
    }
  }
}

async function main() {
  const uploadedItems = await uploadSdsFiles();
  await upsertSdsInAirtableAndSupabase(uploadedItems);
  await updateChemicalStocktakeList(uploadedItems);
  console.log('\n✅ All 4 SDS documents uploaded, 5-year review dates set, and Chemical Stocktake list updated!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
