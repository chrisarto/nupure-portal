export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendQrIssueCompletionEmail } from '@/lib/email';
import { generateQrIssueCompletionPdf, type QrIssuePdfRow } from '@/lib/nupure-pdf';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('nupure_qr_issues')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Required Action not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    const { data: existing, error: fetchErr } = await admin
      .from('nupure_qr_issues')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Required Action not found' }, { status: 404 });
    }

    const isCompleting = body.status === 'completed';
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, unknown> = {
      status: body.status || existing.status,
      assigned_to: body.assigned_to ?? existing.assigned_to,
      updated_at: nowIso,
    };

    if (isCompleting) {
      updatePayload.completed_by = body.completed_by || user.email || 'MJ Hygiene Team';
      updatePayload.completed_at = nowIso;
      updatePayload.resolution_notes = body.resolution_notes || 'Rectified, sanitised, and verified to specification.';
      updatePayload.completion_photos = Array.isArray(body.completion_photos)
        ? body.completion_photos
        : existing.completion_photos || [];
      updatePayload.signature_data = body.signature_data || null;
    }

    const { data: updated, error: updateErr } = await admin
      .from('nupure_qr_issues')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (isCompleting) {
      const { data: emailSetting } = await admin
        .from('nupure_email_settings')
        .select('recipients, send_on_submit')
        .eq('report_type', 'qr-issue-completion')
        .maybeSingle();

      const configuredEmails: string[] = Array.isArray(emailSetting?.recipients)
        ? (emailSetting.recipients as Array<{ email?: string } | string>)
            .map(r => (typeof r === 'string' ? r : r.email || ''))
            .filter(Boolean)
        : [];

      const extraEmails: string[] = Array.isArray(body.notify_emails)
        ? body.notify_emails
        : typeof body.notify_emails === 'string'
          ? body.notify_emails.split(/[,;\s]+/).filter(Boolean)
          : [];

      const allRecipients = [
        ...configuredEmails,
        ...extraEmails,
        ...(existing.reported_by_email ? [existing.reported_by_email] : []),
      ];

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nupure.tmservices.cloud';
      if (allRecipients.length > 0 && emailSetting?.send_on_submit !== false) {
        const pdfBuffer = generateQrIssueCompletionPdf(updated as QrIssuePdfRow);
        const emailRes = await sendQrIssueCompletionEmail(allRecipients, {
          actionNumber: updated.action_number,
          zone: updated.zone,
          area: updated.area,
          category: updated.category,
          priority: updated.priority,
          description: updated.description,
          reportedByName: updated.reported_by_name,
          reportedByEmail: updated.reported_by_email,
          createdAt: updated.created_at,
          completedBy: updated.completed_by,
          completedAt: updated.completed_at,
          resolutionNotes: updated.resolution_notes,
          reportUrl: `${siteUrl}/actions/${updated.id}/report`,
          pdfBuffer,
        });

        if (emailRes.success) {
          await admin
            .from('nupure_qr_issues')
            .update({ completion_report_sent: true })
            .eq('id', id);
          updated.completion_report_sent = true;
        }
      }
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('QR Issue PATCH error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
