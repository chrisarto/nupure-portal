import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeId() {
  return crypto.randomUUID();
}

async function run() {
  // Fetch all sanitation tasks to build pre-op sections from real Gotzinger data
  const { data: tasks } = await supabase
    .from('gotzinger_sanitation_tasks')
    .select('data')
    .limit(500);

  // Group tasks by area
  const areaMap = {};
  for (const r of (tasks || [])) {
    const area = r.data['Area'] || 'General';
    const asset = r.data['SCOPE OF WORK'] || r.data['Cleaning Task'] || '';
    if (!areaMap[area]) areaMap[area] = [];
    // Deduplicate
    if (asset && !areaMap[area].includes(asset)) {
      areaMap[area].push(asset);
    }
  }

  const sortedAreas = Object.keys(areaMap).sort();
  const allAreas = sortedAreas.join(', ');

  // ════════════════════════════════════════════
  // 1. Daily Pre-Op Hygiene — Gotzinger
  // ════════════════════════════════════════════
  const dailyPreOpSections = sortedAreas.map(area => ({
    id: makeId(),
    title: area,
    items: areaMap[area].sort().map(item => ({
      id: makeId(),
      label: item,
    })),
  }));

  const dailyPreOp = {
    slug: 'daily-pre-op-fresh-meat',
    name: 'Daily Pre-Op Hygiene — Gotzinger',
    description: `Daily pre-operational hygiene inspection covering ${allAreas}. Gotzinger Smallgoods site.`,
    form_type: 'pre-op',
    sections: dailyPreOpSections,
    is_active: true,
    version: 1,
  };

  // ════════════════════════════════════════════
  // 2. Weekly Pre-Op Hygiene — Gotzinger
  // ════════════════════════════════════════════
  // For weekly, use same areas but with broader infrastructure checks
  const weeklyItems = [
    'Walls, floors, doors and ceiling — deep clean standard',
    'All drain grates removed and drains cleaned',
    'FDC units — coils, drip trays, filters cleaned',
    'All overhead structures, lights, cable trays cleaned',
    'All racking and shelving cleaned underneath',
    'Chemical station stocked and labelled',
    'All hoses racked and nozzles cleaned',
    'Pest control bait stations clear and undamaged',
  ];

  const weeklyPreOpSections = sortedAreas.map(area => ({
    id: makeId(),
    title: area,
    items: weeklyItems.map(item => ({
      id: makeId(),
      label: item,
    })),
  }));

  const weeklyPreOp = {
    slug: 'weekly-pre-op-hygiene',
    name: 'Weekly Pre-Op Hygiene — Gotzinger',
    description: `Weekly pre-operational hygiene inspection covering ${allAreas}. Gotzinger Smallgoods site.`,
    form_type: 'pre-op',
    sections: weeklyPreOpSections,
    is_active: true,
    version: 1,
  };

  // ════════════════════════════════════════════
  // 3. Post-Production Handover — Gotzinger
  // ════════════════════════════════════════════
  const handoverItems = [
    'Area handed over by correct time',
    'All machines dismantled and ready for cleaning',
    'Condition of floor (Pass = Good · Re-Clean = Fair · Fail = Poor)',
    'Equipment condition acceptable for cleaning',
  ];

  const handoverSections = sortedAreas.map(area => ({
    id: makeId(),
    title: area,
    items: handoverItems.map(item => ({
      id: makeId(),
      label: item,
    })),
  }));

  const handover = {
    slug: 'post-production-handover',
    name: 'Post-Production Handover — Gotzinger',
    description: `Record the condition of each production area when handed over to the sanitation team after production at the Gotzinger Smallgoods site. One section per area — assess only the areas that ran today. Captures: handover time, machine dismantling, floor condition, equipment condition and photographic evidence.`,
    form_type: 'handover',
    sections: handoverSections,
    is_active: true,
    version: 1,
  };

  // ════════════════════════════════════════════
  // Update all three templates
  // ════════════════════════════════════════════
  for (const template of [dailyPreOp, weeklyPreOp, handover]) {
    console.log(`Updating: ${template.slug} — ${template.name}`);
    console.log(`  Sections: ${template.sections.length}`);
    console.log(`  Total items: ${template.sections.reduce((sum, s) => sum + s.items.length, 0)}`);

    const { error } = await supabase
      .from('gotzinger_form_templates')
      .update({
        name: template.name,
        description: template.description,
        sections: template.sections,
        version: template.version,
      })
      .eq('slug', template.slug);

    if (error) {
      console.error(`  ERROR: ${error.message}`);
    } else {
      console.log(`  ✅ Updated successfully`);
    }
  }
}

run();
