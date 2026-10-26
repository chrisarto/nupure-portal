import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slugParam = searchParams.get('slug');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  let query = supabase
    .from('nupure_form_submissions')
    .select('id, template_slug, template_name, submitted_by, submitted_by_email, area, overall_score, score_pass, score_fail, score_reclean, score_total, status, submitted_at, created_at, reclean_signed_off_by, reclean_signed_off_at, responses, pdf_url')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (slugParam) {
    const slugs = slugParam.split(',').map((s) => s.trim());
    query = query.in('template_slug', slugs);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], count });
}
