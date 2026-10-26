import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { FormTemplate } from '@/lib/types';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('nupure_form_templates')
      .select('id, name, slug, description, form_type, is_active, version, created_at')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // sections is omitted from the list query — cast safely
    const templates = (data ?? []) as Omit<FormTemplate, 'sections'>[];

    return NextResponse.json({ data: templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
