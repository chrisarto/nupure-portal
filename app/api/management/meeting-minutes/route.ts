export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MeetingMinute } from '@/lib/types';

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('nupure_meeting_minutes')
      .select('*')
      .order('meeting_date', { ascending: false });

    if (error) {
      console.error('Error fetching meeting minutes:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: (data ?? []) as MeetingMinute[],
      count: (data ?? []).length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Meeting minutes GET error:', message);
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
    const meetingDate = formData.get('meeting_date') as string | null;
    const titleInput = formData.get('title') as string | null;
    const notes = formData.get('notes') as string | null;

    if (!file || !meetingDate) {
      return NextResponse.json(
        { error: 'File and meeting date are required' },
        { status: 400 }
      );
    }

    // Validate meeting date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
      return NextResponse.json(
        { error: 'Invalid meeting date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Default title if not provided
    let title = titleInput?.trim();
    if (!title) {
      const d = new Date(`${meetingDate}T00:00:00`);
      const monthYear = !isNaN(d.getTime())
        ? d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
        : meetingDate;
      title = `Monthly Client Meeting — ${monthYear}`;
    }

    // Upload file to Supabase storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `meeting-minutes/${meetingDate}_${Date.now()}_${safeName}`;

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

    // Insert record into nupure_meeting_minutes
    const { data: record, error: insertError } = await supabase
      .from('nupure_meeting_minutes')
      .insert({
        title,
        meeting_date: meetingDate,
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
    console.error('Meeting minutes POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
