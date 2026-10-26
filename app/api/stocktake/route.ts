export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendStocktakeOrderEmail } from '@/lib/email';

export async function GET() {
  try {
    const supabase = await createClient();
    const [{ data: items, error: itemsErr }, { data: logs, error: logsErr }, { data: emailSetting }] =
      await Promise.all([
        supabase
          .from('nupure_stocktake_items')
          .select('*')
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('item_name', { ascending: true }),
        supabase
          .from('nupure_stocktake_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('nupure_email_settings')
          .select('recipients')
          .eq('report_type', 'stocktake-order')
          .maybeSingle(),
      ]);

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    if (logsErr) return NextResponse.json({ error: logsErr.message }, { status: 500 });

    const defaultRecipients: string[] = Array.isArray(emailSetting?.recipients)
      ? (emailSetting.recipients as Array<{ email?: string } | string>)
          .map(r => (typeof r === 'string' ? r : r.email || ''))
          .filter(Boolean)
      : [];

    return NextResponse.json({
      items: items ?? [],
      logs: logs ?? [],
      defaultRecipients,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const admin = createAdminClient();

    if (body.action === 'add_item') {
      const { data: item, error } = await admin
        .from('nupure_stocktake_items')
        .insert({
          category: body.category || 'General Consumables',
          item_name: body.item_name,
          product_code: body.product_code || '',
          unit: body.unit || 'Carton',
          par_level: Number(body.par_level) || 10,
          current_stock: Number(body.current_stock) || 0,
          sort_order: 99,
          active: true,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: item }, { status: 201 });
    }

    // Submit Stocktake Check & Consumable Order
    const stocktakeDate: string = body.stocktake_date || new Date().toISOString().slice(0, 10);
    const conductedBy: string = body.conducted_by || user.email || 'MJ Hygiene Supervisor';
    const urgency: string = body.urgency || 'Standard Weekly Order';
    const notes: string = body.notes || '';
    const items: Array<{
      id: string;
      category: string;
      item_name: string;
      product_code?: string;
      unit: string;
      par_level: number;
      current_stock: number;
      order_qty: number;
    }> = Array.isArray(body.items) ? body.items : [];

    // Update current_stock and par_level on each item in nupure_stocktake_items
    for (const item of items) {
      if (item.id) {
        await admin
          .from('nupure_stocktake_items')
          .update({
            par_level: Number(item.par_level) || 0,
            current_stock: Number(item.current_stock) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
      }
    }

    // Gather recipient emails (from request + nupure_email_settings for stocktake-order)
    const inputEmails: string[] = Array.isArray(body.recipient_emails)
      ? body.recipient_emails
      : typeof body.recipient_emails === 'string'
        ? body.recipient_emails.split(/[,;\s]+/).filter(Boolean)
        : [];

    const { data: emailSetting } = await admin
      .from('nupure_email_settings')
      .select('recipients, send_on_submit')
      .eq('report_type', 'stocktake-order')
      .maybeSingle();

    const configuredEmails: string[] = Array.isArray(emailSetting?.recipients)
      ? (emailSetting.recipients as Array<{ email?: string } | string>)
          .map(r => (typeof r === 'string' ? r : r.email || ''))
          .filter(Boolean)
      : [];

    const allRecipients = [...new Set([...inputEmails, ...configuredEmails].map(e => e.trim()).filter(Boolean))];
    const orderNumber = `NPO-${stocktakeDate.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const totalOrdered = items.filter(i => Number(i.order_qty) > 0).length;

    const { data: log, error: logErr } = await admin
      .from('nupure_stocktake_logs')
      .insert({
        order_number: orderNumber,
        stocktake_date: stocktakeDate,
        conducted_by: conductedBy,
        urgency,
        recipient_emails: allRecipients,
        notes,
        items,
        total_items_ordered: totalOrdered,
        email_sent: false,
      })
      .select()
      .single();

    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nupure.tmservices.cloud';
    const reportUrl = `${siteUrl}/stocktake/${log.id}`;

    let emailSent = false;
    if (allRecipients.length > 0 && emailSetting?.send_on_submit !== false) {
      const emailRes = await sendStocktakeOrderEmail(allRecipients, {
        orderNumber,
        stocktakeDate,
        conductedBy,
        urgency,
        notes,
        items,
        reportUrl,
      });
      emailSent = emailRes.success;
      if (emailSent) {
        await admin
          .from('nupure_stocktake_logs')
          .update({ email_sent: true, email_sent_at: new Date().toISOString() })
          .eq('id', log.id);
      }
    }

    return NextResponse.json(
      {
        data: { ...log, email_sent: emailSent },
        recipientsNotified: allRecipients,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Stocktake POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
