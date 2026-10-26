export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ScheduleEvent } from '@/lib/airtable';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

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
      console.error('Schedule API Supabase error:', subError.message);
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    let data: ScheduleEvent[] = [];
    
    if (latestSub?.responses) {
      const resp = latestSub.responses as Record<string, any>;
      let idCounter = 1;
      
      const today = new Date();
      // Calculate next Sunday as due date for weekly tasks
      const nextSunday = new Date(today);
      nextSunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
      if (today.getDay() === 0) nextSunday.setDate(today.getDate() + 7);
      const nextCleanStr = nextSunday.toISOString().split('T')[0];
      
      const daysUntilDue = Math.ceil((nextSunday.getTime() - today.getTime()) / (1000 * 3600 * 24));
      
      let status = 'Scheduled';
      if (daysUntilDue <= 0) status = 'OverDue';
      else if (daysUntilDue <= 2) status = 'In progress';

      for (const [key, val] of Object.entries(resp)) {
        if (key.startsWith('_') || key === 'global_photos') continue;
        if (typeof val !== 'object' || !val) continue;
        
        const area = val._area || 'Other';
        const label = val._label || key;
        
        // Only include FDC and Fogging which are weekly
        const isWeekly = label.toLowerCase().includes('fdc') || label.toLowerCase().includes('fog');
        if (!isWeekly) continue;
        
        data.push({
          id: `preop-sched-${idCounter++}`,
          eventId: `WK-${idCounter}`,
          notes: '',
          assignee: '',
          status,
          cleaningTask: label,
          area: area,
          area2: '',
          department: 'Weekly',
          assetElement: '',
          cleaningFrequency: 'Weekly',
          lastCleaningDate: '',
          actualCompletionDate: '',
          nextCleanDate: nextCleanStr,
          daysUntilDue,
          weekNumber: null,
          employees: [],
          comments: '',
          report: [],
          preCleanPhoto1: [],
          postCleanPhoto1: [],
        });
      }
    }

    // Apply status filter if provided
    if (statusFilter) {
      data = data.filter(evt => evt.status === statusFilter);
    }

    // Sort by area then task name
    data.sort((a, b) => {
      const cmp = a.area.localeCompare(b.area);
      if (cmp !== 0) return cmp;
      return a.cleaningTask.localeCompare(b.cleaningTask);
    });

    return NextResponse.json({ data, count: data.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Schedule API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
