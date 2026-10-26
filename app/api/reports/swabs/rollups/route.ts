export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SwabRollupReport } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type'); // 'weekly' or 'monthly' or null

    const supabase = await createClient();
    let query = supabase
      .from('nupure_swab_rollup_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (type && (type === 'weekly' || type === 'monthly')) {
      query = query.eq('report_type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching swab roll-up reports:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: (data ?? []) as SwabRollupReport[],
      count: (data ?? []).length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Swab roll-ups GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const reportType = (formData.get('report_type') as string) || 'weekly';
    const titleInput = formData.get('title') as string | null;
    const periodStart = (formData.get('period_start') as string) || null;
    const periodEnd = (formData.get('period_end') as string) || null;
    const periodLabelInput = (formData.get('period_label') as string) || null;
    const notes = formData.get('notes') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Report file is required' }, { status: 400 });
    }

    if (reportType !== 'weekly' && reportType !== 'monthly') {
      return NextResponse.json({ error: 'Invalid report type. Expected weekly or monthly' }, { status: 400 });
    }

    // Generate smart label and title if not provided
    let periodLabel = periodLabelInput?.trim() || null;
    if (!periodLabel) {
      if (periodEnd) {
        const d = new Date(`${periodEnd}T00:00:00`);
        if (!isNaN(d.getTime())) {
          if (reportType === 'monthly') {
            periodLabel = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
          } else {
            periodLabel = `Week Ending ${d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}`;
          }
        }
      }
    }

    let title = titleInput?.trim();
    if (!title) {
      title = reportType === 'monthly'
        ? `Monthly Swab Roll-Up — ${periodLabel || 'Summary'}`
        : `Weekly Swab Roll-Up — ${periodLabel || 'Summary'}`;
    }

    // Upload file to Supabase storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `swab-rollups/${reportType}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError.message);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    // Insert record into nupure_swab_rollup_reports
    const { data: record, error: insertError } = await supabase
      .from('nupure_swab_rollup_reports')
      .insert({
        title,
        report_type: reportType,
        period_start: periodStart || null,
        period_end: periodEnd || null,
        period_label: periodLabel,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || null,
        uploaded_by: user.email || 'Unknown',
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('DB insert error:', insertError.message);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Swab roll-ups POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
