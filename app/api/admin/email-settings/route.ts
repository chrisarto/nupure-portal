import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await serviceClient()
    .from('nupure_email_settings')
    .select('*')
    .order('report_label');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const { report_type, report_label, recipients, send_on_submit, send_on_fail_only, fail_threshold } = body as {
    report_type: string;
    report_label: string;
    recipients: Array<{ name: string; email: string }>;
    send_on_submit?: boolean;
    send_on_fail_only?: boolean;
    fail_threshold?: number;
  };

  if (!report_type || !Array.isArray(recipients)) {
    return NextResponse.json({ error: 'report_type and recipients required' }, { status: 400 });
  }
  if (recipients.length > 15) {
    return NextResponse.json({ error: 'Maximum 15 recipients per list' }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from('nupure_email_settings')
    .upsert({
      report_type,
      report_label: report_label ?? report_type,
      recipients,
      send_on_submit: send_on_submit ?? true,
      send_on_fail_only: send_on_fail_only ?? false,
      fail_threshold: fail_threshold ?? 85,
      updated_at: new Date().toISOString(),
      updated_by: user.email,
    }, { onConflict: 'report_type' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
