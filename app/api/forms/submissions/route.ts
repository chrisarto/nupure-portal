import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { FormResponses, FormSubmission, ItemResult } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('nupure_form_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && (status === 'draft' || status === 'submitted')) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface SubmissionBody {
  template_id: string;
  template_slug: string;
  template_name: string;
  area: string;
  responses: FormResponses;
  notes: string;
  status: 'draft' | 'submitted';
  submitted_by?: string;
  site?: string;
}

function calculateScores(responses: FormResponses): {
  score_total: number;
  score_pass: number;
  score_fail: number;
  score_reclean: number;
  overall_score: number | null;
} {
  const results: ItemResult[] = Object.values(responses).map((r) => r.result);
  const assessed = results.filter((r): r is NonNullable<ItemResult> => r !== null);

  const score_total = assessed.length;
  const score_pass = assessed.filter((r) => r === 'pass').length;
  const score_fail = assessed.filter((r) => r === 'fail').length;
  const score_reclean = assessed.filter((r) => r === 'reclean').length;
  const overall_score = score_total > 0 ? Math.round((score_pass / score_total) * 100) : null;

  return { score_total, score_pass, score_fail, score_reclean, overall_score };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const body: SubmissionBody = await request.json() as SubmissionBody;

    const {
      template_id,
      template_slug,
      template_name,
      area,
      responses,
      notes,
      status,
      submitted_by = '',
      site = '',
    } = body;

    // Get authenticated user's email
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const submitted_by_email = user?.email ?? '';

    const scores = calculateScores(responses);

    const payload: Omit<FormSubmission, 'id' | 'created_at'> = {
      template_id,
      template_slug,
      template_name,
      submitted_by,
      submitted_by_email,
      site,
      area,
      responses,
      notes,
      status,
      pdf_url: null,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      reclean_signed_off_by: null,
      reclean_signed_off_at: null,
      ...scores,
    };

    const { data, error } = await supabase
      .from('nupure_form_submissions')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire email notifications non-blocking (only for submitted forms)
    if (status === 'submitted' && data) {
      void (async () => {
        try {
          const { createClient: createServiceClient } = await import('@supabase/supabase-js');
          const svc = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
          );

          // Look up email settings for this template slug or fall back to 'general'
          const { data: emailSettingsRows } = await svc
            .from('nupure_email_settings')
            .select('*')
            .in('report_type', [template_slug, 'general']);

          const settings =
            (emailSettingsRows ?? []).find(s => s.report_type === template_slug) ??
            (emailSettingsRows ?? []).find(s => s.report_type === 'general');

          if (!settings?.send_on_submit) return;

          const recipients = (
            (settings.recipients as Array<{ name: string; email: string }>) ?? []
          ).filter(r => r.email?.includes('@'));
          if (!recipients.length) return;

          // Skip if fail-only mode and score meets threshold
          const overallScore: number | null = data.overall_score ?? null;
          if (
            settings.send_on_fail_only &&
            overallScore !== null &&
            overallScore >= (settings.fail_threshold as number)
          ) return;

          // Build fail/reclean item lists from responses
          const responseMap = (data.responses ?? {}) as Record<
            string,
            { result: string | null; comment?: string }
          >;

          // Fetch the template to get section/item labels
          const { data: templateRow } = await svc
            .from('nupure_form_templates')
            .select('sections')
            .eq('id', template_id)
            .single();

          type TemplateSection = { id: string; title: string; items: Array<{ id: string; label: string }> };
          const sections: TemplateSection[] = (templateRow?.sections as TemplateSection[]) ?? [];

          const failItems: Array<{ label: string; section: string; comment?: string }> = [];
          const recleanItems: Array<{ label: string; section: string; comment?: string }> = [];

          for (const section of sections) {
            for (const item of section.items) {
              const resp = responseMap[item.id];
              if (!resp) continue;
              if (resp.result === 'fail') {
                failItems.push({ label: item.label, section: section.title, comment: resp.comment });
              } else if (resp.result === 'reclean') {
                recleanItems.push({ label: item.label, section: section.title, comment: resp.comment });
              }
            }
          }

          const { sendReportEmail } = await import('@/lib/email');
          await sendReportEmail(recipients, {
            templateName: template_name,
            submittedBy: submitted_by || submitted_by_email || 'Unknown',
            submittedAt: data.submitted_at ?? new Date().toISOString(),
            area: area || undefined,
            overallScore,
            scorePass: data.score_pass ?? 0,
            scoreFail: data.score_fail ?? 0,
            scoreReclean: data.score_reclean ?? 0,
            scoreTotal: data.score_total ?? 0,
            failItems,
            recleanItems,
            reportUrl: `https://nupure.tmservices.cloud/reports/submissions/${data.id}`,
            submissionId: data.id as string,
          });
        } catch (emailErr) {
          console.error('[email] notification error:', emailErr);
        }
      })();
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
