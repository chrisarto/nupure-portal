export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQrIssueCompletionPdf, type QrIssuePdfRow } from '@/lib/nupure-pdf';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const inline = request.nextUrl.searchParams.get('inline') === '1';
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('nupure_qr_issues')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'QR Issue not found' }, { status: 404 });
    }

    const issue = data as QrIssuePdfRow;
    const pdfBuffer = generateQrIssueCompletionPdf(issue);
    const filename = `${issue.action_number || 'Action'}-Completion-Report.pdf`;

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
