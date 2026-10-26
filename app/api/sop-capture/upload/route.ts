import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Store in form-photos bucket under sop-capture directory
    const ext = file.name.split('.').pop();
    const uuid = crypto.randomUUID();
    const filename = `sop-capture/${uuid}.${ext}`;

    const { data, error } = await supabase.storage
      .from('form-photos')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('form-photos')
      .getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error('SOP Photo Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
