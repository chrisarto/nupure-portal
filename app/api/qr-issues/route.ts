export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendQrIssueAlertEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const status = request.nextUrl.searchParams.get('status');

    let query = admin
      .from('nupure_qr_issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: data ?? [], count: (data ?? []).length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const zone: string = body.zone || 'General Site';
    const area: string = body.area || 'General Facility';
    const category: string = body.category || 'General Cleaning Required';
    const priority: string = body.priority || 'Medium';
    const description: string = (body.description || '').trim();

    if (!description) {
      return NextResponse.json({ error: 'Please provide a brief description of the cleaning issue.' }, { status: 400 });
    }

    const dateCompact = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const actionNumber = `ACT-${dateCompact}-${Math.floor(100 + Math.random() * 900)}`;

    const admin = createAdminClient();
    const { data: issue, error } = await admin
      .from('nupure_qr_issues')
      .insert({
        action_number: actionNumber,
        zone,
        area,
        category,
        priority,
        description,
        reported_by_name: body.reported_by_name || 'Site QR Scan',
        reported_by_email: body.reported_by_email || '',
        reported_by_phone: body.reported_by_phone || '',
        issue_photos: Array.isArray(body.issue_photos) ? body.issue_photos : [],
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check email settings for qr-issue-alert
    const { data: emailSetting } = await admin
      .from('nupure_email_settings')
      .select('recipients, send_on_submit')
      .eq('report_type', 'qr-issue-alert')
      .maybeSingle();

    const recipients: string[] = Array.isArray(emailSetting?.recipients)
      ? (emailSetting.recipients as Array<{ email?: string } | string>)
          .map(r => (typeof r === 'string' ? r : r.email || ''))
          .filter(Boolean)
      : [];

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nupure.tmservices.cloud';
    if (recipients.length > 0 && emailSetting?.send_on_submit !== false) {
      await sendQrIssueAlertEmail(recipients, {
        actionNumber,
        zone,
        area,
        category,
        priority,
        description,
        reportedByName: body.reported_by_name,
        reportedByEmail: body.reported_by_email,
        reportedByPhone: body.reported_by_phone,
        createdAt: issue.created_at,
        reportUrl: `${siteUrl}/actions`,
      });
    }

    return NextResponse.json({ data: issue }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('QR Issue POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
