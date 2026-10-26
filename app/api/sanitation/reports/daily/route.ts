import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const workstream = searchParams.get('workstream');

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get task instances for the date with full template and photo data
    let query = supabase
      .from('nupure_cp_task_instances')
      .select(`
        *,
        nupure_cp_task_templates!inner(
          name,
          frequency_type,
          sort_order,
          scheduling_constraint,
          fixed_time_start,
          fixed_time_end,
          instructions,
          limitation_text,
          cleaning_level,
          nupure_cp_areas(name),
          nupure_cp_workstreams!inner(code, display_name, sort_order)
        ),
        nupure_cp_task_photos(
          id,
          photo_type,
          storage_path,
          uploaded_by,
          uploaded_at,
          caption
        )
      `)
      .eq('scheduled_date', date);

    if (workstream) {
      query = query.eq('nupure_cp_task_templates.nupure_cp_workstreams.code', workstream);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for photos
    const tasksWithPhotoUrls = await Promise.all(
      (data || []).map(async (task) => {
        const photos = task.nupure_cp_task_photos || [];
        const photosWithUrls = await Promise.all(
          photos.map(async (photo: Record<string, unknown>) => {
            const { data: signedData } = await supabase.storage
              .from('cleaning-photos')
              .createSignedUrl(photo.storage_path as string, 3600);
            return { ...photo, url: signedData?.signedUrl || null };
          })
        );
        return { ...task, nupure_cp_task_photos: photosWithUrls };
      })
    );

    // Sort by workstream then template sort_order
    tasksWithPhotoUrls.sort((a, b) => {
      const tplA = a.nupure_cp_task_templates as Record<string, unknown>;
      const tplB = b.nupure_cp_task_templates as Record<string, unknown>;
      const wsA = tplA?.nupure_cp_workstreams as Record<string, unknown>;
      const wsB = tplB?.nupure_cp_workstreams as Record<string, unknown>;
      const wA = (wsA?.sort_order as number) ?? 0;
      const wB = (wsB?.sort_order as number) ?? 0;
      if (wA !== wB) return wA - wB;
      const tA = (tplA?.sort_order as number) ?? 0;
      const tB = (tplB?.sort_order as number) ?? 0;
      return tA - tB;
    });

    // Build summary per workstream
    const summaryByWorkstream: Record<string, {
      code: string;
      name: string;
      total: number;
      completed: number;
      unable: number;
      deferred: number;
      not_started: number;
    }> = {};

    for (const task of tasksWithPhotoUrls) {
      const tpl = task.nupure_cp_task_templates as Record<string, unknown>;
      const ws = tpl?.nupure_cp_workstreams as Record<string, unknown>;
      const code = (ws?.code as string) || 'UNKNOWN';
      const name = (ws?.display_name as string) || 'Unknown';

      if (!summaryByWorkstream[code]) {
        summaryByWorkstream[code] = { code, name, total: 0, completed: 0, unable: 0, deferred: 0, not_started: 0 };
      }

      summaryByWorkstream[code].total++;
      const status = task.status as string;
      if (status === 'completed') summaryByWorkstream[code].completed++;
      else if (status === 'unable') summaryByWorkstream[code].unable++;
      else if (status === 'deferred') summaryByWorkstream[code].deferred++;
      else summaryByWorkstream[code].not_started++;
    }

    return NextResponse.json({
      date,
      summary: Object.values(summaryByWorkstream),
      tasks: tasksWithPhotoUrls,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
