import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let buffer: Buffer;
    let rawMime = 'image/jpeg';
    let originalName = 'photo.jpg';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { dataUrl?: string; filename?: string };
      if (!body.dataUrl || !body.dataUrl.startsWith('data:')) {
        return NextResponse.json({ error: 'Invalid dataUrl provided' }, { status: 400 });
      }
      const parts = body.dataUrl.split(',');
      const mimeMatch = parts[0]?.match(/:(.*?);/);
      if (mimeMatch?.[1]) rawMime = mimeMatch[1];
      buffer = Buffer.from(parts[1] || '', 'base64');
      originalName = body.filename || 'photo.jpg';
    } else {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      rawMime = file.type || 'image/jpeg';
      originalName = file.name || 'photo.jpg';
    }

    const ext = (originalName.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const mimeType = rawMime && rawMime.startsWith('image/') ? rawMime : 'image/jpeg';
    const filename = `qr-issues/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

    const admin = createAdminClient();
    const { error } = await admin.storage
      .from('issue-photos')
      .upload(filename, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = admin.storage
      .from('issue-photos')
      .getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl, filename: originalName });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('QR issue photo upload error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
