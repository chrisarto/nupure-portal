'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { NUPURE_ROOMS } from '@/lib/nupure-scope';

const ISSUE_CATEGORIES = [
  'Consumables Empty (Toilet Paper / Hand Towel / Soap)',
  'Spill / Urgent Clean Required',
  'Amenities / Bathroom Hygiene Issue',
  'Bins Full / Waste Collection Needed',
  'Lunchroom / Kitchenette Cleanliness',
  'Floor / Surface Cleanliness',
  'Sanitary Unit / Air Freshener Service',
  'Other Cleaning Request',
];

function ReportIssueForm() {
  const searchParams = useSearchParams();
  const initialArea = searchParams.get('area') || '';
  const initialZone = searchParams.get('zone') || '';

  const matchedRoom =
    NUPURE_ROOMS.find(r => r.room.toLowerCase() === initialArea.toLowerCase()) || null;

  const [selectedRoomName, setSelectedRoomName] = useState<string>(
    matchedRoom ? matchedRoom.room : initialArea || NUPURE_ROOMS[0].room
  );
  const [selectedZone, setSelectedZone] = useState<string>(
    matchedRoom ? matchedRoom.zone : initialZone || NUPURE_ROOMS[0].zone
  );
  const [category, setCategory] = useState<string>(ISSUE_CATEGORIES[0]);
  const [priority, setPriority] = useState<string>('Medium');
  const [description, setDescription] = useState<string>('');
  const [reporterName, setReporterName] = useState<string>('');
  const [reporterEmail, setReporterEmail] = useState<string>('');
  const [reporterPhone, setReporterPhone] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedAction, setSubmittedAction] = useState<{
    action_number: string;
    area: string;
    zone: string;
  } | null>(null);

  useEffect(() => {
    if (initialArea) {
      const found = NUPURE_ROOMS.find(r => r.room.toLowerCase() === initialArea.toLowerCase());
      if (found) {
        setSelectedRoomName(found.room);
        setSelectedZone(found.zone);
      } else {
        setSelectedRoomName(initialArea);
        if (initialZone) setSelectedZone(initialZone);
      }
    }
  }, [initialArea, initialZone]);

  const handleRoomChange = (roomName: string) => {
    setSelectedRoomName(roomName);
    const spec = NUPURE_ROOMS.find(r => r.room === roomName);
    if (spec) setSelectedZone(spec.zone);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/qr-issues/upload', { method: 'POST', body: fd });
        const json = await res.json();
        if (res.ok && json.url) {
          setPhotos(prev => [...prev, json.url]);
        }
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/qr-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone: selectedZone,
          area: selectedRoomName,
          category,
          priority,
          description,
          reported_by_name: reporterName,
          reported_by_email: reporterEmail,
          reported_by_phone: reporterPhone,
          issue_photos: photos,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit issue');
      setSubmittedAction(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting issue');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedAction) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f1f5f9',
          padding: '32px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: '#ffffff',
            borderRadius: 16,
            padding: 32,
            boxShadow: '0 8px 24px rgba(15, 52, 96, 0.1)',
            textAlign: 'center',
            borderTop: '5px solid #16a34a',
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#16a34a',
              fontSize: 30,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Required Action Logged
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '6px 0 10px' }}>
            Thank You — Issue Reported
          </h1>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>
            Your cleaning request for <strong>{submittedAction.area}</strong> ({submittedAction.zone}) has been logged in the MJ Hygiene Nu-Pure Compliance Portal and dispatched to our site team.
          </p>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: 14,
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
              Required Action Reference
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f3460', marginTop: 4 }}>
              {submittedAction.action_number}
            </div>
            {reporterEmail && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                A formal Completion Report will be emailed to <strong>{reporterEmail}</strong> once resolved.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setSubmittedAction(null);
              setDescription('');
              setPhotos([]);
            }}
            style={{
              width: '100%',
              padding: '13px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#0f3460',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Report Another Issue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f1f5f9',
        padding: '24px 16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 540,
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(15, 52, 96, 0.08)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f3460, #0284c7)',
            color: '#ffffff',
            padding: '24px 24px 20px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#bae6fd' }}>
            MJ Hygiene &bull; Nu-Pure Beverages (Stapylton)
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0' }}>
            Report a Cleaning or Hygiene Issue
          </h1>
          <p style={{ fontSize: 13, color: '#e0f2fe', margin: 0 }}>
            Scan-to-Report QR Action System — Logged immediately as a Required Action for our on-site hygiene team.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* Location */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Area / Room Location *
            </label>
            <select
              value={selectedRoomName}
              onChange={e => handleRoomChange(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '2px solid #0284c7',
                background: '#f0f9ff',
                fontSize: 15,
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {NUPURE_ROOMS.map(r => (
                <option key={r.id} value={r.room}>
                  {r.zone} — {r.room}
                </option>
              ))}
            </select>
          </div>

          {/* Issue Category */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Issue Category *
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 14,
              }}
            >
              {ISSUE_CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Urgency / Priority
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {(['Low', 'Medium', 'High / Urgent'] as const).map(p => {
                const active = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    style={{
                      padding: '10px',
                      borderRadius: 8,
                      border: active ? '2px solid #0f3460' : '1px solid #cbd5e1',
                      background: active ? '#0f3460' : '#f8fafc',
                      color: active ? '#ffffff' : '#334155',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              What needs attention? *
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the cleaning issue or restock request..."
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Photo Upload */}
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 10,
              border: '1px dashed #94a3b8',
              background: '#f8fafc',
            }}
          >
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Attach Photo (Optional — Camera or Gallery)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotoUpload}
              disabled={uploading}
              style={{ fontSize: 13 }}
            />
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {photos.map((u, i) => (
                  <img
                    key={i}
                    src={u}
                    alt="Issue"
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Reporter Details (for Completion Report) */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: 14,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f3460', marginBottom: 10 }}>
              Your Details (To receive the Completion Report once resolved)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <input
                type="text"
                placeholder="Your Name (e.g. Jason Gordon)"
                value={reporterName}
                onChange={e => setReporterName(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
              <input
                type="email"
                placeholder="Your Email (for Completion Report)"
                value={reporterEmail}
                onChange={e => setReporterEmail(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
              <input
                type="tel"
                placeholder="Contact Phone (Optional)"
                value={reporterPhone}
                onChange={e => setReporterPhone(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || uploading}
            style={{
              width: '100%',
              padding: '15px 20px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 800,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Logging Required Action...' : 'Submit Cleaning Issue →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ReportIssuePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading QR Issue Reporter...</div>}>
      <ReportIssueForm />
    </Suspense>
  );
}
