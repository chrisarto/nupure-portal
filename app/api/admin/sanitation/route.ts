import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    const newAirtableId = `nupure_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`;
    
    // Wrap fields in the 'data' JSONB object matching Airtable field names
    const newTask = {
      airtable_id: newAirtableId,
      data: {
        'Cleaning Task': body.cleaningTask,
        'Area': body.area || '',
        'Area 2': body.area2 || '',
        'Department': body.department || '',
        'SCOPE OF WORK': body.assetElement || '',
        'Frequency': body.cleaningFrequency || '',
        'Frequency in days': body.frequencyInDays || null,
        'Permit Requirement': body.permitRequirement || '',
        'Doc-Nu-Pure': body.docGotzinger || '',
        'Area (1 of 3)': body.areaGroup || '',
        'Procedure Sign off URL': body.procedureSignOffUrl || '',
      },
      synced_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('nupure_sanitation_tasks')
      .insert([newTask])
      .select()
      .single();

    if (error) throw error;
    
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing task ID' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('nupure_sanitation_tasks')
      .update({
        data: {
          'Cleaning Task': updates.cleaningTask,
          'Area': updates.area || '',
          'Area 2': updates.area2 || '',
          'Department': updates.department || '',
          'SCOPE OF WORK': updates.assetElement || '',
          'Frequency': updates.cleaningFrequency || '',
          'Frequency in days': updates.frequencyInDays || null,
          'Permit Requirement': updates.permitRequirement || '',
          'Doc-Nu-Pure': updates.docGotzinger || '',
          'Area (1 of 3)': updates.areaGroup || '',
          'Procedure Sign off URL': updates.procedureSignOffUrl || '',
        },
        synced_at: new Date().toISOString()
      })
      .eq('airtable_id', id)
      .select()
      .single();

    if (error) throw error;
    
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing task ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('nupure_sanitation_tasks')
      .delete()
      .eq('airtable_id', id);

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
