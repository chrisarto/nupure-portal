import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

/* ── Master Room Data (All 31 Physical Areas from MJH-SOP-NUPURE-001 v1.1) ── */
const ROOMS = [
  // Head Office (Mon-Fri)
  {
    code: 'NP-HO-01',
    zone: '1. Head Office (Mon–Fri)',
    room: 'Main Open-Plan Office (36 Workstations)',
    freq: 'MON–FRI',
    mins: 30,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Wipe clear and accessible desk/workstation surfaces',
      'Empty general-waste bins and replace liners',
      'Vacuum carpet and accessible areas beneath desks',
      'Sweep and mop hard flooring where applicable',
      'Spot-clean walls, remove accessible cobwebs/debris',
      'Dust partitions, window sills, and skirting boards',
    ],
    exclusion: 'DO NOT move paperwork, documents or personal belongings.',
  },
  {
    code: 'NP-HO-02',
    zone: '1. Head Office (Mon–Fri)',
    room: 'Individual Offices (6 Offices)',
    freq: 'MON–FRI',
    mins: 25,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Wipe clear and accessible desks/workstations',
      'Empty bins and replace liners',
      'Vacuum carpet, sweep and mop hard flooring',
      'Clean accessible areas beneath furniture',
      'Spot-clean walls, remove cobwebs',
      'Dust partitions, window sills, and skirting boards',
    ],
    exclusion: 'DO NOT move documents or personal belongings.',
  },
  {
    code: 'NP-HO-03',
    zone: '1. Head Office (Mon–Fri)',
    room: 'Boardroom',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Clean meeting-table surfaces and accessible edges',
      'Wipe chairs (seats, backs, arms, frames)',
      'Clean countertops and exposed bench surfaces',
      'Empty rubbish bins and replace liners',
      'Spot-clean walls, wipe window sills',
      'Dust partitions and skirting boards',
      'Vacuum carpet and areas beneath furniture',
    ],
  },
  {
    code: 'NP-HO-04',
    zone: '1. Head Office (Mon–Fri)',
    room: 'Small Meeting Rooms (1 & 2)',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Clean meeting tables and wipe chairs',
      'Clean countertops',
      'Empty bins and replace liners',
      'Spot-clean walls, wipe window sills',
      'Dust partitions and skirting boards',
      'Vacuum flooring and remove cobwebs',
    ],
  },
  {
    code: 'NP-HO-05',
    zone: '1. Head Office (Mon–Fri)',
    room: 'Head Office Amenities (M/F/Accessible)',
    freq: 'MON–FRI',
    mins: 25,
    sop: 'SOP-03 (YEL/RED)',
    tasks: [
      'Clean and disinfect toilets, seats, lids, flush controls (RED)',
      'Clean sinks, taps, mirrors, and splashbacks (YELLOW)',
      'Clean doors, handles, and partitions',
      'Empty bins and replenish consumables (paper/soap)',
      'Sweep and mop/disinfect floors, spot-clean walls',
    ],
  },
  {
    code: 'NP-HO-06',
    zone: '1. Head Office (Mon–Fri)',
    room: 'Head Office Lunchroom',
    freq: 'MON–FRI',
    mins: 20,
    sop: 'SOP-02 (GREEN)',
    tasks: [
      'Clean tables, chairs, and sanitise benchtops (GREEN)',
      'Clean sinks, taps, and splashbacks',
      'Clean microwave interiors, doors, handles, exteriors',
      'Wipe refrigerator exterior, door, handles (internal per schedule)',
      'Wipe external coffee-machine surfaces/drip trays & dishwasher exterior',
      'Clean agreed additional appliances; empty bins and replace liners',
      'Sweep, mop floors, clean edges and beneath furniture',
    ],
    exclusion: 'DO NOT remove or dispose of food without specific Nu-Pure instruction.',
  },
  {
    code: 'NP-HO-07',
    zone: '1. Head Office (Mon–Fri)',
    room: 'Hallways & Main Entry',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Maintain a clean, presentable entry and remove loose debris',
      'Vacuum carpet, sweep and mop hard flooring',
      'Clean accessible floor edges, corners, and spot-clean walls',
      'Empty bins and replace liners',
    ],
  },

  // Production Areas (7-Day & Mon-Fri)
  {
    code: 'NP-PR-01',
    zone: '2. Production Areas (7-Day & Mon–Fri)',
    room: 'Maintenance Offices (9 Workstations)',
    freq: '7 DAYS',
    mins: 20,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Wipe clear/accessible desks, avoid moving tools/papers',
      'Empty bins and replace liners',
      'Vacuum carpet, sweep and mop hard floors',
      'Clean beneath desks, spot-clean walls',
      'Dust window sills (where applicable)',
    ],
  },
  {
    code: 'NP-PR-02',
    zone: '2. Production Areas (7-Day & Mon–Fri)',
    room: 'Production Office 1 & 2 (10 Workstations)',
    freq: 'MON–FRI',
    mins: 20,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Wipe clear and accessible desks/workstations',
      'Empty bins, vacuum carpet, sweep/mop hard floors',
      'Clean beneath desks and spot-clean walls',
    ],
  },
  {
    code: 'NP-PR-03',
    zone: '2. Production Areas (7-Day & Mon–Fri)',
    room: "Plant Manager's Office & Meeting Rm",
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Wipe accessible desks, tables, and chairs',
      'Clean exposed bench surfaces',
      'Empty bins, vacuum floors, and spot-clean walls',
      'Dust window sills (where applicable)',
    ],
  },
  {
    code: 'NP-PR-04',
    zone: '2. Production Areas (7-Day & Mon–Fri)',
    room: 'Laboratory (Floor & General Waste ONLY)',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-04 (LAB KIT)',
    tasks: [
      'Empty designated general-waste bins ONLY',
      'Sweep and mop vinyl flooring, clean floor edges',
      'Dust window sills (where applicable and clear of samples)',
    ],
    exclusion: 'STRICT EXCLUSION: Do NOT touch benchtops, chemicals, samples, testing equipment, sharps, or clinical waste.',
  },
  {
    code: 'NP-PR-05',
    zone: '2. Production Areas (7-Day & Mon–Fri)',
    room: 'Production Lunchroom & Entry (+ Friday Fridge)',
    freq: '7 DAYS',
    mins: 35,
    sop: 'SOP-02 (GREEN)',
    tasks: [
      'Clean tables, chairs, sinks, and sanitise benchtops (GREEN)',
      'Clean microwaves inside and out',
      'Wipe refrigerator exterior (Internal clean every FRIDAY per Nu-Pure access)',
      'Wipe dishwasher, coffee machine, vending machine exteriors',
      'Sweep and mop flooring in entry and main area',
      'Empty bins, replace liners & replenish consumables in entry',
    ],
  },
  {
    code: 'NP-PR-06',
    zone: '2. Production Areas (7-Day & Mon–Fri)',
    room: 'Production Male Amenities (2 Urinals, 2 Cubicles, 1 Shower)',
    freq: '7 DAYS',
    mins: 30,
    sop: 'SOP-03 (YEL/RED)',
    tasks: [
      'Clean/disinfect toilets, urinals, seats, flush controls (RED)',
      'Clean shower base, walls, fittings — remove soap build-up (YELLOW)',
      'Clean sinks, taps, mirrors, splashbacks, doors, partitions (YELLOW)',
      'Empty bins, sweep, mop, disinfect floors',
      'Replenish toilet paper, soap, paper towels',
    ],
  },
  {
    code: 'NP-PR-07',
    zone: '2. Production Areas (7-Day & Mon–Fri)',
    room: 'Production Female Amenities (2 Cubicles, 1 Shower)',
    freq: '7 DAYS',
    mins: 25,
    sop: 'SOP-03 (YEL/RED)',
    tasks: [
      'Clean/disinfect toilets, seats, flush controls (RED)',
      'Clean shower base, walls, fittings (YELLOW)',
      'Clean sinks, taps, mirrors, splashbacks, doors, partitions (YELLOW)',
      'Empty bins, sweep, mop, disinfect floors',
      'Replenish toilet paper, soap, paper towels',
    ],
  },
  {
    code: 'NP-PR-08',
    zone: '2. Production Areas (7-Day & Mon–Fri)',
    room: 'First Aid Room (SOP v1.1 Sec 5.6)',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-01 (BLUE/YEL)',
    tasks: [
      'Confirm room vacant, safe to access and free of treatment activity',
      'Empty ONLY clearly identified general-waste bins',
      'Wipe accessible clear general surfaces, door handles & furniture exteriors',
      'Sweep and mop compatible accessible floors; leave emergency access clear',
    ],
    exclusion: 'DO NOT touch medical, sharps, clinical waste, cabinets, medicines, dressings or first-aid kits.',
  },

  // Warehouse Areas
  {
    code: 'NP-WH-01',
    zone: '3. Warehouse Areas (7-Day & Mon–Fri)',
    room: 'Open-Plan Warehouse Office (20 Workstations)',
    freq: 'MON–FRI',
    mins: 25,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Wipe clear and accessible desks/workstations',
      'Empty bins and replace liners',
      'Vacuum carpet, sweep and mop hard floors',
      'Clean beneath desks and spot-clean walls',
    ],
  },
  {
    code: 'NP-WH-02',
    zone: '3. Warehouse Areas (7-Day & Mon–Fri)',
    room: 'Warehouse Kitchen / Kitchenette',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-02 (GREEN)',
    tasks: [
      'Clean tables, chairs, benchtops, sinks, taps (GREEN)',
      'Clean microwave interiors and exteriors',
      'Wipe refrigerator exterior (internal clean per schedule)',
      'Wipe dishwasher/coffee-machine/vending exteriors',
      'Empty bins, sweep and mop floors',
    ],
  },
  {
    code: 'NP-WH-03',
    zone: '3. Warehouse Areas (7-Day & Mon–Fri)',
    room: "Sam's Office & CFO Office",
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Wipe clear and accessible desk/workstation surfaces',
      'Empty bins, vacuum carpet, sweep/mop hard floors',
      'Spot-clean walls, remove cobwebs',
      'Dust partitions, window sills, and skirting boards',
    ],
  },
  {
    code: 'NP-WH-04',
    zone: '3. Warehouse Areas (7-Day & Mon–Fri)',
    room: 'Photocopy Area',
    freq: 'MON–FRI',
    mins: 10,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Wipe external photocopier surfaces (internal excluded)',
      'Empty bins and paper-shredder collection bin',
      'Clean benchtops, vacuum carpet, sweep/mop floors',
    ],
    exclusion: 'DO NOT perform internal cleaning of photocopiers or specialist electronics.',
  },
  {
    code: 'NP-WH-05',
    zone: '3. Warehouse Areas (7-Day & Mon–Fri)',
    room: 'Warehouse Office Toilets (2 Unisex Cubicles)',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-03 (YEL/RED)',
    tasks: [
      'Clean and disinfect toilets, seats, lids, flush controls (RED)',
      'Clean doors, handles and partitions',
      'Clean sinks, taps and mirrors (YELLOW)',
      'Empty bins, replenish consumables',
      'Sweep and mop/disinfect floors, spot-clean walls',
    ],
  },
  {
    code: 'NP-WH-06',
    zone: '3. Warehouse Areas (7-Day & Mon–Fri)',
    room: 'Warehouse Accessible / Unisex Toilet',
    freq: '7 DAYS',
    mins: 15,
    sop: 'SOP-03 (YEL/RED)',
    tasks: [
      'Clean and disinfect toilet (RED)',
      'Clean accessible grab rails (YELLOW)',
      'Clean sink, taps, and mirror (YELLOW)',
      'Empty bin and replenish consumables',
      'Sweep and disinfect floor',
    ],
  },

  // Mezzanine Floor
  {
    code: 'NP-MZ-01',
    zone: '4. Mezzanine Floor (Mon–Fri)',
    room: 'Mezzanine Boardroom',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Clean meeting table and accessible edges',
      'Wipe chairs and exposed bench surfaces',
      'Empty bins and replace liners',
      'Spot-clean walls, wipe window sills',
      'Dust partitions and skirting boards',
      'Vacuum carpet, sweep/mop hard flooring',
    ],
  },
  {
    code: 'NP-MZ-02',
    zone: '4. Mezzanine Floor (Mon–Fri)',
    room: 'Mezzanine Kitchen',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-02 (GREEN)',
    tasks: [
      'Clean tables, chairs, sinks, taps, benchtops (GREEN)',
      'Clean microwaves and refrigerator exterior',
      'Wipe dishwasher and coffee-machine exterior',
      'Empty bins, sweep and mop floors',
    ],
  },
  {
    code: 'NP-MZ-03',
    zone: '4. Mezzanine Floor (Mon–Fri)',
    room: 'Hamilton Room & Holmes Room',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Clean meeting tables and clear desk surfaces',
      'Wipe chairs and clean counters where present',
      'Empty bins and replace liners',
      'Spot-clean walls and clean window sills',
      'Vacuum carpet, sweep and mop hard floors',
      'Clean beneath accessible furniture',
    ],
  },
  {
    code: 'NP-MZ-04',
    zone: '4. Mezzanine Floor (Mon–Fri)',
    room: 'Seating Area',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Remove loose rubbish, empty bins and replace liners',
      'Spot-clean walls, remove cobwebs',
      'Dust partitions, window sills, and skirting boards',
      'Vacuum carpet, sweep and mop hard flooring',
      'Vacuum lounge seats, backs and accessible crevices',
    ],
  },
  {
    code: 'NP-MZ-05',
    zone: '4. Mezzanine Floor (Mon–Fri)',
    room: 'Mezzanine Male Toilet (1 Cubicle)',
    freq: 'MON–FRI',
    mins: 10,
    sop: 'SOP-03 (YEL/RED)',
    tasks: [
      'Standard toilet cleaning and disinfection (RED/YELLOW)',
      'Floor cleaning (sweep/mop/disinfect)',
      'Bin servicing and consumable replenishment',
    ],
  },
  {
    code: 'NP-MZ-06',
    zone: '4. Mezzanine Floor (Mon–Fri)',
    room: 'Mezzanine Female Toilet (1 Cubicle)',
    freq: 'MON–FRI',
    mins: 10,
    sop: 'SOP-03 (YEL/RED)',
    tasks: [
      'Standard toilet cleaning and disinfection (RED/YELLOW)',
      'Floor cleaning (sweep/mop/disinfect)',
      'Bin servicing and consumable replenishment',
    ],
  },

  // Gatehouse & Drivers' Toilet
  {
    code: 'NP-GH-01',
    zone: "5. Gatehouse, Drivers' Toilet & Security (7-Day & Mon–Fri)",
    room: "Drivers' Toilet",
    freq: '7 DAYS',
    mins: 15,
    sop: 'SOP-03 (YEL/RED)',
    tasks: [
      'Clean/disinfect toilet, seat, lid, flush controls (RED)',
      'Clean cubicle door, handle, sink, taps, mirror (YELLOW)',
      'Empty rubbish and replace liner',
      'Replenish client-supplied consumables',
      'Sweep, mop and disinfect floor',
    ],
  },
  {
    code: 'NP-GH-02',
    zone: "5. Gatehouse, Drivers' Toilet & Security (7-Day & Mon–Fri)",
    room: 'Gatehouse Tea / Coffee Area',
    freq: 'MON–FRI',
    mins: 10,
    sop: 'SOP-02 (GREEN)',
    tasks: [
      'Clean benchtops, sinks, taps (GREEN)',
      'Wipe refrigerator exterior and tea/coffee equipment',
      'Empty rubbish and replace liners',
      'Sweep and mop floor',
    ],
  },
  {
    code: 'NP-GH-03',
    zone: "5. Gatehouse, Drivers' Toilet & Security (7-Day & Mon–Fri)",
    room: "Gatehouse Main Office & Manager's Office (7 Workstations)",
    freq: 'MON–FRI',
    mins: 20,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Wipe clear/accessible desks and furniture (avoid moving paperwork)',
      'Empty bins and replace liners',
      'Vacuum carpet, sweep/mop hard flooring',
      'Clean beneath desks and spot-clean walls',
    ],
    exclusion: 'DO NOT move paperwork, documents or personal belongings.',
  },
  {
    code: 'NP-GH-04',
    zone: "5. Gatehouse, Drivers' Toilet & Security (7-Day & Mon–Fri)",
    room: 'Security Building (SOP v1.1 Sec 5.6)',
    freq: 'MON–FRI',
    mins: 15,
    sop: 'SOP-01 (BLUE)',
    tasks: [
      'Empty designated general-waste bins and replace liners',
      'Wipe clear accessible desks, service counters, doors & high-touch points',
      'Dust accessible sills; vacuum/sweep/mop suitable flooring',
      'Record completed work and any restricted security workstations',
    ],
    exclusion: 'DO NOT disturb security records, keys, radios, CCTV or alarm controls.',
  },
];

const SANITARY_BINS = [
  ['SB-01', 'Head Office', 'Head Office Female Toilet — Cubicle 1 Sanitary Unit'],
  ['SB-02', 'Head Office', 'Head Office Female Toilet — Cubicle 2 Sanitary Unit'],
  ['SB-03', 'Head Office', 'Head Office Accessible / Disabled Toilet — Accessible Sanitary Unit'],
  ['SB-04', 'Production Areas', 'Production Female Amenities — Cubicle 1 Sanitary Unit'],
  ['SB-05', 'Production Areas', 'Production Female Amenities — Cubicle 2 Sanitary Unit'],
  ['SB-06', 'Warehouse Areas', 'Warehouse Office Toilets (Unisex) — Cubicle 1 Sanitary Unit'],
  ['SB-07', 'Warehouse Areas', 'Warehouse Office Toilets (Unisex) — Cubicle 2 Sanitary Unit'],
  ['SB-08', 'Warehouse Areas', 'Warehouse Accessible / Unisex Toilet — Accessible Sanitary Unit'],
  ['SB-09', 'Mezzanine Floor', 'Mezzanine Female Toilet (1 Cubicle) — Female Sanitary Unit'],
  ['SB-10', 'Gatehouse', "Gatehouse Drivers' Toilet — Drivers' Toilet Sanitary Unit"],
];

const AIR_FRESHENERS = [
  ['AF-01', 'Head Office', 'Dispenser #1 — Head Office Male Toilet'],
  ['AF-02', 'Head Office', 'Dispenser #2 — Head Office Female Toilet'],
  ['AF-03', 'Head Office', 'Dispenser #3 — Head Office Accessible / Disabled Toilet'],
  ['AF-04', 'Production Areas', 'Dispenser #4 — Production Male Amenities'],
  ['AF-05', 'Production Areas', 'Dispenser #5 — Production Female Amenities'],
  ['AF-06', 'Warehouse Areas', 'Dispenser #6 — Warehouse Office Unisex Toilets'],
  ['AF-07', 'Warehouse Areas', 'Dispenser #7 — Warehouse Accessible / Unisex Toilet'],
  ['AF-08', 'Mezzanine Floor', 'Dispenser #8 — Mezzanine Amenities (Male & Female Toilets)'],
  ['AF-09', 'Gatehouse', "Dispenser #9 — Gatehouse Drivers' Toilet"],
];

const STOCKTAKE_ITEMS = [
  ['NP-TP-48', '2-Ply Individually Wrapped Toilet Rolls (Carton of 48)', 'Carton', '8'],
  ['NP-JTR-08', 'Jumbo Toilet Tissue Rolls (Carton of 8)', 'Carton', '6'],
  ['NP-HT-16', 'Slimline Interleaved Hand Towels (Carton of 16 Packs)', 'Carton', '10'],
  ['NP-RHT-12', 'Roll Hand Towel — Production & Lunchrooms (Carton of 12)', 'Carton', '6'],
  ['NP-FT-24', 'Facial Tissues 2-Ply — Boardrooms & Executive Offices', 'Carton', '2'],
  ['NP-HS-06', 'Antibacterial Liquid Hand Soap 1000ml Pod Refills (Carton of 6)', 'Carton', '6'],
  ['NP-HS-5L', 'Bulk Liquid Hand Soap 5L Refill Drum', '5L Drum', '4'],
  ['NP-BW-5L', 'Production Shower Hair & Body Wash 5L', '5L Drum', '3'],
  ['NP-SAN-06', 'Alcohol Hand Sanitiser Gel 1000ml Refills', 'Carton', '4'],
  ['NP-BL-27', 'Small Office Desk Bin Liners 18L–27L (Roll of 50)', 'Roll', '10'],
  ['NP-BL-82', 'Heavy Duty Kitchen / Lunchroom Bin Liners 75L–82L (Carton of 250)', 'Carton', '4'],
  ['NP-BL-240', 'Wheelie Bin Liners 120L / 240L Heavy Duty (Carton of 100)', 'Carton', '3'],
  ['NP-SBL-100', 'Sanitary Hygiene Unit Modesty Liners (Pack of 100)', 'Pack', '4'],
  ['CHRC-41015A', 'Airlift Jelly Bean — General Purpose Disinfectant Deodoriser 5L', '5L Drum', '4'],
  ['BLAZ', 'Blue Lazer — Bathroom & Washroom Cleaner 5L (True Blue)', '5L Drum', '4'],
  ['USAL', 'Use All — Multi-Purpose Hard Surface & Floor Cleaner 5L (True Blue)', '5L Drum', '4'],
  ['V-SCN-DUAL-IC', 'V-Screen Dual Ice Cool — Urinal Screens (Vectair Systems)', 'Pack', '4'],
  ['NP-AF-300', 'Automatic Air Freshener 300ml Metered Aerosol Canisters (9 Units)', 'Canister', '12'],
];

function drawPageBanner(doc, title, subtitle) {
  doc.setFillColor(15, 52, 96);
  doc.rect(0, 0, 210, 24, 'F');
  doc.setFillColor(2, 132, 199);
  doc.rect(0, 24, 210, 2, 'F');

  doc.setTextColor(186, 230, 253);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('MJ HYGIENE MANAGEMENT SERVICES  |  NU-PURE BEVERAGES STAPYLTON (1/76 QUINNS HILL RD E)', 12, 7.8);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(title, 12, 15);

  doc.setTextColor(224, 242, 254);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(subtitle, 12, 20.8);

  doc.setFillColor(22, 163, 74);
  doc.roundedRect(156, 5.5, 42, 13, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('PAPER BACKUP FORM', 177, 10.8, { align: 'center' });
  doc.setFontSize(6.8);
  doc.text('MJH-FRM-NUPURE-MAN-001', 177, 15.5, { align: 'center' });
}

function addFootersToAllPages(doc) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.line(12, 286, 198, 286);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'MJH-FRM-NUPURE-MAN-001 (v1.1) — Printable Manual Paper Fallback Checklist  |  Back-enter into https://nupure.tmservices.cloud',
      12,
      291
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${i} of ${totalPages}`, 198, 291, { align: 'right' });
  }
}

function generateManualChecklistPdfBuffer() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  /* ═══════════════════════════════════════════════════════════════
     PAGE 1: SHIFT SIGN-ON, PRE-START & MASTER 31-AREA QUICK SUMMARY
     ═══════════════════════════════════════════════════════════════ */
  drawPageBanner(
    doc,
    'MANUAL DAILY CLEANING & HYGIENE CHECKLIST (TABLET BACKUP)',
    'Part A: Shift Sign-On, Pre-Start Safety Verification & Master 31-Area Quick Sign-Off Summary'
  );

  // Shift Sign-On Table
  autoTable(doc, {
    startY: 28,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.6, lineColor: [203, 213, 225], textColor: [15, 23, 42] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 52, 96], fontStyle: 'bold' },
    body: [
      [
        { content: 'Shift Date:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        '____ / ____ / 202___',
        { content: 'Shift Type:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        '[ ] Mon–Fri (7h)  [ ] Sat (5h)  [ ] Sun (5h)',
        { content: 'Start / Finish:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        '____:____ to ____:____',
      ],
      [
        { content: 'Cleaner Name(s):', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        '',
        { content: 'Cleaner Sign:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        '',
        { content: 'Supervisor Sign:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        '',
      ],
      [
        { content: 'Pre-Start Check:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        {
          colSpan: 5,
          content:
            '[ ] Signed in at Gatehouse   [ ] PPE & Safety Boots Worn   [ ] Equipment/Cords Safe   [ ] RED / YELLOW / GREEN / BLUE Cloths & Mops Segregated   [ ] Chemicals Labelled',
        },
      ],
    ],
  });

  // Master 31-Area Quick Sign-Off Table (Fitted cleanly onto Page 1)
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 2.5,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: { fontSize: 6.3, cellPadding: 1.05, lineColor: [203, 213, 225], textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5 },
    head: [
      [
        'Code',
        'Facility Zone & Room / Area Location',
        'Freq',
        'SOP / Colour',
        'Status (Tick)',
        'Chemicals Used',
        'Time',
        'Init',
        'Exception / Access Note',
      ],
    ],
    body: ROOMS.map(r => [
      { content: r.code, styles: { fontStyle: 'bold' } },
      r.room,
      r.freq,
      r.sop,
      '[ ] Done  [ ] Exc',
      '[ ]C1 [ ]C2 [ ]C3 [ ]C4',
      `${r.mins}m/___`,
      '',
      '',
    ]),
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 53 },
      2: { cellWidth: 14 },
      3: { cellWidth: 22 },
      4: { cellWidth: 20 },
      5: { cellWidth: 25 },
      6: { cellWidth: 12 },
      7: { cellWidth: 9 },
      8: { cellWidth: 17 },
    },
  });

  /* ═══════════════════════════════════════════════════════════════
     PAGES 2–4: DETAILED ROOM-BY-ROOM TASK CHECKLISTS (BY ZONE)
     ═══════════════════════════════════════════════════════════════ */
  doc.addPage();
  drawPageBanner(
    doc,
    'DETAILED ROOM-BY-ROOM TASK CHECKLISTS (TICK AS COMPLETED)',
    'Part B: Tick only tasks actually performed. Never sign off incomplete work — record any access restriction.'
  );

  let currentY = 29;
  const zones = [...new Set(ROOMS.map(r => r.zone))];

  for (const zoneName of zones) {
    const zoneRooms = ROOMS.filter(r => r.zone === zoneName);
    const tableBody = [];

    for (const r of zoneRooms) {
      const checklistLines = r.tasks.map(t => `[   ]  ${t}`).join('\n');
      const exclusionLine = r.exclusion ? `\n[ ! ]  ${r.exclusion}` : '';
      tableBody.push([
        {
          content: `${r.code}\n${r.freq}\n(${r.mins} mins)\n${r.sop}`,
          styles: { fontStyle: 'bold', fillColor: [248, 250, 252] },
        },
        {
          content: `${r.room}\n${checklistLines}${exclusionLine}`,
        },
        {
          content:
            '[  ] C-01 Disinfect\n[  ] C-02 Food-Safe\n[  ] C-03 Descaler\n[  ] C-04 Floor pH\n[  ] C-05 Glass\n[  ] C-06 Odour',
        },
        {
          content:
            '[  ] Visual Pass\n[  ] Colour/SSOP OK\n[  ] Bin Liner Done\n\nTime: ______m\n\nInit: ________',
        },
        {
          content: '',
        },
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      margin: { top: 29, left: 12, right: 12, bottom: 14 },
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 2,
        lineColor: [203, 213, 225],
        textColor: [15, 23, 42],
        valign: 'top',
      },
      headStyles: {
        fillColor: [15, 52, 96],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      head: [
        [
          { content: `${zoneName} — Code / SOP`, styles: { cellWidth: 25 } },
          { content: 'Room Name & Itemised Scope Checklist (Tick Each Completed Task)', styles: { cellWidth: 92 } },
          { content: 'Chemicals Used', styles: { cellWidth: 26 } },
          { content: 'QA & Sign-Off', styles: { cellWidth: 25 } },
          { content: 'Exceptions / Notes', styles: { cellWidth: 18 } },
        ],
      ],
      body: tableBody,
      didDrawPage: () => {
        drawPageBanner(
          doc,
          'DETAILED ROOM-BY-ROOM TASK CHECKLISTS (TICK AS COMPLETED)',
          'Part B: Tick only tasks actually performed. Never sign off incomplete work — record any access restriction.'
        );
      },
    });

    currentY = doc.lastAutoTable.finalY + 5;
    if (currentY > 245) {
      doc.addPage();
      drawPageBanner(
        doc,
        'DETAILED ROOM-BY-ROOM TASK CHECKLISTS (CONTINUED)',
        'Part B: Tick only tasks actually performed. Record any blocked access or exception.'
      );
      currentY = 29;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     NEXT PAGE: SANITARY BINS (SB-01..10), AIR FRESHENERS (AF-01..09) & STOCKTAKE
     ═══════════════════════════════════════════════════════════════ */
  doc.addPage();
  drawPageBanner(
    doc,
    'MANAGED HYGIENE UNITS & WEEKLY STOCKTAKE LOG SHEET',
    'Part C: Sanitary Waste Bins (SB-01 to SB-10), Air Fresheners (AF-01 to AF-09) & 18-Line Stocktake'
  );

  // 1. Sanitary Bins Table
  autoTable(doc, {
    startY: 29,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 1.6, lineColor: [203, 213, 225], textColor: [15, 23, 42] },
    headStyles: { fillColor: [190, 18, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    head: [
      [
        'Unit ID',
        'Zone',
        'Allocated Sanitary Bin Location (SOP-05 — RED Containment)',
        'Service Actions Completed (Tick)',
        'Defect / Notes',
        'Init',
      ],
    ],
    body: SANITARY_BINS.map(b => [
      { content: b[0], styles: { fontStyle: 'bold' } },
      b[1],
      b[2],
      '[  ] Liner Changed   [  ] Disinfected   [  ] Waste Collected',
      '',
      '',
    ]),
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 26 },
      2: { cellWidth: 62 },
      3: { cellWidth: 54 },
      4: { cellWidth: 19 },
      5: { cellWidth: 11 },
    },
  });

  // 2. Air Fresheners Table
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 4,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 1.6, lineColor: [203, 213, 225], textColor: [15, 23, 42] },
    headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    head: [
      [
        'Unit ID',
        'Zone',
        'Allocated Dispenser Location (SOP-06)',
        'Service Actions Completed (Tick)',
        'Defect / Notes',
        'Init',
      ],
    ],
    body: AIR_FRESHENERS.map(a => [
      { content: a[0], styles: { fontStyle: 'bold' } },
      a[1],
      a[2],
      '[  ] Operates OK   [  ] Casing Cleaned   [  ] Refill   [  ] AA Batt',
      '',
      '',
    ]),
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 26 },
      2: { cellWidth: 62 },
      3: { cellWidth: 54 },
      4: { cellWidth: 19 },
      5: { cellWidth: 11 },
    },
  });

  // 3. Weekly Consumables Stocktake (18 Lines)
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 4,
    margin: { top: 29, left: 12, right: 12 },
    theme: 'grid',
    styles: { fontSize: 6.7, cellPadding: 1.15, lineColor: [203, 213, 225], textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    head: [
      [
        'SKU Code',
        'Consumable Item Description (SOP-07 — 18-Line Master)',
        'Unit',
        'Par Level',
        'On-Hand Count',
        'Order Qty Needed',
        'Stock Notes / Location',
      ],
    ],
    body: STOCKTAKE_ITEMS.map(s => [
      { content: s[0], styles: { fontStyle: 'bold' } },
      s[1],
      s[2],
      { content: s[3], styles: { halign: 'center', fontStyle: 'bold' } },
      '',
      '',
      '',
    ]),
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 78 },
      2: { cellWidth: 18 },
      3: { cellWidth: 15 },
      4: { cellWidth: 19 },
      5: { cellWidth: 19 },
      6: { cellWidth: 17 },
    },
    didDrawPage: () => {
      drawPageBanner(
        doc,
        'MANAGED HYGIENE UNITS & WEEKLY STOCKTAKE LOG SHEET',
        'Part C: Sanitary Waste Bins (SB-01 to SB-10), Air Fresheners (AF-01 to AF-09) & 18-Line Stocktake'
      );
    },
  });

  /* ═══════════════════════════════════════════════════════════════
     FINAL PAGE: SITE ISSUE / EXCEPTION LOG & SUPERVISOR CLOSE-OUT
     ═══════════════════════════════════════════════════════════════ */
  doc.addPage();
  drawPageBanner(
    doc,
    'SITE ISSUE / EXCEPTION RECORD & SUPERVISOR SHIFT CLOSE-OUT',
    'Part D: Appendix B Exception Log, Supervisor Daily Verification & Portal Back-Entry Sign-Off'
  );

  // Exception / Issue Log Table
  autoTable(doc, {
    startY: 29,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3.5, lineColor: [203, 213, 225], textColor: [15, 23, 42] },
    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    head: [
      [
        'Time',
        'Room / Unit Code',
        'Issue, Restricted Access, Spill, Hazard or Client Request Details',
        'Immediate Action Taken & Client Notified (Yes/No)',
        'Reported By',
      ],
    ],
    body: [
      ['', '', '\n\n', '', ''],
      ['', '', '\n\n', '', ''],
      ['', '', '\n\n', '', ''],
      ['', '', '\n\n', '', ''],
    ],
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 24 },
      2: { cellWidth: 72 },
      3: { cellWidth: 50 },
      4: { cellWidth: 22 },
    },
  });

  // Supervisor Daily Close-Out Acceptance Checklist
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: { fontSize: 8.2, cellPadding: 2.5, lineColor: [203, 213, 225], textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    head: [['Supervisor Daily Close-Out Verification Checklist (SOP v1.1 Section 10.2)', 'Verified (Tick)']],
    body: [
      ['1. All due area codes reconciled against daily shift scope (Mon–Fri full scope / Sat–Sun 6 operational 7-day areas)', '[   ]  Verified'],
      ['2. Any incomplete or restricted rooms explicitly recorded above with reason & communicated to Nu-Pure', '[   ]  Verified'],
      ['3. Critical amenities, lunchrooms/food areas, and Laboratory floor-only boundaries inspected', '[   ]  Verified'],
      ['4. Consumables replenished across all amenities; any low stock or urgent shortages escalated', '[   ]  Verified'],
      ['5. Colour-coded cloths/mops rinsed, segregated (RED / YELLOW / GREEN / BLUE) & chemical store secured', '[   ]  Verified'],
      ['6. All general waste & sanitary waste bags secured in designated collection streams; site sign-out completed', '[   ]  Verified'],
    ],
    columnStyles: {
      0: { cellWidth: 154 },
      1: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
    },
  });

  // Portal Back-Entry & Sign-Off Block
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3.5, lineColor: [203, 213, 225], textColor: [15, 23, 42] },
    headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    head: [
      [
        {
          colSpan: 4,
          content:
            'MANDATORY PORTAL BACK-ENTRY & AUTHORISATION SIGN-OFF (Once Tablet / Internet Access Is Restored)',
        },
      ],
    ],
    body: [
      [
        { content: 'Cleaner Name:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        '',
        { content: 'Cleaner Signature & Date:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        '',
      ],
      [
        { content: 'Supervisor Name:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        '',
        { content: 'Supervisor Signature & Date:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        '',
      ],
      [
        { content: 'Back-Entered Into Portal By:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        '',
        { content: 'Date / Time Entered in Portal:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        '____ / ____ / 202___ at ____:____',
      ],
    ],
  });

  addFootersToAllPages(doc);
  return Buffer.from(doc.output('arraybuffer'));
}

async function main() {
  console.log('1. Generating Printable Manual Cleaning & Hygiene Checklist Pack PDF (MJH-FRM-NUPURE-MAN-001)...');
  const pdfBuffer = generateManualChecklistPdfBuffer();

  const localPublicPath = path.resolve('public/docs/NuPure_Manual_Checklist_Pack.pdf');
  const zDrivePath = 'Z:\\NU Pure Beverages\\MJ Hygiene — Nu-Pure Printable Manual Cleaning & Hygiene Checklist Pack.pdf';

  fs.mkdirSync(path.dirname(localPublicPath), { recursive: true });
  fs.writeFileSync(localPublicPath, pdfBuffer);
  console.log(`   ✓ Saved to ${localPublicPath} (${pdfBuffer.length} bytes)`);

  try {
    fs.writeFileSync(zDrivePath, pdfBuffer);
    console.log(`   ✓ Saved to ${zDrivePath} (${pdfBuffer.length} bytes)`);
  } catch (err) {
    console.warn('   ! Could not write to Z: drive:', err.message);
  }

  console.log('\n2. Uploading NuPure_Manual_Checklist_Pack.pdf to Supabase Storage...');
  const pubPath = 'NuPure_Manual_Checklist_Pack.pdf';
  const pubRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${pubPath}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: pdfBuffer,
  });
  if (!pubRes.ok) throw new Error(`Public storage upload failed: ${await pubRes.text()}`);
  const publicPdfUrl = `${SUPABASE_URL}/storage/v1/object/public/documents/${pubPath}`;
  console.log(`   ✓ Public PDF URL: ${publicPdfUrl}`);

  const storagePath = 'training-documents/MJH-FRM-NUPURE-MAN-001/NuPure_Manual_Checklist_Pack.pdf';
  const privRes = await fetch(`${SUPABASE_URL}/storage/v1/object/nupure-attachments/${storagePath}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: pdfBuffer,
  });
  if (!privRes.ok) throw new Error(`Private storage upload failed: ${await privRes.text()}`);
  console.log(`   ✓ Private attachment path: supabase-storage://${storagePath}`);

  console.log('\n3. Upserting MJH-FRM-NUPURE-MAN-001 in Airtable (tblwtH46TSh45tpnD) & Supabase...');
  const formula = '{Document Code}="MJH-FRM-NUPURE-MAN-001"';
  const params = new URLSearchParams({ filterByFormula: formula });
  const checkRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}?${params}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  const checkJson = await checkRes.json();
  const existing = (checkJson.records || [])[0];

  const docFields = {
    'Document Code': 'MJH-FRM-NUPURE-MAN-001',
    'Long Name': 'Printable Manual Daily Cleaning & Hygiene Checklist Pack (Paper Fallback for Tablet Outage)',
    'Document Type': 'Work Method Statement',
    'Status': 'Control Document',
    'Version Number': 1.1,
    'Date Created': '2026-11-16',
    'Reviewed Date': '2026-11-16',
    'Review Period (years)': 1,
    'Re-Training Frequency': 1,
    'Requires Practical': false,
    'Site Assigned': [NU_PURE_SITE_ID],
    'Room/Area': [
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
      'Hygiene Services & Consumables',
    ],
    'Document Link': [
      {
        url: publicPdfUrl,
        filename: 'MJH-FRM-NUPURE-MAN-001 - NuPure_Manual_Checklist_Pack.pdf',
      },
    ],
  };

  let airtableRecord;
  if (existing) {
    const patchRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}/${existing.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: docFields, typecast: true }),
    });
    airtableRecord = await patchRes.json();
    console.log(`   ✓ Updated Airtable record [${airtableRecord.id}]: MJH-FRM-NUPURE-MAN-001`);
  } else {
    const postRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: docFields, typecast: true }),
    });
    airtableRecord = await postRes.json();
    console.log(`   ✓ Created Airtable record [${airtableRecord.id}]: MJH-FRM-NUPURE-MAN-001`);
  }

  // Upsert into Supabase nupure_training_documents
  const attObj = {
    id: `att_${airtableRecord.id}`,
    url: `supabase-storage://${storagePath}`,
    storagePath,
    filename: 'MJH-FRM-NUPURE-MAN-001 - NuPure_Manual_Checklist_Pack.pdf',
    size: pdfBuffer.length,
    type: 'application/pdf',
  };
  const sbRow = {
    airtable_id: airtableRecord.id,
    data: {
      ...airtableRecord.fields,
      'Document Link': [attObj],
      'Document Upload': [attObj],
    },
    synced_at: new Date().toISOString(),
  };

  const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_training_documents`, {
    method: 'POST',
    headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([sbRow]),
  });
  if (!sbRes.ok) throw new Error(`Supabase upsert failed: ${await sbRes.text()}`);
  console.log('   ✓ Synced MJH-FRM-NUPURE-MAN-001 into Supabase nupure_training_documents');
  console.log('\n✅ Printable Manual Checklist Pack PDF generated, saved, and synced!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
