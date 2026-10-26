import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `qr-issues/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

    const admin = createAdminClient();
    const { error } = await admin.storage
      .from('issue-photos')
      .upload(filename, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = admin.storage
      .from('issue-photos')
      .getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl, filename: file.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('QR issue photo upload error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
