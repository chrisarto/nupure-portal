import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EDIT_ROLES = ['mj_admin', 'mj_supervisor'];

async function checkEditPermission(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const role = (user.user_metadata?.role as string) ?? 'employee';
  return EDIT_ROLES.includes(role);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('nupure_form_submissions')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from('nupure_form_submissions')
    .select('status')
    .eq('id', id)
    .single();

  if (existingError) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isDraft = existing.status === 'draft';
  const hasEditPermission = await checkEditPermission(supabase);

  if (!isDraft && !hasEditPermission) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json() as Record<string, unknown>;
  
  // Allow patching all relevant form fields for draft updates
  const allowed: Record<string, unknown> = {};
  if ('notes' in body) allowed.notes = body.notes;
  if ('status' in body) allowed.status = body.status;
  if ('area' in body) allowed.area = body.area;
  if ('responses' in body) allowed.responses = body.responses;
  if ('submitted_by' in body) allowed.submitted_by = body.submitted_by;
  if ('score_total' in body) allowed.score_total = body.score_total;
  if ('score_pass' in body) allowed.score_pass = body.score_pass;
  if ('score_fail' in body) allowed.score_fail = body.score_fail;
  if ('score_reclean' in body) allowed.score_reclean = body.score_reclean;
  if ('overall_score' in body) allowed.overall_score = body.overall_score;
  if ('section_scores' in body) allowed.section_scores = body.section_scores;

  if (body.status === 'submitted') {
    allowed.submitted_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('nupure_form_submissions')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  if (!await checkEditPermission(supabase)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { error } = await supabase
    .from('nupure_form_submissions')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
