import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import shared from '../shared.module.css';
import styles from './sop-capture.module.css';
import { CSVExportButton } from '@/app/components/ui/CSVExportButton';

export const dynamic = 'force-dynamic';

const EXCEL_MAPPING: Record<string, string[]> = {
  "Bulk Pack Off Room": [
    "Vacuum machines", "Dip tank", "Conveyors", "Tables / cutting boards", "Multivac", "Metal detector"
  ],
  "Clean Storage": [
    "Racking and trolleys", "Smoke sticks and hooks", "Dump truck washer", "Tins / 4x4 cage"
  ],
  "Cook Room (Raw)": [
    "Water cookers", "Cooking boards", "Cooking basket", "Hoist", "Smoke ovens", "Control panel covers", "Bench"
  ],
  "Cooking Area (High Risk)": [
    "KFT Peeler"
  ],
  "Cutting Room": [
    "Dicer", "Dicer conveyor / belt", "Dicer parts", "Compact small slicer"
  ],
  "Entry Area to High Risk Area": [
    "Boot wash machine"
  ],
  "Entry Area to Production": [
    "Boot wash machine"
  ],
  "Ham Production (Batching Area)": [
    "Pre-breaker", "Pre-breaker belt", "Metal detector", "Pallet lifter"
  ],
  "High Risk Wash Room": [
    "Tubwasher", "Tubs / buckets", "Dump trucks"
  ],
  "Holding Chiller": [
    "Delinker small", "Delinker", "Vemag sausage cutter"
  ],
  "Packing Room": [
    "Titan slicer", "Compact small slicer", "Clear weighing tubs", "Bacon paper holder", "Tables", "Cutting boards", "Knives / scrapers / scissors", "Knife and scissor holder", "Metal scale tops", "Multivac", "Variovac", "Scandivac Thermoformer", "Metal detector / checkweigher", "Metal detector", "Equipment storage trolleys", "Tub wheels & frame"
  ],
  "Production Areas": [
    "Tables", "Tubs", "Plastic bins", "Mincer", "Mincer plates", "Mincer knife", "Bowl cutter", "Bowl cutter parts", "Scales", "Mixer", "Emulsifier", "Filler", "Filler double screws", "Filler vacuum plug & cage", "Filler white plastic nozzles", "Filler assorted metal nozzles", "Filler horns & holders", "Filler spiral worms", "Linker", "Linker belts", "Metal nuts", "Linker connectors", "Linker belt protectors", "Linker casing pushers", "Linker pusher bearings", "Linker casing breaks", "Linker rubber seals", "Hanging machine", "Metal detector & parts", "Perspex screen", "Clippers", "Clipper", "Equipment trolleys", "Buckets", "Dump trucks", "Knives / scrapers / box cutters", "Knife holders", "Cheese cutter", "Ice machine / ice tank", "Grey crates", "Floor scales"
  ],
  "Raw Material Receival (& Ham Production)": [
    "Tumbler", "Ham netting equipment / stuffer machine", "Brine machine", "Brine mixer", "Brine tank", "Floor scale", "Lutecia"
  ],
  "Raw Wash Room": [
    "Racking and trolleys", "Chemical station"
  ],
  "Spice Room": [
    "Shelves / tubs", "Bucket / scoops", "Scales", "Table"
  ]
};

export default async function SopCaptureDashboard() {
  const supabase = await createClient();

  // Fetch all saved mapping captures for the dashboard and the CSV export
  const { data: captures } = await supabase.from('nupure_machine_mapping').select('*');
  
  const statusMap = new Map();
  (captures || []).forEach((c: any) => {
    statusMap.set(c.area_room + '||' + c.machine_equipment, c.status);
  });

  const sortedAreas = Object.keys(EXCEL_MAPPING).sort();

  return (
    <>
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Machine Mapping Capture</h1>
            <p className={shared.pageDescription}>Select a machine below to document its full cleaning sequence, LOTO, and verification procedures.</p>
          </div>
          <div>
            <CSVExportButton
              filename={`machine-mappings-${new Date().toISOString().split('T')[0]}.csv`}
              rows={(captures || []).map(c => ({
                Area: c.area_room,
                Machine: c.machine_equipment,
                Status: c.status,
                'Risk Area': c.risk_area,
                Component: c.component,
                'Food Contact': c.is_food_contact ? 'Yes' : 'No',
                'Cleaning Resp': c.cleaning_responsibility,
                'Dismantle Required': c.dismantle_required ? 'Yes' : 'No',
                'Who Dismantles': c.who_dismantles,
                'Parts Removed': c.parts_removed,
                'Reassembly By': c.reassembly_by,
                'Isolation Required': c.isolation_required ? 'Yes' : 'No',
                'Energy Sources': Array.isArray(c.energy_sources) ? c.energy_sources.join(', ') : '',
                'Isolation Point': c.isolation_point,
                'Lockout Required': c.lockout_required ? 'Yes' : 'No',
                'Who Applies Locks': c.who_applies_locks,
                'Try/Test Method': c.try_test_method,
                'Method Type': c.cleaning_method_type,
                '1. Gross Soil': c.gross_soil_removal,
                '2. Pre-rinse': c.pre_rinse,
                '3. Detergent': c.detergent_chemical,
                'Concentration': c.concentration,
                'Temperature': c.temperature,
                'Contact Time': c.contact_time,
                '4. Mechanical Action': c.mechanical_action,
                '5. Rinse Step': c.rinse_step,
                '6. Sanitiser': c.sanitiser,
                'Final Rinse Req': c.final_rinse ? 'Yes' : 'No',
                '7. Dry/Drain': c.dry_drain,
                'Pre-Op Criteria': c.pre_op_criteria,
                'Verification Method': Array.isArray(c.verification_method) ? c.verification_method.join(', ') : '',
                'Frequency': c.frequency,
                'Photos': Array.isArray(c.photos) ? c.photos.join(', ') : ''
              }))}
            />
          </div>
        </div>
      </div>

      <div className={shared.cardGrid}>
        {sortedAreas.map((area) => {
          const machines = EXCEL_MAPPING[area].sort();
          const readyCount = machines.filter(m => statusMap.get(area + '||' + m) === 'READY').length;
          const totalCount = machines.length;
          const isComplete = totalCount > 0 && readyCount === totalCount;

          return (
            <div key={area} className={shared.card}>
              <div className={isComplete ? shared.cardAccentGreen : shared.cardAccentBlue} />
              <div style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>{area}</h3>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-gray)', marginBottom: '1rem' }}>
                  {readyCount} / {totalCount} Machines Ready
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {machines.map(machine => {
                    const status = statusMap.get(area + '||' + machine) || 'TO COMPLETE';
                    let icon = '?';
                    let color = 'var(--text-light)';
                    if (status === 'READY') { icon = '?'; color = 'var(--status-green-text)'; }
                    else if (status === 'IN PROGRESS') { icon = '?'; color = 'var(--status-amber-text)'; }

                    return (
                      <Link 
                        href={'/sop-capture/form?area=' + encodeURIComponent(area) + '&machine=' + encodeURIComponent(machine)}
                        key={machine}
                        className={styles.machineLink}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '4px', background: 'var(--bg-light)', textDecoration: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color }}>{icon}</span>
                          <span style={{ color: 'var(--text-dark)', fontSize: '0.875rem' }}>{machine}</span>
                        </div>
                        <span style={{ color: 'var(--text-gray)', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 600 }}>{status}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
