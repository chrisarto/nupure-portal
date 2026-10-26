export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDailyCompletionPdf, type CleaningRecordPdfRow } from '@/lib/nupure-pdf';
import { sendDailyCompletionReportEmail } from '@/lib/email';
import { NUPURE_ROOMS } from '@/lib/nupure-scope';

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const { searchParams } = request.nextUrl;
    const dateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const inline = searchParams.get('inline') === '1';

    const { data, error } = await admin
      .from('nupure_cleaning_records')
      .select('*')
      .eq('date', dateParam)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const records = (data ?? []) as CleaningRecordPdfRow[];
    const pdfBuffer = generateDailyCompletionPdf(dateParam, records);
    const filename = `Nu-Pure-Daily-Completion-Report-${dateParam}.pdf`;

    // Persist a copy in Supabase Storage (documents bucket)
    try {
      await admin.storage
        .from('documents')
        .upload(`daily-completion/${filename}`, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });
    } catch {
      // Non-fatal if storage upload fails
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[daily-pdf GET] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const body = await request.json();
    const dateStr: string = body.date || new Date().toISOString().slice(0, 10);
    const extraEmails: string[] =
      typeof body.recipients === 'string'
        ? body.recipients.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(body.recipients)
          ? body.recipients
          : [];

    const { data, error } = await admin
      .from('nupure_cleaning_records')
      .select('*')
      .eq('date', dateStr)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const records = (data ?? []) as CleaningRecordPdfRow[];
    const pdfBuffer = generateDailyCompletionPdf(dateStr, records);
    const filename = `Nu-Pure-Daily-Completion-Report-${dateStr}.pdf`;

    await admin.storage
      .from('documents')
      .upload(`daily-completion/${filename}`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    // Also pull configured recipients from nupure_email_settings
    const { data: emailSetting } = await admin
      .from('nupure_email_settings')
      .select('recipients')
      .eq('template_slug', 'cleaning-report')
      .maybeSingle();

    const settingEmails: string[] = Array.isArray(emailSetting?.recipients)
      ? emailSetting.recipients.map((r: { email?: string } | string) =>
          typeof r === 'string' ? r : r.email || ''
        )
      : [];

    const allRecipients = [...new Set([...extraEmails, ...settingEmails].filter(Boolean))];
    if (allRecipients.length === 0) {
      return NextResponse.json(
        { error: 'Please provide at least one recipient email address.' },
        { status: 400 }
      );
    }

    const d = new Date(`${dateStr}T00:00:00`);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const scheduledCount = NUPURE_ROOMS.filter(
      r => r.frequencyBadge === '7 DAYS' || (r.frequencyBadge === '5 DAYS' && !isWeekend)
    ).length;
    const completedUnique = new Set(records.map(r => r.location)).size;
    const totalMinutes = records.reduce((s, r) => s + (Number(r.total_time_minutes) || 0), 0);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nupure.tmservices.cloud';

    const emailResult = await sendDailyCompletionReportEmail(allRecipients, {
      date: dateStr,
      completedRoomsCount: completedUnique,
      scheduledRoomsCount: scheduledCount,
      totalMinutes,
      reportUrl: `${siteUrl}/sanitation/reports?date=${dateStr}`,
      pdfUrl: `${siteUrl}/api/cleaning-records/daily-pdf?date=${dateStr}`,
      pdfBuffer,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recipients: allRecipients,
      filename,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[daily-pdf POST] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
