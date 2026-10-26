import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import type { FormTemplate, FormSection, FormItem } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  // Dynamic interception for Pre-Op Forms
  if (slug === 'pre-op-high-risk' || slug === 'pre-op-low-risk') {
    const department = slug === 'pre-op-high-risk' ? 'High Risk' : 'Low Risk';
    const { data: tasks, error } = await supabase
      .from('nupure_sanitation_tasks')
      .select('airtable_id, data');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by department (using the JSONB data column)
    const filteredTasks = (tasks || []).filter((task: any) => task.data?.Department === department);

    // Group by Area
    const sectionsMap: Record<string, FormItem[]> = {};
    for (const task of filteredTasks) {
      const area = task.data?.Area || 'General';
      const itemLabel = task.data?.['SCOPE OF WORK'] || task.data?.['Cleaning Task'] || 'Unknown Item';
      
      if (!sectionsMap[area]) {
        sectionsMap[area] = [];
      }
      sectionsMap[area].push({ id: task.airtable_id, label: itemLabel });
    }

    const sections: FormSection[] = Object.keys(sectionsMap).map(area => ({
      id: `section_${area.replace(/[^a-zA-Z0-9]/g, '_')}`,
      title: area,
      items: sectionsMap[area]
    }));

    const dynamicTemplate: FormTemplate = {
      id: slug === 'pre-op-high-risk' ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222',
      name: `Daily Pre-Op Check - ${department}`,
      slug: slug,
      description: `Daily Pre-Operational monitoring form for the ${department} department.`,
      form_type: 'pre-op',
      sections,
      is_active: true,
      version: 1,
      created_at: new Date().toISOString()
    };

    return NextResponse.json({ data: dynamicTemplate });
  }

  const { data, error } = await supabase
    .from('nupure_form_templates')
    .select('id, name, slug, sections')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ data: null }, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
