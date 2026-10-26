import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseFile(filePath, department) {
  const content = fs.readFileSync(filePath, 'utf16le');
  const lines = content.split(/[\r\n\x07]+/).map(l => l.trim());

  let currentArea = null;
  const tasks = [];

  const ignoreList = [
    'PRE-OPERATIONAL MONITORING FORM',
    '(HIGH RISK AREA)',
    '(LOW RISK AREA)',
    'Area',
    'Complies',
    '(A, M, U)',
    'Defect description, Comments',
    'Corrective and/or preventive actions',
    'Verification',
    'Packing Room (Cont.)',
    'High Risk Wash Room (Cont.)',
    'Raw Material Receival (& Ham Production) (cont.)',
    'EVIDENCE OF ANY PEST OR VERMIN ACTIVITY?',
    'Low Risk Areas:    YES (   -   NO (  Comment: ____________________________________________________________________________________________',
    'Completed by:',
    'Sign:',
    'COMMENTS',
    'COMMENTS:',
    'MAINTENANCE ISSUES NOTED DURING INSPECTION: (High Risk Area)',
    'MAINTENANCE ISSUES NOTED DURING INSPECTION: (Low Risk Area)',
    'Area / Machine / Items',
    '*not counted for cleaning score',
    'A = acceptable, M = marginal, U = unacceptable.',
    'DATE: __________ \tTime started: \t________',
    'Time completed: \t________',
    'DATE: _____________'
  ];

  // Some items are areas, some are items. We can manually define the areas to be safe.
  const knownAreas = [
    'Entry Area to High Risk Area',
    'Packing Room',
    'Packing Office',
    'Bulk Pack Off Room',
    'Cutting Room',
    'Blast Chiller 1 & 2',
    'Holding Chiller',
    'Cooking Area (High Risk)',
    'Bacon Chiller 2',
    'High Risk Wash Room',
    'Entry Area to Production',
    'Production Areas',
    'Production Office',
    'Spice Room',
    'Ham Production (Batching Area)',
    'Raw Material Receival (& Ham Production)',
    'Raw Staging',
    'Cook Room (Raw)',
    'Raw Wash Room',
    'Clean Storage'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    
    // Check if it's something to ignore
    if (ignoreList.some(ignore => line.includes(ignore))) continue;
    if (line.match(/^DATE:/)) continue;
    
    // Clean up asterisks
    const cleanLine = line.replace(/\*/g, '').trim();

    if (knownAreas.includes(cleanLine) || knownAreas.includes(line)) {
      currentArea = cleanLine;
      continue;
    }

    // If we have an area, it's a task item
    if (currentArea) {
      // Ignore if it's just "Other:" without anything else
      if (cleanLine === 'Other:') continue;
      // Also ignore underscores or empty strings
      if (cleanLine.match(/^_+$/)) continue;
      
      tasks.push({
        department: department,
        area: currentArea,
        item: cleanLine
      });
    }
  }

  return tasks;
}

async function run() {
  const highRiskTasks = parseFile('C:\\Users\\chris\\.gemini\\antigravity\\scratch\\high_risk.txt', 'High Risk');
  const lowRiskTasks = parseFile('C:\\Users\\chris\\.gemini\\antigravity\\scratch\\low_risk.txt', 'Low Risk');
  
  const allTasks = [...highRiskTasks, ...lowRiskTasks];
  console.log(`Found ${allTasks.length} tasks to insert.`);

  const insertPayload = allTasks.map(t => {
    return {
      airtable_id: `gotzinger_seed_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`,
      data: {
        'Cleaning Task': `Pre-Op Check - ${t.item}`,
        'Area': t.area,
        'Department': t.department,
        'SCOPE OF WORK': t.item,
        'Frequency': 'Daily (Pre-Op)',
        'Frequency in days': 1
      },
      synced_at: new Date().toISOString()
    };
  });

  // Batch insert
  const { data, error } = await supabase
    .from('gotzinger_sanitation_tasks')
    .insert(insertPayload);

  if (error) {
    console.error("Error inserting data:", error);
  } else {
    console.log("Successfully seeded", insertPayload.length, "tasks.");
  }
}

run();
