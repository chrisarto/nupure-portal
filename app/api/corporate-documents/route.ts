export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_CATEGORIES = [
  'ISO Certificates',
  'PPE',
  'Lockout/Tagout',
  'HR Policies',
  'WHS / Safety',
  'Environmental',
  'Quality',
  'General',
];

interface CorporateDocument {
  id: string;
  title: string;
  category: string;
  description: string | null;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  file_type: string | null;
  version: number;
  uploaded_by: string | null;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');

    const supabase = await createClient();
    let query = supabase
      .from('nupure_corporate_documents')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('title', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Corporate Documents API error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data as CorporateDocument[],
      count: (data ?? []).length,
      categories: VALID_CATEGORIES,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const description = formData.get('description') as string | null;
    const expiryDate = formData.get('expiry_date') as string | null;

    if (!file || !title || !category) {
      return NextResponse.json(
        { error: 'file, title, and category are required' },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Upload file to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `corporate/${category.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError.message);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Insert metadata row
    const { data: doc, error: insertError } = await supabase
      .from('nupure_corporate_documents')
      .insert({
        title,
        category,
        description: description || null,
        file_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.email,
        expiry_date: expiryDate || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('DB insert error:', insertError.message);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Corporate Documents POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
