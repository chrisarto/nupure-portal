import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSubmissionPDF } from '@/lib/pdf-generator';
import type { SubmissionDetail } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: submission, error: subError } = await supabase
      .from('nupure_form_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const { data: template, error: tplError } = await supabase
      .from('nupure_form_templates')
      .select('sections')
      .eq('slug', (submission as SubmissionDetail).template_slug)
      .single();

    if (tplError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const pdfBuffer = await generateSubmissionPDF(
      submission as SubmissionDetail,
      template.sections as Array<{ id: string; title: string; items: Array<{ id: string; label: string }> }>
    );

    const filename = `Nu-Pure-${(submission as SubmissionDetail).template_slug}-${new Date().toISOString().slice(0,10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 }
    );
  }
}
