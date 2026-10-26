'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import shared from '../../shared.module.css';
import styles from '../sop-capture.module.css';
import Link from 'next/link';
import Image from 'next/image';

interface SopFormClientProps {
  area: string;
  machine: string;
}

const ENERGY_OPTIONS = ['Electrical', 'Pneumatic', 'Hydraulic', 'Steam/Hot Water', 'Gravity', 'Springs', 'Pressure/Vacuum', 'Thermal', 'Mechanical'];
const RESP_OPTIONS = ['MJ Hygiene', 'Nu-Pure Production', 'Nu-Pure Maintenance', 'Shared', 'Other'];
const METHOD_OPTIONS = ['Dry clean', 'Vacuum', 'Scrape', 'Low-pressure wet clean', 'Foam', 'Manual scrub', 'COP/soak', 'High-pressure wash', 'Wipe/sanitise', 'Combination'];
const VERIFY_OPTIONS = ['Visual', 'ATP', 'Protein', 'Allergen', 'Microbiological', 'Other'];

export default function SopFormClient({ area, machine }: SopFormClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(1);

  const [f, setF] = useState({
    risk_area: '', component: '', is_food_contact: false, cleaning_responsibility: '',
    dismantle_required: false, who_dismantles: '', parts_removed: '', reassembly_by: '',
    isolation_required: false, energy_sources: [] as string[], isolation_point: '', lockout_required: false, who_applies_locks: '', try_test_method: '',
    cleaning_method_type: '', gross_soil_removal: '', pre_rinse: '', detergent_chemical: '', concentration: '', temperature: '', contact_time: '', mechanical_action: '', rinse_step: '', sanitiser: '', final_rinse: false, dry_drain: '',
    pre_op_criteria: '', verification_method: [] as string[], frequency: '',
    status: 'TO COMPLETE', photos: [] as string[]
  });

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/sop-capture?area=' + encodeURIComponent(area) + '&machine=' + encodeURIComponent(machine));
        if (!res.ok) throw new Error('Failed to load data');
        const json = await res.json();
        if (json.data) {
          setF(prev => ({ ...prev, ...json.data }));
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [area, machine]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/sop-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_room: area, machine_equipment: machine, ...f })
      });
      if (!res.ok) {
        const json = await res.json(); throw new Error(json.error || 'Failed to save');
      }
      alert('Saved successfully!');
      router.push('/sop-capture');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', e.target.files[0]);
      const res = await fetch('/api/sop-capture/upload', { method: 'POST', body: formDataUpload });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      setF(prev => ({ ...prev, photos: [...prev.photos, json.url] }));
    } catch (err: any) { alert(err.message); } finally { setUploading(false); }
  };

  const toggleArray = (key: 'energy_sources' | 'verification_method', val: string) => {
    setF(prev => ({
      ...prev,
      [key]: prev[key].includes(val) ? prev[key].filter(x => x !== val) : [...prev[key], val]
    }));
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <>
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <div style={{ marginBottom: '0.5rem' }}>
              <Link href="/sop-capture" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontSize: '0.875rem' }}>&larr; Back to Dashboard</Link>
            </div>
            <h1 className={shared.pageTitle}>{machine}</h1>
            <p className={shared.pageDescription}>{area}</p>
          </div>
          <div>
            <select className={styles.input} style={{ width: 'auto', fontWeight: 600, color: f.status === 'READY' ? 'var(--status-green-text)' : 'inherit' }} value={f.status} onChange={e => setF({...f, status: e.target.value})}>
              <option value="TO COMPLETE">TO COMPLETE</option>
              <option value="IN PROGRESS">IN PROGRESS</option>
              <option value="READY">READY</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {['1. Identity', '2. Dismantling', '3. LOTO', '4. Cleaning Sequence', '5. Verify & Photos'].map((t, i) => (
            <button key={i} type="button" onClick={() => setTab(i+1)} style={{ padding: '0.75rem 1rem', background: tab === i+1 ? 'var(--accent-primary)' : 'var(--bg-card)', color: tab === i+1 ? 'white' : 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: tab === i+1 ? 600 : 400 }}>
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && <div style={{ color: 'var(--status-red-text)', background: 'var(--status-red-bg)', padding: '1rem', borderRadius: '6px' }}>{error}</div>}

          <div className={shared.card} style={{ padding: '1.5rem', display: tab === 1 ? 'block' : 'none' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Identification & Responsibility</h3>
            <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
              <div><label className={styles.label}>Risk Area</label><input className={styles.input} value={f.risk_area} onChange={e => setF({...f, risk_area: e.target.value})} placeholder="e.g. High Risk" /></div>
              <div><label className={styles.label}>Line / Model / Component</label><input className={styles.input} value={f.component} onChange={e => setF({...f, component: e.target.value})} /></div>
              <div><label className={styles.label}>Cleaning Responsibility</label><select className={styles.input} value={f.cleaning_responsibility} onChange={e => setF({...f, cleaning_responsibility: e.target.value})}><option value="">Select...</option>{RESP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              <div style={{ display: 'flex', alignItems: 'center' }}><label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}><input type="checkbox" checked={f.is_food_contact} onChange={e => setF({...f, is_food_contact: e.target.checked})} style={{ width: '1.25rem', height: '1.25rem' }}/> Food Contact Surface?</label></div>
            </div>
          </div>

          <div className={shared.card} style={{ padding: '1.5rem', display: tab === 2 ? 'block' : 'none' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Dismantling & Reassembly</h3>
            <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, marginBottom: '1.5rem' }}><input type="checkbox" checked={f.dismantle_required} onChange={e => setF({...f, dismantle_required: e.target.checked})} style={{ width: '1.25rem', height: '1.25rem' }}/> Dismantling Required?</label>
            {f.dismantle_required && (
              <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
                <div><label className={styles.label}>Who Dismantles?</label><input className={styles.input} value={f.who_dismantles} onChange={e => setF({...f, who_dismantles: e.target.value})} placeholder="e.g. MJ Hygiene or Operators" /></div>
                <div><label className={styles.label}>Reassembly By?</label><input className={styles.input} value={f.reassembly_by} onChange={e => setF({...f, reassembly_by: e.target.value})} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className={styles.label}>Parts Removed / Cleaned Separately</label><textarea className={styles.input} rows={3} value={f.parts_removed} onChange={e => setF({...f, parts_removed: e.target.value})} /></div>
              </div>
            )}
          </div>

          <div className={shared.card} style={{ padding: '1.5rem', display: tab === 3 ? 'block' : 'none' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Isolation & LOTO</h3>
            <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, marginBottom: '1.5rem' }}><input type="checkbox" checked={f.isolation_required} onChange={e => setF({...f, isolation_required: e.target.checked})} style={{ width: '1.25rem', height: '1.25rem' }}/> Isolation Required?</label>
            {f.isolation_required && (
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div><label className={styles.label}>Energy Sources</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>{ENERGY_OPTIONS.map(o => (<label key={o} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.875rem' }}><input type="checkbox" checked={f.energy_sources.includes(o)} onChange={() => toggleArray('energy_sources', o)} /> {o}</label>))}</div></div>
                <div><label className={styles.label}>Isolation Point / Device / Location</label><input className={styles.input} value={f.isolation_point} onChange={e => setF({...f, isolation_point: e.target.value})} /></div>
                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
                  <div><label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, marginTop: '2rem' }}><input type="checkbox" checked={f.lockout_required} onChange={e => setF({...f, lockout_required: e.target.checked})} style={{ width: '1.25rem', height: '1.25rem' }}/> Lockout Required?</label></div>
                  {f.lockout_required && <div><label className={styles.label}>Who Applies Lock(s)?</label><input className={styles.input} value={f.who_applies_locks} onChange={e => setF({...f, who_applies_locks: e.target.value})} /></div>}
                </div>
                <div><label className={styles.label}>Zero Energy / Try-Test Method</label><textarea className={styles.input} rows={2} value={f.try_test_method} onChange={e => setF({...f, try_test_method: e.target.value})} placeholder="How do we verify it's dead?" /></div>
              </div>
            )}
          </div>

          <div className={shared.card} style={{ padding: '1.5rem', display: tab === 4 ? 'block' : 'none' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Cleaning Sequence</h3>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div><label className={styles.label}>Main Cleaning Method</label><select className={styles.input} value={f.cleaning_method_type} onChange={e => setF({...f, cleaning_method_type: e.target.value})}><option value="">Select...</option>{METHOD_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              <div><label className={styles.label}>1. Gross Soil Removal / Dry Prep</label><textarea className={styles.input} rows={2} value={f.gross_soil_removal} onChange={e => setF({...f, gross_soil_removal: e.target.value})} /></div>
              <div><label className={styles.label}>2. Pre-rinse</label><textarea className={styles.input} rows={2} value={f.pre_rinse} onChange={e => setF({...f, pre_rinse: e.target.value})} /></div>
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div style={{ gridColumn: '1 / -1' }}><label className={styles.label}>3. Detergent / Chemical</label><input className={styles.input} value={f.detergent_chemical} onChange={e => setF({...f, detergent_chemical: e.target.value})} /></div>
                <div><label className={styles.label}>Concentration</label><input className={styles.input} value={f.concentration} onChange={e => setF({...f, concentration: e.target.value})} placeholder="e.g. 2%" /></div>
                <div><label className={styles.label}>Temperature</label><input className={styles.input} value={f.temperature} onChange={e => setF({...f, temperature: e.target.value})} placeholder="e.g. 50-60C" /></div>
                <div><label className={styles.label}>Contact Time</label><input className={styles.input} value={f.contact_time} onChange={e => setF({...f, contact_time: e.target.value})} placeholder="e.g. 15 mins" /></div>
              </div>
              <div><label className={styles.label}>4. Mechanical Action / Tools</label><textarea className={styles.input} rows={2} value={f.mechanical_action} onChange={e => setF({...f, mechanical_action: e.target.value})} placeholder="e.g. Scrub with red brush" /></div>
              <div><label className={styles.label}>5. Rinse Step</label><textarea className={styles.input} rows={2} value={f.rinse_step} onChange={e => setF({...f, rinse_step: e.target.value})} /></div>
              <div><label className={styles.label}>6. Sanitiser</label><input className={styles.input} value={f.sanitiser} onChange={e => setF({...f, sanitiser: e.target.value})} /></div>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}><input type="checkbox" checked={f.final_rinse} onChange={e => setF({...f, final_rinse: e.target.checked})} style={{ width: '1.25rem', height: '1.25rem' }}/> Requires Final Rinse?</label>
                <div style={{ flex: 1 }}><label className={styles.label}>7. Dry / Drain Requirement</label><input className={styles.input} value={f.dry_drain} onChange={e => setF({...f, dry_drain: e.target.value})} /></div>
              </div>
            </div>
          </div>

          <div className={shared.card} style={{ padding: '1.5rem', display: tab === 5 ? 'block' : 'none' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Verification & Photos</h3>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div><label className={styles.label}>Pre-op Acceptance Criteria</label><textarea className={styles.input} rows={2} value={f.pre_op_criteria} onChange={e => setF({...f, pre_op_criteria: e.target.value})} placeholder="What does clean look like?" /></div>
              <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
                <div><label className={styles.label}>Verification Method</label><div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>{VERIFY_OPTIONS.map(o => (<label key={o} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.875rem' }}><input type="checkbox" checked={f.verification_method.includes(o)} onChange={() => toggleArray('verification_method', o)} /> {o}</label>))}</div></div>
                <div><label className={styles.label}>Frequency</label><input className={styles.input} value={f.frequency} onChange={e => setF({...f, frequency: e.target.value})} placeholder="e.g. Daily visual, Weekly ATP" /></div>
              </div>
              
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '1rem 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontWeight: 600, margin: 0 }}>Photos (Overview, Dismantled, LOTO)</h4>
                <label style={{ cursor: 'pointer', background: 'var(--accent-primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.875rem' }}>{uploading ? 'Uploading...' : 'Upload Photo'}<input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} disabled={uploading} /></label>
              </div>
              {f.photos.length === 0 ? (<div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No photos uploaded yet.</div>) : (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>{f.photos.map((photoUrl, i) => (<div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)' }}><Image src={photoUrl} alt="SOP Photo" fill style={{ objectFit: 'cover' }} unoptimized /><button type="button" onClick={() => setF({...f, photos: f.photos.filter((_, idx) => idx !== i)})} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button></div>))}</div>)}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className={shared.button} disabled={saving} style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>
              {saving ? 'Saving...' : 'Save All SOP Data'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
