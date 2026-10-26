import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;
  const area = searchParams.get('area');
  const machine = searchParams.get('machine');

  let query = supabase.from('nupure_machine_mapping').select('*');
  
  if (area) query = query.eq('area_room', area);
  if (machine) query = query.eq('machine_equipment', machine);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ data: area && machine ? data[0] || null : data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('nupure_machine_mapping')
      .upsert({
        area_room: body.area_room,
        machine_equipment: body.machine_equipment,
        risk_area: body.risk_area || '',
        component: body.component || '',
        is_food_contact: body.is_food_contact ?? false,
        cleaning_responsibility: body.cleaning_responsibility || '',
        dismantle_required: body.dismantle_required ?? false,
        who_dismantles: body.who_dismantles || '',
        parts_removed: body.parts_removed || '',
        reassembly_by: body.reassembly_by || '',
        isolation_required: body.isolation_required ?? false,
        energy_sources: body.energy_sources || [],
        isolation_point: body.isolation_point || '',
        lockout_required: body.lockout_required ?? false,
        who_applies_locks: body.who_applies_locks || '',
        try_test_method: body.try_test_method || '',
        cleaning_method_type: body.cleaning_method_type || '',
        gross_soil_removal: body.gross_soil_removal || '',
        pre_rinse: body.pre_rinse || '',
        detergent_chemical: body.detergent_chemical || '',
        concentration: body.concentration || '',
        temperature: body.temperature || '',
        contact_time: body.contact_time || '',
        mechanical_action: body.mechanical_action || '',
        rinse_step: body.rinse_step || '',
        sanitiser: body.sanitiser || '',
        final_rinse: body.final_rinse ?? false,
        dry_drain: body.dry_drain || '',
        pre_op_criteria: body.pre_op_criteria || '',
        verification_method: body.verification_method || [],
        frequency: body.frequency || '',
        photos: body.photos ?? [],
        status: body.status || 'TO COMPLETE',
        created_by: user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'area_room,machine_equipment' })
      .select()
      .single();

    if (error) throw error;
    
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('SOP Capture POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
