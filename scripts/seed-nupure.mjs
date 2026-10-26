import './env.mjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_TRAINING = process.env.AIRTABLE_BASE_TRAINING || 'appPTtErtzoAx7NAb';

const HEADERS = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

const NUPURE_ROOMS = [
  // 1. Head Office
  {
    id: 'ho-main-open-plan',
    code: 'NP-HO-01',
    zone: 'Head Office',
    room: 'Main Open-Plan Office',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 30,
    workstationNote: 'Approx. 36 workstations',
    checklist: [
      'Empty all general waste and recycling bins and replace liners as required',
      'Wipe and sanitise cleared desk surfaces, shared tables, and counters',
      'Sanitise high-touch points (door handles, light switches, partition edges)',
      'Vacuum all carpeted floor areas thoroughly including walkways and under desks',
      'Spot-clean internal glass partitions and entry doors',
    ],
  },
  {
    id: 'ho-individual-offices',
    code: 'NP-HO-02',
    zone: 'Head Office',
    room: 'Individual Offices (6)',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 25,
    workstationNote: '6 Executive / Individual Offices (2–4 workstations each)',
    checklist: [
      'Empty all office waste and recycling bins and replace liners',
      'Wipe and sanitise cleared desk surfaces, meeting tables, and credenzas',
      'Sanitise door handles, light switches, and high-touch surfaces',
      'Vacuum all carpeted floors across all 6 offices',
      'Spot-clean internal office glass panels and door glass',
    ],
  },
  {
    id: 'ho-boardroom',
    code: 'NP-HO-03',
    zone: 'Head Office',
    room: 'Boardroom',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    checklist: [
      'Wipe and sanitise full boardroom table, AV credenza, and side surfaces',
      'Empty waste/recycling bins and replace liners',
      'Align and tidy boardroom chairs and check presentation readiness',
      'Vacuum boardroom carpet floor-to-edge',
      'Clean internal glass walls and boardroom entry doors streak-free',
    ],
  },
  {
    id: 'ho-small-meeting-rooms',
    code: 'NP-HO-04',
    zone: 'Head Office',
    room: 'Small Meeting Rooms (2)',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    workstationNote: 'Small Meeting Rooms 1 & 2',
    checklist: [
      'Wipe and sanitise meeting tables and chairs in both meeting rooms',
      'Empty waste bins and replace liners',
      'Sanitise door handles and light switches',
      'Vacuum carpeted flooring in both rooms',
      'Spot-clean glass doors and partition glass',
    ],
  },
  {
    id: 'ho-amenities',
    code: 'NP-HO-05',
    zone: 'Head Office',
    room: 'Head Office Amenities',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 25,
    workstationNote: 'Male, Female & Accessible / Disabled Toilets',
    checklist: [
      'Clean, descale, and sanitise all toilet bowls, seats, hinges, and urinals',
      'Clean and sanitise vanity basins, tapware, countertops, and splashbacks',
      'Clean and polish all mirrors streak-free',
      'Wipe and sanitise cubicle doors, locks, flush buttons, and hand dryers/dispensers',
      'Empty washroom bins, replace liners, and restock toilet paper, hand towel, and soap',
      'Sweep and mop tiled floors with hospital-grade disinfectant',
    ],
  },
  {
    id: 'ho-lunchroom',
    code: 'NP-HO-06',
    zone: 'Head Office',
    room: 'Head Office Lunchroom',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 20,
    checklist: [
      'Wipe and food-safe sanitise all lunchroom tables, chairs, and kitchen benchtops',
      'Clean and sanitise sinks, tapware, and splashbacks',
      'Wipe external surfaces of fridge, microwave (plus internal microwave), zip tap, and cabinetry',
      'Empty general waste and recycling bins, sanitise bin lids, and replace liners',
      'Sweep and mop hard flooring with disinfectant cleaner',
    ],
  },
  {
    id: 'ho-hallways-entry',
    code: 'NP-HO-07',
    zone: 'Head Office',
    room: 'Hallways & Main Entry',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    checklist: [
      'Clean main reception/entry glass doors inside and out streak-free',
      'Dust and sanitise reception counter, skirting boards, and entry touchpoints',
      'Vacuum entry mats and carpeted hallways; mop hard floor sections',
    ],
  },
  // 2. Production Areas
  {
    id: 'prod-maintenance-offices',
    code: 'NP-PR-01',
    zone: 'Production Areas',
    room: 'Maintenance Offices',
    frequencyBadge: '7 DAYS',
    frequencyLabel: 'Daily (7 Days / Week)',
    frequencyInDays: 1,
    workstreamCode: 'WS-DAILY-7D',
    estimatedMinutes: 20,
    workstationNote: 'Approx. 9 workstations — 7-Day Coverage',
    checklist: [
      'Empty all waste and recycling bins and replace liners',
      'Wipe and sanitise cleared desk surfaces, benches, and shared tables',
      'Sanitise door handles, light switches, and high-touch points',
      'Sweep and mop hard floors (or vacuum carpeted sections) thoroughly',
    ],
  },
  {
    id: 'prod-office-1-2',
    code: 'NP-PR-02',
    zone: 'Production Areas',
    room: 'Production Office 1 & 2',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 20,
    workstationNote: 'Approx. 10 workstations across Production Offices 1 & 2',
    checklist: [
      'Empty all waste and recycling bins and replace liners',
      'Wipe and sanitise cleared desk surfaces and shared worktops',
      'Sanitise door handles, switches, and internal window sills',
      'Sweep and mop / vacuum all floor surfaces across both offices',
    ],
  },
  {
    id: 'prod-plant-manager-office',
    code: 'NP-PR-03',
    zone: 'Production Areas',
    room: "Plant Manager's Office & Meeting Rm",
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    checklist: [
      'Wipe and sanitise desk, meeting table, and chairs',
      'Empty waste bins and replace liners',
      'Sanitise door handles and high-touch surfaces',
      'Vacuum / mop floor surfaces and spot-clean glass panels',
    ],
  },
  {
    id: 'prod-laboratory',
    code: 'NP-PR-04',
    zone: 'Production Areas',
    room: 'Laboratory',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    checklist: [
      'Empty general waste bins only (do NOT touch clinical/sharps or chemical containers)',
      'Sanitise entry door handles and light switches',
      'Sweep and mop laboratory floor with approved neutral floor cleaner',
    ],
    limitations: 'STRICT EXCLUSION: Excludes laboratory benchtops, lab chemicals, samples, testing equipment, sharps, and clinical waste.',
  },
  {
    id: 'prod-lunchroom-entry',
    code: 'NP-PR-05',
    zone: 'Production Areas',
    room: 'Production Lunchroom & Entry',
    frequencyBadge: '7 DAYS',
    frequencyLabel: 'Daily (7 Days / Week) + Friday Internal Fridge Clean',
    frequencyInDays: 1,
    workstreamCode: 'WS-DAILY-7D',
    estimatedMinutes: 35,
    checklist: [
      'Wipe and food-safe sanitise all lunchroom tables, chairs, and kitchen benchtops',
      'Clean and sanitise sinks, tapware, splashbacks, and microwave (inside & out)',
      'Wipe external surfaces of refrigerators, vending/coffee machines, and cupboards',
      'FRIDAY TASK: Complete full internal refrigerator clean and sanitisation (every Friday)',
      'Empty all general waste and recycling bins, wash/sanitise bin lids, and reline',
      'Sweep and mop lunchroom and entry foyer floors with hospital-grade disinfectant',
    ],
  },
  {
    id: 'prod-male-amenities',
    code: 'NP-PR-06',
    zone: 'Production Areas',
    room: 'Production Male Amenities',
    frequencyBadge: '7 DAYS',
    frequencyLabel: 'Daily (7 Days / Week)',
    frequencyInDays: 1,
    workstreamCode: 'WS-DAILY-7D',
    estimatedMinutes: 30,
    workstationNote: '2 urinals, 2 cubicles, 1 shower, 2 sinks + locker area',
    checklist: [
      'Clean, descale, and sanitise 2 urinals and 2 toilet cubicles (bowls, seats, hinges, flush buttons)',
      'Clean, descale, and sanitise shower recess, walls, glass/curtain, and floor drain',
      'Clean and sanitise 2 hand basins, tapware, mirrors, and splashbacks',
      'Wipe and sanitise benches, external locker fronts, and door handles',
      'Empty bins, replace liners, and restock toilet tissue, hand towel, and soap dispensers',
      'Scrub and mop all wet-area floors with hospital-grade bathroom disinfectant',
    ],
  },
  {
    id: 'prod-female-amenities',
    code: 'NP-PR-07',
    zone: 'Production Areas',
    room: 'Production Female Amenities',
    frequencyBadge: '7 DAYS',
    frequencyLabel: 'Daily (7 Days / Week)',
    frequencyInDays: 1,
    workstreamCode: 'WS-DAILY-7D',
    estimatedMinutes: 25,
    workstationNote: '2 cubicles, 1 shower, 2 sinks + locker area',
    checklist: [
      'Clean, descale, and sanitise 2 toilet cubicles (bowls, seats, hinges, doors, and locks)',
      'Clean, descale, and sanitise shower recess, tapware, walls, and drain',
      'Clean and sanitise 2 hand basins, tapware, mirrors, and vanity tops',
      'Wipe and sanitise benches, external locker surfaces, and touchpoints',
      'Empty general waste bins, replace liners, and replenish paper and soap consumables',
      'Scrub and mop floors with hospital-grade bathroom disinfectant',
    ],
  },
  // 3. Warehouse Areas
  {
    id: 'wh-open-plan-office',
    code: 'NP-WH-01',
    zone: 'Warehouse Areas',
    room: 'Open-Plan Warehouse Office',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 25,
    workstationNote: 'Approx. 20 workstations',
    checklist: [
      'Empty all desk and communal bins and replace liners',
      'Wipe and sanitise cleared workstation surfaces, counters, and shared desks',
      'Sanitise door handles, switches, and dispatch window ledges',
      'Vacuum and/or sweep and mop all office floor areas',
    ],
  },
  {
    id: 'wh-kitchen',
    code: 'NP-WH-02',
    zone: 'Warehouse Areas',
    room: 'Warehouse Kitchen / Kitchenette',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    checklist: [
      'Clean and food-safe sanitise kitchen benchtops, tables, and chairs',
      'Clean and sanitise sink, tapware, microwave, and fridge exterior',
      'Empty kitchen bins and replace liners',
      'Sweep and mop kitchen floor with disinfectant',
    ],
  },
  {
    id: 'wh-sams-cfo-office',
    code: 'NP-WH-03',
    zone: 'Warehouse Areas',
    room: "Sam's Office & CFO Office",
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    checklist: [
      'Empty waste bins and replace liners in both executive offices',
      'Wipe and sanitise cleared desk surfaces, meeting tables, and credenzas',
      'Sanitise door handles and light switches',
      'Vacuum carpeted floors and spot-clean internal glass',
    ],
  },
  {
    id: 'wh-photocopy-area',
    code: 'NP-WH-04',
    zone: 'Warehouse Areas',
    room: 'Photocopy Area',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 10,
    checklist: [
      'Empty paper recycling and waste bins and replace liners',
      'Wipe and sanitise utility benches, cabinetry, and touchpoints',
      'Vacuum / mop floor area around printing equipment',
    ],
  },
  {
    id: 'wh-office-toilets',
    code: 'NP-WH-05',
    zone: 'Warehouse Areas',
    room: 'Warehouse Office Toilets',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    workstationNote: '2 Unisex Cubicles',
    checklist: [
      'Clean, descale, and sanitise both unisex toilet bowls, seats, and cisterns',
      'Clean and sanitise hand basins, tapware, and mirrors',
      'Restock toilet paper, hand towels, and liquid soap',
      'Empty washroom bins and mop tiled floors with hospital-grade disinfectant',
    ],
  },
  {
    id: 'wh-accessible-unisex-toilet',
    code: 'NP-WH-06',
    zone: 'Warehouse Areas',
    room: 'Warehouse Accessible / Unisex Toilet',
    frequencyBadge: '7 DAYS',
    frequencyLabel: 'Daily (7 Days / Week)',
    frequencyInDays: 1,
    workstreamCode: 'WS-DAILY-7D',
    estimatedMinutes: 15,
    checklist: [
      'Clean, descale, and sanitise toilet pan, seat, grab rails, and flush controls',
      'Clean and sanitise basin, tapware, mirror, and soap/paper dispensers',
      'Empty waste bin, replace liner, and replenish toilet tissue, hand towel, and soap',
      'Sweep and mop floor with hospital-grade disinfectant',
    ],
  },
  // 4. Mezzanine Floor
  {
    id: 'mez-boardroom',
    code: 'NP-MZ-01',
    zone: 'Mezzanine Floor',
    room: 'Mezzanine Boardroom',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    checklist: [
      'Wipe and sanitise boardroom table, credenza, and chairs',
      'Empty waste bins and replace liners',
      'Vacuum boardroom carpet and spot-clean glass partitions',
    ],
  },
  {
    id: 'mez-kitchen',
    code: 'NP-MZ-02',
    zone: 'Mezzanine Floor',
    room: 'Mezzanine Kitchen',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    checklist: [
      'Wipe and food-safe sanitise benches, sink, tapware, and splashback',
      'Wipe appliance exteriors (fridge, microwave, zip tap) and cabinet fronts',
      'Empty kitchen bins, replace liners, and mop floor with disinfectant',
    ],
  },
  {
    id: 'mez-hamilton-holmes',
    code: 'NP-MZ-03',
    zone: 'Mezzanine Floor',
    room: 'Hamilton Room & Holmes Room',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    checklist: [
      'Wipe and sanitise tables, desks, and chairs in both Hamilton & Holmes rooms',
      'Empty bins and replace liners',
      'Vacuum floors and spot-clean internal door glass',
    ],
  },
  {
    id: 'mez-seating-area',
    code: 'NP-MZ-04',
    zone: 'Mezzanine Floor',
    room: 'Seating Area',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 15,
    checklist: [
      'Wipe and sanitise breakout tables, chairs, and balustrades/ledges',
      'Empty bins and vacuum/mop all flooring across the mezzanine seating area',
    ],
  },
  {
    id: 'mez-male-toilet',
    code: 'NP-MZ-05',
    zone: 'Mezzanine Floor',
    room: 'Mezzanine Male Toilet (1 Cubicle)',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 10,
    checklist: [
      'Clean, descale, and sanitise toilet pan, seat, basin, tapware, and mirror',
      'Restock toilet paper, hand towels, and hand soap',
      'Empty bin and mop floor with hospital-grade disinfectant',
    ],
  },
  {
    id: 'mez-female-toilet',
    code: 'NP-MZ-06',
    zone: 'Mezzanine Floor',
    room: 'Mezzanine Female Toilet (1 Cubicle)',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 10,
    checklist: [
      'Clean, descale, and sanitise toilet pan, seat, basin, tapware, and mirror',
      'Restock toilet paper, hand towels, and hand soap',
      'Empty bin and mop floor with hospital-grade disinfectant',
    ],
  },
  // 5. Gatehouse & Drivers' Toilet
  {
    id: 'gh-drivers-toilet',
    code: 'NP-GH-01',
    zone: "Gatehouse & Drivers' Toilet",
    room: "Drivers' Toilet",
    frequencyBadge: '7 DAYS',
    frequencyLabel: 'Daily (7 Days / Week)',
    frequencyInDays: 1,
    workstreamCode: 'WS-DAILY-7D',
    estimatedMinutes: 15,
    checklist: [
      'Clean, descale, and sanitise toilet bowl, seat, cistern, and door locks',
      'Clean and sanitise hand basin, tapware, and mirror',
      'Restock toilet paper, hand towels, and soap dispensers',
      'Empty waste bin, replace liner, and scrub/mop floor with disinfectant',
    ],
  },
  {
    id: 'gh-tea-coffee-area',
    code: 'NP-GH-02',
    zone: "Gatehouse & Drivers' Toilet",
    room: 'Gatehouse Tea / Coffee Area',
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 10,
    checklist: [
      'Wipe and food-safe sanitise tea/coffee benchtop, sink, and appliance exteriors',
      'Empty waste bin, reline, and mop floor area',
    ],
  },
  {
    id: 'gh-main-manager-office',
    code: 'NP-GH-03',
    zone: "Gatehouse & Drivers' Toilet",
    room: "Gatehouse Main Office & Manager's Office",
    frequencyBadge: '5 DAYS',
    frequencyLabel: 'Weekday (5 Days Mon–Fri)',
    frequencyInDays: 1,
    workstreamCode: 'WS-WEEKDAY-5D',
    estimatedMinutes: 20,
    checklist: [
      'Empty all waste and recycling bins and replace liners',
      'Wipe and sanitise cleared desks, driver sign-in counters, and window ledges',
      'Sanitise door handles, light switches, and high-touch surfaces',
      'Sweep and mop / vacuum all gatehouse office floors and clean sliding glass windows',
    ],
  },
  // 6. Hygiene Services
  {
    id: 'hyg-sanitary-waste',
    code: 'NP-HY-01',
    zone: 'Hygiene Services & Weekly Tasks',
    room: 'Sanitary Waste Management (8–10 Bins)',
    frequencyBadge: 'WEEKLY',
    frequencyLabel: 'Weekly Service',
    frequencyInDays: 7,
    workstreamCode: 'WS-WEEKLY-HYG',
    estimatedMinutes: 30,
    checklist: [
      'Service and exchange/reline sanitary disposal units in Head Office Female & Accessible toilets',
      'Service and exchange/reline sanitary disposal units in Production Female Amenities',
      'Service and exchange/reline sanitary disposal units in Warehouse Office & Accessible toilets',
      'Service and exchange/reline sanitary disposal units in Mezzanine Female & Drivers toilets',
      'Sanitise outer surfaces of all sanitary units with hospital-grade disinfectant',
    ],
  },
  {
    id: 'hyg-air-fresheners',
    code: 'NP-HY-02',
    zone: 'Hygiene Services & Weekly Tasks',
    room: 'Automatic Air Freshener Units (9 Dispensers)',
    frequencyBadge: 'WEEKLY',
    frequencyLabel: 'Weekly Inspection / 4-Weekly Refill',
    frequencyInDays: 7,
    workstreamCode: 'WS-WEEKLY-HYG',
    estimatedMinutes: 20,
    checklist: [
      'Inspect all 9 automatic air freshener dispensers across Head Office, Production, Warehouse, Mezzanine, and Gatehouse amenities',
      'Verify battery status and spray interval operation',
      'Replace fragrance refill canisters and AA batteries as required (scheduled 4-weekly)',
    ],
  },
];

async function createAdminUsers() {
  console.log('1. Creating Admin Users in Nu-Pure Supabase Auth...');
  const usersToCreate = [
    { email: 'chris@mjhygiene.com.au', password: 'NuPure2026!', role: 'mj_admin', name: 'Chris (MJ Hygiene Admin)' },
    { email: 'admin@nupure.tmservices.cloud', password: 'NuPure2026!', role: 'mj_admin', name: 'Nu-Pure Portal Admin' },
  ];

  for (const u of usersToCreate) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { role: u.role, full_name: u.name },
      }),
    });
    if (res.ok) {
      console.log(`   ✓ Created user: ${u.email}`);
    } else {
      const txt = await res.text();
      if (txt.includes('already') || res.status === 422) {
        console.log(`   • User ${u.email} already exists`);
      } else {
        console.log(`   ! User ${u.email} status ${res.status}: ${txt}`);
      }
    }
  }
}

async function seedSanitationAndSchedule() {
  console.log('2. Seeding Nu-Pure Master Sanitation Tasks & Active Schedule Events...');
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const sanitationRows = NUPURE_ROOMS.map(r => ({
    airtable_id: `task_${r.id}`,
    data: {
      'Cleaning Task': r.checklist.join(' • '),
      'Area': r.zone,
      'Area 2': r.room,
      'Department': r.zone,
      'Asset / Element': r.room,
      'Cleaning Frequency': r.frequencyLabel,
      'Frequency in days': r.frequencyInDays,
      'Permit Requirement': r.limitations ? 'Exclusion Applies — See Scope' : 'Standard Site PPE',
      'DOC_Gotzinger': r.code,
      'Area Group': r.zone,
      'Procedure Document': [],
      'Procedure Sign Off': `/cleaning-report?room=${encodeURIComponent(r.room)}`,
    },
    synced_at: new Date().toISOString(),
  }));

  const scheduleRows = NUPURE_ROOMS.map(r => ({
    airtable_id: `ev_${r.id}`,
    data: {
      'Event ID': r.code,
      'Notes': r.workstationNote || `${r.frequencyLabel} Hygiene Scope`,
      'Assignee': 'MJ Hygiene Site Team',
      'Status': 'Completed',
      'Cleaning Task (from Cleaning Task)': [r.checklist.join(' • ')],
      'Area (from Cleaning Task)': [r.zone],
      'Area 2 (from Cleaning Task)': [r.room],
      'Department (from Cleaning Task)': [r.zone],
      'Asset / Element (from Cleaning Task)': [r.room],
      'Cleaning Frequency (from Cleaning Task)': [r.frequencyLabel],
      'Last Cleaning Date': today,
      'Actual Completion Date': today,
      'Next Clean Date': tomorrow,
      'Days Until Due': r.frequencyInDays,
      'Week Number': 43,
      'Full Name (from Employees)': ['MJ Hygiene Site Team'],
      'Comments': `Scheduled ${r.frequencyLabel} — Tender v1.1 Scope`,
      'Report': [],
      'Pre-clean photo 1': [],
      'Post Cleaning Photo 1': [],
    },
    synced_at: new Date().toISOString(),
  }));

  const res1 = await fetch(`${SUPABASE_URL}/rest/v1/nupure_sanitation_tasks`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(sanitationRows),
  });
  if (!res1.ok) throw new Error(`nupure_sanitation_tasks failed: ${await res1.text()}`);

  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/nupure_schedule_events`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(scheduleRows),
  });
  if (!res2.ok) throw new Error(`nupure_schedule_events failed: ${await res2.text()}`);

  console.log(`   ✓ Seeded ${sanitationRows.length} Sanitation Scope Tasks & ${scheduleRows.length} Active Schedule Events`);
}

async function seedCleaningProgramTables() {
  console.log('3. Seeding Nu-Pure Cleaning Program Workstreams, Areas & Task Templates...');
  // Clear existing CP rows to avoid duplicates on re-run
  await fetch(`${SUPABASE_URL}/rest/v1/nupure_cp_task_templates?id=not.is.null`, { method: 'DELETE', headers: HEADERS });
  await fetch(`${SUPABASE_URL}/rest/v1/nupure_cp_areas?id=not.is.null`, { method: 'DELETE', headers: HEADERS });
  await fetch(`${SUPABASE_URL}/rest/v1/nupure_cp_workstreams?id=not.is.null`, { method: 'DELETE', headers: HEADERS });

  const wsRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_cp_workstreams`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify([
      {
        code: 'WS-DAILY-7D',
        display_name: '7-Day Operational Scope (Mon–Sun)',
        operational_label: 'Daily 7-Day Production, Warehouse Accessible & Drivers Amenities (45 hrs/wk)',
        shift_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        scope_description: 'High-traffic production amenities, lunchroom, maintenance offices, warehouse accessible toilet, and drivers toilet cleaned 7 days per week.',
        sort_order: 1,
      },
      {
        code: 'WS-WEEKDAY-5D',
        display_name: '5-Day Corporate & Office Scope (Mon–Fri)',
        operational_label: 'Weekday Head Office, Production Offices, Warehouse Offices, Mezzanine & Gatehouse',
        shift_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        scope_description: 'Full weekday cleaning across Head Office, Production Offices & Lab, Warehouse Offices, Mezzanine Floor, and Gatehouse.',
        sort_order: 2,
      },
      {
        code: 'WS-WEEKLY-HYG',
        display_name: 'Weekly Hygiene Services & Periodic Deep Cleans',
        operational_label: 'Sanitary Waste Units (8–10 Bins), Air Fresheners (9 Units) & Friday Fridge Clean',
        shift_days: ['Fri'],
        scope_description: 'Weekly sanitary bin service, automatic air freshener checks/refills, and Friday internal refrigerator clean.',
        sort_order: 3,
      },
    ]),
  });
  const workstreams = await wsRes.json();
  const wsByCode = Object.fromEntries(workstreams.map(w => [w.code, w.id]));

  const areaPayloads = NUPURE_ROOMS.map((r, idx) => ({
    code: r.code,
    name: `${r.zone} — ${r.room}`,
    description: r.workstationNote || r.frequencyLabel,
    active: true,
    sort_order: idx + 1,
  }));

  const areasRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_cp_areas`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(areaPayloads),
  });
  const areas = await areasRes.json();
  const areaByCode = Object.fromEntries(areas.map(a => [a.code, a.id]));

  const templates = [];
  let sortIdx = 1;
  for (const r of NUPURE_ROOMS) {
    for (const item of r.checklist) {
      templates.push({
        area_id: areaByCode[r.code],
        workstream_id: wsByCode[r.workstreamCode],
        name: item,
        cleaning_level: r.frequencyBadge,
        frequency_type: r.frequencyBadge === 'WEEKLY' ? 'weekly' : 'daily',
        frequency_interval: 1,
        occurrences_per_week: r.frequencyBadge === '7 DAYS' ? 7 : r.frequencyBadge === '5 DAYS' ? 5 : 1,
        instructions: `${r.zone} — ${r.room}: ${item}`,
        limitation_text: r.limitations || null,
        source_sheet: 'MJ Hygiene Tender Submission Nu Pure v1.1',
        sort_order: sortIdx++,
        active: true,
      });
    }
  }

  await fetch(`${SUPABASE_URL}/rest/v1/nupure_cp_task_templates`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify(templates),
  });
  console.log(`   ✓ Seeded 3 Workstreams, ${areas.length} Areas, and ${templates.length} Task Templates`);
}

async function seedFormTemplates() {
  console.log('4. Seeding Nu-Pure Inspection Form Templates...');
  const templates = [
    {
      name: 'Nu-Pure Daily Facility & Amenities Inspection',
      slug: 'daily-facility-inspection',
      description: 'Daily supervisor hygiene inspection across Head Office, Production, Warehouse, Mezzanine, and Gatehouse.',
      form_type: 'inspection',
      is_active: true,
      version: 1,
      sections: [
        {
          id: 'sec-ho',
          title: '1. Head Office & Executive Amenities',
          items: [
            { id: 'ho-1', label: 'Main Open-Plan Office (36 workstations) & Individual Offices (6) — Bins emptied, desks wiped, carpets vacuumed' },
            { id: 'ho-2', label: 'Boardroom & Small Meeting Rooms (1 & 2) — Tables sanitised, glass streak-free, presentation ready' },
            { id: 'ho-3', label: 'Head Office Amenities (Male, Female, Accessible) — Toilets/urinals sanitised, mirrors polished, consumables stocked' },
            { id: 'ho-4', label: 'Head Office Lunchroom & Main Entry — Benches/sinks food-safe sanitised, appliances wiped, floors mopped' },
          ],
        },
        {
          id: 'sec-prod',
          title: '2. Production Areas (7-Day & 5-Day Scope)',
          items: [
            { id: 'pr-1', label: 'Maintenance Offices (7-Day) & Production Offices 1 & 2 — Desks sanitised, bins relined, floors clean' },
            { id: 'pr-2', label: "Plant Manager's Office & Laboratory — Floors mopped, general waste cleared (Lab benchtops/equipment excluded)" },
            { id: 'pr-3', label: 'Production Lunchroom & Entry (7-Day) — Tables, sinks, microwaves, fridge exteriors sanitised & floors disinfected' },
            { id: 'pr-4', label: 'Production Male & Female Amenities (7-Day) — Cubicles, urinals, showers, sinks & lockers sanitised and restocked' },
          ],
        },
        {
          id: 'sec-wh',
          title: '3. Warehouse Areas',
          items: [
            { id: 'wh-1', label: "Open-Plan Warehouse Office, Sam's Office, CFO Office & Photocopy Area — Workstations, bins & floors clean" },
            { id: 'wh-2', label: 'Warehouse Kitchenette — Benchtops, sink, appliances & floor sanitised' },
            { id: 'wh-3', label: 'Warehouse Office Toilets (2 Cubicles) & Accessible/Unisex Toilet (7-Day) — Sanitised & fully stocked' },
          ],
        },
        {
          id: 'sec-mez-gh',
          title: "4. Mezzanine Floor & Gatehouse / Drivers' Toilet",
          items: [
            { id: 'mz-1', label: 'Mezzanine Boardroom, Hamilton & Holmes Rooms, Kitchen & Seating Area — Clean, sanitised & vacuumed' },
            { id: 'mz-2', label: 'Mezzanine Male & Female Toilets — Sanitised, mopped & consumables replenished' },
            { id: 'gh-1', label: "Drivers' Toilet (7-Day), Gatehouse Tea/Coffee Area & Gatehouse Offices — Sanitised, restocked & floors mopped" },
          ],
        },
      ],
    },
    {
      name: 'Nu-Pure Weekly Hygiene & Quality Assurance Audit',
      slug: 'weekly-hygiene-audit',
      description: 'Weekly QA audit covering all 5 facility zones, Friday internal fridge clean, sanitary bins, air fresheners, and WHS compliance.',
      form_type: 'audit',
      is_active: true,
      version: 1,
      sections: [
        {
          id: 'sec-wk-1',
          title: '1. Weekly Periodic & Hygiene Services',
          items: [
            { id: 'wk-1', label: 'Production Lunchroom Fridges — Friday internal refrigerator clean & food-safe sanitisation completed' },
            { id: 'wk-2', label: 'Sanitary Waste Management — All 8–10 sanitary bins serviced and exterior units disinfected' },
            { id: 'wk-3', label: 'Automatic Air Fresheners — All 9 amenity dispensers operational and fragrance canisters active' },
            { id: 'wk-4', label: 'Weekly Consumables Stocktake — Stocktake check completed and order emailed to Nu-Pure' },
          ],
        },
        {
          id: 'sec-wk-2',
          title: '2. WHS, Colour-Coding & Chemical Compliance',
          items: [
            { id: 'wk-5', label: 'Colour-coded microfibre cloths and mops strictly segregated by zone (Amenities vs Kitchen/Lunchroom vs General)' },
            { id: 'wk-6', label: 'Cleaner store room tidy, SDS register current, and all chemical bottles properly labelled' },
            { id: 'wk-7', label: 'All QR Code Required Actions raised during the week resolved and Completion Reports issued' },
          ],
        },
      ],
    },
  ];

  const res = await fetch(`${SUPABASE_URL}/rest/v1/nupure_form_templates?on_conflict=slug`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(templates),
  });
  if (!res.ok) throw new Error(`nupure_form_templates failed: ${await res.text()}`);
  console.log(`   ✓ Seeded ${templates.length} Form Templates`);
}

async function seedStocktakeCatalogue() {
  console.log('5. Seeding Nu-Pure Stocktake Consumables Catalogue...');
  await fetch(`${SUPABASE_URL}/rest/v1/nupure_stocktake_items?id=not.is.null`, { method: 'DELETE', headers: HEADERS });

  const items = [
    { category: 'Paper & Washroom Consumables', item_name: '2-Ply Individually Wrapped Toilet Rolls (Carton of 48)', product_code: 'NP-TP-48', unit: 'Carton', par_level: 8, current_stock: 6, sort_order: 1 },
    { category: 'Paper & Washroom Consumables', item_name: 'Jumbo Toilet Tissue Rolls (Carton of 8)', product_code: 'NP-JTR-08', unit: 'Carton', par_level: 6, current_stock: 4, sort_order: 2 },
    { category: 'Paper & Washroom Consumables', item_name: 'Slimline Interleaved Hand Towels (Carton of 16 Packs)', product_code: 'NP-HT-16', unit: 'Carton', par_level: 10, current_stock: 7, sort_order: 3 },
    { category: 'Paper & Washroom Consumables', item_name: 'Roll Hand Towel — Production & Lunchrooms (Carton of 12)', product_code: 'NP-RHT-12', unit: 'Carton', par_level: 6, current_stock: 5, sort_order: 4 },
    { category: 'Paper & Washroom Consumables', item_name: 'Facial Tissues 2-Ply — Boardrooms & Executive Offices', product_code: 'NP-FT-24', unit: 'Carton', par_level: 2, current_stock: 2, sort_order: 5 },

    { category: 'Hand Hygiene & Amenity Soaps', item_name: 'Antibacterial Liquid Hand Soap 1000ml Pod Refills (Carton of 6)', product_code: 'NP-HS-06', unit: 'Carton', par_level: 6, current_stock: 4, sort_order: 6 },
    { category: 'Hand Hygiene & Amenity Soaps', item_name: 'Bulk Liquid Hand Soap 5L Refill Drum', product_code: 'NP-HS-5L', unit: '5L Drum', par_level: 4, current_stock: 3, sort_order: 7 },
    { category: 'Hand Hygiene & Amenity Soaps', item_name: 'Production Shower Hair & Body Wash 5L', product_code: 'NP-BW-5L', unit: '5L Drum', par_level: 3, current_stock: 2, sort_order: 8 },
    { category: 'Hand Hygiene & Amenity Soaps', item_name: 'Alcohol Hand Sanitiser Gel 1000ml Refills', product_code: 'NP-SAN-06', unit: 'Carton', par_level: 4, current_stock: 4, sort_order: 9 },

    { category: 'Bin Liners & Waste Management', item_name: 'Small Office Desk Bin Liners 18L–27L (Roll of 50)', product_code: 'NP-BL-27', unit: 'Roll', par_level: 10, current_stock: 8, sort_order: 10 },
    { category: 'Bin Liners & Waste Management', item_name: 'Heavy Duty Kitchen / Lunchroom Bin Liners 75L–82L (Carton of 250)', product_code: 'NP-BL-82', unit: 'Carton', par_level: 4, current_stock: 2, sort_order: 11 },
    { category: 'Bin Liners & Waste Management', item_name: 'Wheelie Bin Liners 120L / 240L Heavy Duty (Carton of 100)', product_code: 'NP-BL-240', unit: 'Carton', par_level: 3, current_stock: 3, sort_order: 12 },
    { category: 'Bin Liners & Waste Management', item_name: 'Sanitary Hygiene Unit Modesty Liners (Pack of 100)', product_code: 'NP-SBL-100', unit: 'Pack', par_level: 4, current_stock: 3, sort_order: 13 },

    { category: 'Approved Cleaning Chemicals & Kitchenette', item_name: 'Hospital-Grade Disinfectant & Surface Sanitiser 5L', product_code: 'NP-CH-DIS5', unit: '5L Drum', par_level: 4, current_stock: 3, sort_order: 14 },
    { category: 'Approved Cleaning Chemicals & Kitchenette', item_name: 'Neutral pH Hard Floor Cleaner Concentrate 5L', product_code: 'NP-CH-FLR5', unit: '5L Drum', par_level: 4, current_stock: 3, sort_order: 15 },
    { category: 'Approved Cleaning Chemicals & Kitchenette', item_name: 'Bathroom & Toilet Descaler / Washroom Sanitiser 5L', product_code: 'NP-CH-BTH5', unit: '5L Drum', par_level: 4, current_stock: 2, sort_order: 16 },
    { category: 'Approved Cleaning Chemicals & Kitchenette', item_name: 'Dishwashing Liquid 5L & Dishwasher Tablets — Lunchrooms', product_code: 'NP-CH-DSH5', unit: 'Pack / Drum', par_level: 4, current_stock: 3, sort_order: 17 },

    { category: 'Hygiene Service Refills & Equipment', item_name: 'Automatic Air Freshener 300ml Metered Aerosol Canisters (9 Units)', product_code: 'NP-AF-300', unit: 'Canister', par_level: 12, current_stock: 9, sort_order: 18 },
  ];

  const res = await fetch(`${SUPABASE_URL}/rest/v1/nupure_stocktake_items`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error(`nupure_stocktake_items failed: ${await res.text()}`);
  console.log(`   ✓ Seeded ${items.length} Stocktake Consumable Items`);
}

async function seedEmailSettings() {
  console.log('6. Seeding Nu-Pure Email Settings...');
  const settings = [
    {
      report_type: 'daily-facility-inspection',
      report_label: 'Daily Facility & Amenities Inspection',
      recipients: [{ name: 'MJ Hygiene Operations', email: 'chris@mjhygiene.com.au' }],
      send_on_submit: true,
      send_on_fail_only: false,
      fail_threshold: 85,
    },
    {
      report_type: 'weekly-hygiene-audit',
      report_label: 'Weekly Hygiene & Quality Assurance Audit',
      recipients: [{ name: 'MJ Hygiene Operations', email: 'chris@mjhygiene.com.au' }],
      send_on_submit: true,
      send_on_fail_only: false,
      fail_threshold: 85,
    },
    {
      report_type: 'stocktake-order',
      report_label: 'Weekly Consumables Stocktake & Requisition Order',
      recipients: [{ name: 'MJ Hygiene Operations', email: 'chris@mjhygiene.com.au' }],
      send_on_submit: true,
      send_on_fail_only: false,
      fail_threshold: 0,
    },
    {
      report_type: 'qr-issue-alert',
      report_label: 'QR Code Cleaning Issue Alert (Required Action Raised)',
      recipients: [{ name: 'MJ Hygiene Operations', email: 'chris@mjhygiene.com.au' }],
      send_on_submit: true,
      send_on_fail_only: false,
      fail_threshold: 0,
    },
    {
      report_type: 'qr-issue-completion',
      report_label: 'QR Code Issue Completion & Close-Out Report',
      recipients: [{ name: 'MJ Hygiene Operations', email: 'chris@mjhygiene.com.au' }],
      send_on_submit: true,
      send_on_fail_only: false,
      fail_threshold: 0,
    },
  ];

  const res = await fetch(`${SUPABASE_URL}/rest/v1/nupure_email_settings?on_conflict=report_type`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`nupure_email_settings failed: ${await res.text()}`);
  console.log(`   ✓ Seeded ${settings.length} Email Notification Settings`);
}

async function syncNuPureAirtableDocuments() {
  console.log('7. Syncing Nu-Pure Training Documents from Airtable to nupure-supabase...');
  const formula = 'OR(FIND("Nu Pure", ARRAYJOIN({Site Name (from Grid view)})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Site Assigned})))';
  const params = new URLSearchParams({ pageSize: '100', filterByFormula: formula });
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_TRAINING}/tblwtH46TSh45tpnD?${params}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  if (!res.ok) {
    console.warn('   ! Airtable fetch warning:', await res.text());
    return;
  }
  const json = await res.json();
  const records = json.records || [];

  const rows = [];
  for (const rec of records) {
    const fields = { ...rec.fields };
    for (const [field, folder] of [
      ['Document Upload', 'documents'],
      ['Document Link', 'training-documents'],
    ]) {
      if (Array.isArray(fields[field]) && fields[field].length > 0) {
        const updatedAtts = [];
        for (const att of fields[field]) {
          try {
            const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${folder}/${rec.id}/${att.id}-${safeName}`;
            const fileRes = await fetch(att.url);
            if (fileRes.ok) {
              const buf = await fileRes.arrayBuffer();
              await fetch(`${SUPABASE_URL}/storage/v1/object/nupure-attachments/${storagePath}`, {
                method: 'POST',
                headers: {
                  apikey: SERVICE_KEY,
                  Authorization: `Bearer ${SERVICE_KEY}`,
                  'Content-Type': att.type || 'application/pdf',
                  'x-upsert': 'true',
                },
                body: buf,
              });
              updatedAtts.push({ ...att, url: `supabase-storage://${storagePath}`, storagePath });
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
    rows.push({ airtable_id: rec.id, data: fields, synced_at: new Date().toISOString() });
  }

  if (rows.length > 0) {
    const upRes = await fetch(`${SUPABASE_URL}/rest/v1/nupure_training_documents`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!upRes.ok) throw new Error(`nupure_training_documents upsert failed: ${await upRes.text()}`);
  }
  console.log(`   ✓ Synced ${rows.length} Nu-Pure Corporate & Induction Documents (+ PDF attachments) into nupure-supabase`);
}

async function seedInitialSampleRoomClean() {
  console.log('8. Seeding initial baseline Room Cleaning Event Report...');
  const firstRoom = NUPURE_ROOMS[0];
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/nupure_cleaning_records`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify([
      {
        report_number: `CLR-${today.replace(/-/g, '')}-1001`,
        date: today,
        zone: firstRoom.zone,
        location: firstRoom.room,
        frequency_badge: firstRoom.frequencyBadge,
        checklist_items: firstRoom.checklist.map(label => ({ label, completed: true })),
        items_cleaned: firstRoom.checklist.join(' • '),
        total_time_minutes: firstRoom.estimatedMinutes,
        shift_type: 'Weekday (Mon–Fri)',
        cleaning_type: 'Scheduled Daily Hygiene Clean',
        chemicals_used: ['Hospital-Grade Disinfectant / Surface Sanitiser', 'Neutral pH Hard Floor Cleaner'],
        operators_involved: ['MJ Hygiene Site Team'],
        ssop_verified: true,
        visual_inspection_passed: true,
        comments: 'Initial baseline room clean verified to Nu-Pure Tender Specification v1.1.',
        submitted_by: 'MJ Hygiene Site Team',
        supervisor_signoff: 'MJ Hygiene Supervisor',
        schedule_event_id: `ev_${firstRoom.id}`,
      },
    ]),
  });
  if (!res.ok) throw new Error(`nupure_cleaning_records seed failed: ${await res.text()}`);
  console.log('   ✓ Seeded baseline Room Cleaning Event Report');
}

async function main() {
  await createAdminUsers();
  await seedSanitationAndSchedule();
  await seedCleaningProgramTables();
  await seedFormTemplates();
  await seedStocktakeCatalogue();
  await seedEmailSettings();
  await syncNuPureAirtableDocuments();
  await seedInitialSampleRoomClean();
  console.log('\n✅ Nu-Pure Supabase Seeding & Airtable Sync Complete!');
}

main().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
