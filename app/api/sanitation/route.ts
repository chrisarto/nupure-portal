export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SanitationTask } from '@/lib/airtable';

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    
    // Get the most recent pre-op submission to extract the current checklist items
    const { data: latestSub, error: subError } = await supabase
      .from('nupure_form_submissions')
      .select('responses')
      .eq('template_slug', 'client-pre-op')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Sanitation API Supabase error:', subError.message);
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    const tasks: SanitationTask[] = [];
    
    if (latestSub?.responses) {
      const resp = latestSub.responses as Record<string, any>;
      let idCounter = 1;
      
      for (const [key, val] of Object.entries(resp)) {
        if (key.startsWith('_') || key === 'global_photos') continue;
        if (typeof val !== 'object' || !val) continue;
        
        const area = val._area || 'Other';
        const label = val._label || key;
        
        // Everything is daily except FDC and Fogging which are weekly
        const isWeekly = label.toLowerCase().includes('fdc') || label.toLowerCase().includes('fog');
        const freq = isWeekly ? 'Weekly' : 'Daily';
        const freqDays = isWeekly ? 7 : 1;
        
        tasks.push({
          id: `preop-task-${idCounter++}`,
          cleaningTask: label,
          area: area,
          area2: '',
          department: '',
          assetElement: '',
          cleaningFrequency: freq,
          frequencyInDays: freqDays,
          permitRequirement: '',
          docGotzinger: '',
          areaGroup: '',
          procedureDocument: [],
          procedureSignOffUrl: '',
        });
      }
    }
    
    // Sort by area then task name
    tasks.sort((a, b) => {
      const cmp = a.area.localeCompare(b.area);
      if (cmp !== 0) return cmp;
      return a.cleaningTask.localeCompare(b.cleaningTask);
    });

    return NextResponse.json({ data: tasks, count: tasks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Sanitation API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
