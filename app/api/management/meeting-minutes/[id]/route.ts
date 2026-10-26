export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch record to check existence and extract storage path
    const { data: record, error: fetchError } = await supabase
      .from('nupure_meeting_minutes')
      .select('id, file_url')
      .eq('id', id)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Attempt to remove file from storage if it matches documents bucket
    if (record.file_url) {
      const match = record.file_url.match(/\/documents\/(.+)$/);
      if (match && match[1]) {
        const decodedPath = decodeURIComponent(match[1]);
        await supabase.storage.from('documents').remove([decodedPath]).catch(() => null);
      }
    }

    // Delete record from database
    const { error: deleteError } = await supabase
      .from('nupure_meeting_minutes')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Delete error:', deleteError.message);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Meeting minutes DELETE error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
