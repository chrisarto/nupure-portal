'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  NUPURE_SANITARY_BINS,
  NUPURE_AIR_FRESHENERS,
} from '@/lib/nupure-scope';

interface SanitaryUnitState {
  serviced: boolean;
  linerChanged: boolean;
  unitSanitised: boolean;
  wasteCollected: boolean;
  binExchanged: boolean;
}

interface AirFreshenerUnitState {
  serviced: boolean;
  refillChanged: boolean;
  batteriesChanged: boolean;
  operationChecked: boolean;
  exteriorCleaned: boolean;
  unitReplaced: boolean;
}

interface HygieneLogRecord {
  id: string;
  report_number: string;
  date: string;
  zone: string;
  location: string;
  items_cleaned: string;
  total_time_minutes: number;
  submitted_by: string;
  supervisor_signoff: string;
  created_at: string;
}

export default function HygieneServicesPage() {
  const [activeTab, setActiveTab] = useState<'sanitary' | 'airfresheners'>('sanitary');
  const [serviceDate, setServiceDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [technicianName, setTechnicianName] = useState<string>('MJ Hygiene Specialist Team');
  const [supervisorName, setSupervisorName] = useState<string>('MJ Hygiene Supervisor');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string; reportId?: string } | null>(null);

  // Sanitary Bins State (SB-01 to SB-10)
  const [sanitaryState, setSanitaryState] = useState<Record<string, SanitaryUnitState>>(() => {
    const init: Record<string, SanitaryUnitState> = {};
    for (const b of NUPURE_SANITARY_BINS) {
      init[b.id] = {
        serviced: true,
        linerChanged: true,
        unitSanitised: true,
        wasteCollected: true,
        binExchanged: false,
      };
    }
    return init;
  });

  // Air Fresheners State (AF-01 to AF-09)
  const [afState, setAfState] = useState<Record<string, AirFreshenerUnitState>>(() => {
    const init: Record<string, AirFreshenerUnitState> = {};
    for (const a of NUPURE_AIR_FRESHENERS) {
      init[a.id] = {
        serviced: true,
        refillChanged: true,
        batteriesChanged: false,
        operationChecked: true,
        exteriorCleaned: true,
        unitReplaced: false,
      };
    }
    return init;
  });

  const [historyRecords, setHistoryRecords] = useState<HygieneLogRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/cleaning-records');
      const json = await res.json();
      const all: HygieneLogRecord[] = json.data ?? [];
      const filtered = all.filter(
        r =>
          r.location.toLowerCase().includes('sanitary') ||
          r.location.toLowerCase().includes('air freshener') ||
          r.zone.toLowerCase().includes('hygiene services')
      );
      setHistoryRecords(filtered);
    } catch {
      setHistoryRecords([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const updateSanitaryUnit = (id: string, patch: Partial<SanitaryUnitState>) => {
    setSanitaryState(prev => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const updateAfUnit = (id: string, patch: Partial<AirFreshenerUnitState>) => {
    setAfState(prev => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const handleSubmitSanitaryBins = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const checklistItems = NUPURE_SANITARY_BINS.map(bin => {
        const st = sanitaryState[bin.id];
        const actions: string[] = [];
        if (st.linerChanged) actions.push('Liner Changed');
        if (st.unitSanitised) actions.push('Unit Sanitised');
        if (st.wasteCollected) actions.push('Waste Collected & Transported');
        if (st.binExchanged) actions.push('Full Bin Unit Exchanged');
        return {
          label: `${bin.code} — ${bin.location} (${bin.binNumber}): ${actions.length > 0 ? actions.join(', ') : 'Inspected'}`,
          completed: st.serviced,
        };
      });

      const servicedCount = checklistItems.filter(i => i.completed).length;
      const res = await fetch('/api/cleaning-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: serviceDate,
          zone: 'Hygiene Services & Consumables',
          location: 'Sanitary Waste Management (8–10 Bins)',
          frequency_badge: 'WEEKLY',
          checklist_items: checklistItems,
          items_cleaned: `Serviced ${servicedCount}/${NUPURE_SANITARY_BINS.length} Sanitary Waste Units (Liners replaced, units sanitised, weekly waste collection & off-site disposal)`,
          total_time_minutes: 30,
          shift_type: 'Weekly Managed Sanitary Service',
          cleaning_type: 'Sanitary Bin Liner Exchange & Waste Collection',
          chemicals_used: ['Hospital-Grade Disinfectant / Surface Sanitiser', 'Odour Neutraliser / Enzyme Bio-Cleaner'],
          operators_involved: [technicianName],
          ssop_verified: true,
          visual_inspection_passed: true,
          comments: notes || `All ${servicedCount} allocated sanitary bins serviced, relined, and disinfected by MJ Hygiene external hygiene team.`,
          submitted_by: technicianName,
          supervisor_signoff: supervisorName,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save Sanitary Bin service log');

      await loadHistory();
      setToast({
        type: 'success',
        text: `Sanitary Bin Service & Liner Changes (${servicedCount}/10 bins) logged (${json.data.report_number}) & added to Daily Completion Report PDF!`,
        reportId: json.data.id,
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error saving Sanitary Bin service log',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAirFresheners = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const checklistItems = NUPURE_AIR_FRESHENERS.map(af => {
        const st = afState[af.id];
        const actions: string[] = [];
        if (st.refillChanged) actions.push('Fragrance Refill Changed');
        if (st.batteriesChanged) actions.push('Batteries Replaced');
        if (st.operationChecked) actions.push('Operation Checked');
        if (st.exteriorCleaned) actions.push('Exterior Cleaned');
        if (st.unitReplaced) actions.push('Failed Dispenser Replaced');
        return {
          label: `${af.code} — ${af.location} (${af.dispenserName}): ${actions.length > 0 ? actions.join(', ') : 'Checked'}`,
          completed: st.serviced,
        };
      });

      const servicedCount = checklistItems.filter(i => i.completed).length;
      const refillsCount = Object.values(afState).filter(s => s.serviced && s.refillChanged).length;
      const batteriesCount = Object.values(afState).filter(s => s.serviced && s.batteriesChanged).length;

      const res = await fetch('/api/cleaning-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: serviceDate,
          zone: 'Hygiene Services & Consumables',
          location: 'Automatic Air Freshener Units (9 Dispensers)',
          frequency_badge: 'WEEKLY',
          checklist_items: checklistItems,
          items_cleaned: `Serviced ${servicedCount}/9 Auto Air Fresheners (${refillsCount} fragrance refills changed, ${batteriesCount} battery sets replaced, exterior cleaned)`,
          total_time_minutes: 25,
          shift_type: 'Managed Air Freshener Service',
          cleaning_type: 'Automatic Air Freshener Refill & Battery Change',
          chemicals_used: ['Hospital-Grade Disinfectant / Surface Sanitiser'],
          operators_involved: [technicianName],
          ssop_verified: true,
          visual_inspection_passed: true,
          comments:
            notes ||
            `Serviced ${servicedCount}/9 automatic air freshener dispensers (${refillsCount} refills changed, ${batteriesCount} battery sets changed).`,
          submitted_by: technicianName,
          supervisor_signoff: supervisorName,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save Air Freshener service log');

      await loadHistory();
      setToast({
        type: 'success',
        text: `Air Freshener Changes (${servicedCount}/9 dispensers, ${refillsCount} refills) logged (${json.data.report_number}) & added to Daily Completion Report PDF!`,
        reportId: json.data.id,
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error saving Air Freshener service log',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#16a34a',
            }}
          >
            Nu-Pure Beverages — Section 10 Hygiene Services Register
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: '4px 0 6px' }}>
            Sanitary Bin &amp; Automatic Air Freshener Change Log
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Record weekly sanitary bin liner changes/collections (8–10 allocated units) and automatic air freshener fragrance refills, battery changes &amp; checks (9 allocated dispensers).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <a
            href={`/api/cleaning-records/daily-pdf?date=${encodeURIComponent(serviceDate)}`}
            style={{
              background: '#0f3460',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ⬇ Daily Completion PDF ({serviceDate})
          </a>
          <Link
            href="/sanitation"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            View Master Scope →
          </Link>
        </div>
      </div>

      {/* Mode Switch Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('sanitary');
            setToast(null);
          }}
          style={{
            flex: '1 1 320px',
            padding: '18px 22px',
            borderRadius: 12,
            border: activeTab === 'sanitary' ? '2px solid #0f3460' : '1px solid #cbd5e1',
            background: activeTab === 'sanitary' ? '#0f3460' : '#ffffff',
            color: activeTab === 'sanitary' ? '#ffffff' : '#0f172a',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: activeTab === 'sanitary' ? '#bae6fd' : '#0284c7',
            }}
          >
            Weekly Managed Sanitary Service
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
            ♻️ Sanitary Waste Bins (10 Allocated Units: SB-01 to SB-10)
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: activeTab === 'sanitary' ? '#e2e8f0' : '#64748b',
              marginTop: 4,
            }}
          >
            Head Office Female &amp; Accessible, Production Female, Warehouse Unisex &amp; Accessible, Mezzanine Female, Drivers&apos; Toilet
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('airfresheners');
            setToast(null);
          }}
          style={{
            flex: '1 1 320px',
            padding: '18px 22px',
            borderRadius: 12,
            border: activeTab === 'airfresheners' ? '2px solid #0284c7' : '1px solid #cbd5e1',
            background: activeTab === 'airfresheners' ? '#0284c7' : '#ffffff',
            color: activeTab === 'airfresheners' ? '#ffffff' : '#0f172a',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: activeTab === 'airfresheners' ? '#e0f2fe' : '#16a34a',
            }}
          >
            Managed Amenities Air Care
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
            🌬️ Automatic Air Fresheners (9 Dispensers: AF-01 to AF-09)
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: activeTab === 'airfresheners' ? '#f0f9ff' : '#64748b',
              marginTop: 4,
            }}
          >
            Record fragrance refill changes, AA battery replacements, spray checks, exterior cleaning &amp; unit replacements
          </div>
        </button>
      </div>

      {/* Toast Feedback */}
      {toast && (
        <div
          style={{
            background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: toast.type === 'success' ? '#15803d' : '#dc2626',
            padding: '14px 18px',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span>{toast.text}</span>
          {toast.reportId && (
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={`/api/cleaning-records/${toast.reportId}/pdf`}
                style={{
                  background: '#0f3460',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ⬇ Service PDF
              </a>
              <a
                href={`/api/cleaning-records/daily-pdf?date=${encodeURIComponent(serviceDate)}`}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ⬇ Daily Completion PDF
              </a>
            </div>
          )}
        </div>
      )}

      {/* Common Meta Controls */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            Service Date
          </label>
          <input
            type="date"
            value={serviceDate}
            onChange={e => setServiceDate(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            Hygiene Technician / Staff Member
          </label>
          <input
            type="text"
            value={technicianName}
            onChange={e => setTechnicianName(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            Supervisor Verification Sign-Off
          </label>
          <input
            type="text"
            value={supervisorName}
            onChange={e => setSupervisorName(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            Service Notes / Fragrance / Batch Details
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes (e.g. Citrus refills installed)..."
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
          />
        </div>
      </div>

      {/* TAB 1: SANITARY BIN CHANGES */}
      {activeTab === 'sanitary' ? (
        <form
          onSubmit={handleSubmitSanitaryBins}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              padding: '16px 22px',
              background: '#0f3460',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Sanitary Bin Liner Exchange, Sanitisation &amp; Collection Matrix (SB-01 to SB-10)
              </h2>
              <div style={{ fontSize: 12.5, color: '#bae6fd', marginTop: 2 }}>
                Tick the actions completed for each allocated sanitary unit across the 7 facility toilet locations.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const next: Record<string, SanitaryUnitState> = {};
                for (const b of NUPURE_SANITARY_BINS) {
                  next[b.id] = {
                    serviced: true,
                    linerChanged: true,
                    unitSanitised: true,
                    wasteCollected: true,
                    binExchanged: false,
                  };
                }
                setSanitaryState(next);
              }}
              style={{
                background: 'rgba(255,255,255,0.18)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.35)',
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ✓ Tick All 10 Sanitary Units
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px' }}>Serviced</th>
                <th style={{ padding: '12px 16px' }}>Unit Code</th>
                <th style={{ padding: '12px 16px' }}>Facility Zone &amp; Amenity Location</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Liner Changed</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Unit Sanitised</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Waste Collected</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Bin Exchanged</th>
              </tr>
            </thead>
            <tbody>
              {NUPURE_SANITARY_BINS.map(bin => {
                const st = sanitaryState[bin.id];
                return (
                  <tr
                    key={bin.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: st.serviced ? '#f0fdf4' : '#ffffff',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <input
                        type="checkbox"
                        checked={st.serviced}
                        onChange={e => updateSanitaryUnit(bin.id, { serviced: e.target.checked })}
                        style={{ width: 18, height: 18, accentColor: '#16a34a' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 900, color: '#0f3460' }}>{bin.code}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{bin.location}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {bin.zone} &bull; {bin.binNumber}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={st.linerChanged}
                        onChange={e => updateSanitaryUnit(bin.id, { linerChanged: e.target.checked })}
                        style={{ width: 17, height: 17, accentColor: '#0284c7' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={st.unitSanitised}
                        onChange={e => updateSanitaryUnit(bin.id, { unitSanitised: e.target.checked })}
                        style={{ width: 17, height: 17, accentColor: '#0284c7' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={st.wasteCollected}
                        onChange={e => updateSanitaryUnit(bin.id, { wasteCollected: e.target.checked })}
                        style={{ width: 17, height: 17, accentColor: '#0284c7' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={st.binExchanged}
                        onChange={e => updateSanitaryUnit(bin.id, { binExchanged: e.target.checked })}
                        style={{ width: 17, height: 17, accentColor: '#0284c7' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            style={{
              padding: '18px 22px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                padding: '13px 28px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 800,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting
                ? 'Recording Sanitary Bin Service...'
                : '✓ Record Sanitary Bin Changes & Update Daily Completion PDF →'}
            </button>
          </div>
        </form>
      ) : (
        /* TAB 2: AUTOMATIC AIR FRESHENER CHANGES */
        <form
          onSubmit={handleSubmitAirFresheners}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              padding: '16px 22px',
              background: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Automatic Air Freshener Refill, Battery &amp; Operation Log (AF-01 to AF-09)
              </h2>
              <div style={{ fontSize: 12.5, color: '#e0f2fe', marginTop: 2 }}>
                Tick fragrance refill changes, AA battery replacements, spray checks, and exterior cleaning across all 9 dispensers.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, AirFreshenerUnitState> = {};
                  for (const a of NUPURE_AIR_FRESHENERS) {
                    next[a.id] = {
                      serviced: true,
                      refillChanged: true,
                      batteriesChanged: true,
                      operationChecked: true,
                      exteriorCleaned: true,
                      unitReplaced: false,
                    };
                  }
                  setAfState(next);
                }}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.4)',
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✓ Mark All Refills &amp; Batteries Changed
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px' }}>Serviced</th>
                <th style={{ padding: '12px 16px' }}>Dispenser</th>
                <th style={{ padding: '12px 16px' }}>Facility Zone &amp; Amenity Location</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Fragrance Refill Changed</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Batteries Changed</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Operation Checked</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Exterior Cleaned</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Unit Replaced</th>
              </tr>
            </thead>
            <tbody>
              {NUPURE_AIR_FRESHENERS.map(af => {
                const st = afState[af.id];
                return (
                  <tr
                    key={af.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: st.serviced ? '#f0f9ff' : '#ffffff',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <input
                        type="checkbox"
                        checked={st.serviced}
                        onChange={e => updateAfUnit(af.id, { serviced: e.target.checked })}
                        style={{ width: 18, height: 18, accentColor: '#0284c7' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 900, color: '#0284c7' }}>{af.code}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{af.location}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {af.zone} &bull; {af.dispenserName}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={st.refillChanged}
                        onChange={e => updateAfUnit(af.id, { refillChanged: e.target.checked })}
                        style={{ width: 17, height: 17, accentColor: '#16a34a' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={st.batteriesChanged}
                        onChange={e => updateAfUnit(af.id, { batteriesChanged: e.target.checked })}
                        style={{ width: 17, height: 17, accentColor: '#16a34a' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={st.operationChecked}
                        onChange={e => updateAfUnit(af.id, { operationChecked: e.target.checked })}
                        style={{ width: 17, height: 17, accentColor: '#0284c7' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={st.exteriorCleaned}
                        onChange={e => updateAfUnit(af.id, { exteriorCleaned: e.target.checked })}
                        style={{ width: 17, height: 17, accentColor: '#0284c7' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={st.unitReplaced}
                        onChange={e => updateAfUnit(af.id, { unitReplaced: e.target.checked })}
                        style={{ width: 17, height: 17, accentColor: '#d97706' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            style={{
              padding: '18px 22px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '13px 28px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 800,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting
                ? 'Recording Air Freshener Changes...'
                : '✓ Record Air Freshener Refills / Battery Changes & Update Daily PDF →'}
            </button>
          </div>
        </form>
      )}

      {/* Logged Sanitary Bin & Air Freshener History */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#0f3460' }}>
            Recent Sanitary Bin &amp; Air Freshener Change Logs ({historyRecords.length})
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 16px' }}>Report Ref</th>
              <th style={{ padding: '10px 16px' }}>Date</th>
              <th style={{ padding: '10px 16px' }}>Service Type</th>
              <th style={{ padding: '10px 16px' }}>Summary</th>
              <th style={{ padding: '10px 16px' }}>Technician</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingHistory ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                  Loading hygiene service history...
                </td>
              </tr>
            ) : historyRecords.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                  No Sanitary Bin or Air Freshener change logs recorded yet. Use the form above to record a service.
                </td>
              </tr>
            ) : (
              historyRecords.map(rec => (
                <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f3460' }}>{rec.report_number}</td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{rec.date}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7' }}>{rec.location}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{rec.items_cleaned}</td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{rec.submitted_by}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                      <a
                        href={`/api/cleaning-records/${rec.id}/pdf`}
                        style={{
                          background: '#0f3460',
                          color: '#ffffff',
                          padding: '5px 10px',
                          borderRadius: 6,
                          textDecoration: 'none',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        ⬇ PDF
                      </a>
                      <Link
                        href={`/reports/cleaning-events/${rec.id}`}
                        style={{
                          color: '#0284c7',
                          fontWeight: 700,
                          textDecoration: 'none',
                          fontSize: 13,
                        }}
                      >
                        View →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
