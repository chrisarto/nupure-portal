'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { NUPURE_ZONES, NUPURE_ROOMS } from '@/lib/nupure-scope';

const SITE_BASE_URL = 'https://nupure.tmservices.cloud';

export default function QrCodesPage() {
  const [selectedZone, setSelectedZone] = useState<string>('All Zones');

  const rooms =
    selectedZone === 'All Zones'
      ? NUPURE_ROOMS
      : NUPURE_ROOMS.filter(r => r.zone === selectedZone);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1360, margin: '0 auto' }}>
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
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284c7' }}>
            Nu-Pure Beverages — Stapylton Facility
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '4px 0 6px' }}>
            Printable Site QR Code Posters (Scan-to-Report)
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Print and place these QR code posters in each room/amenity across the site. Scanning any QR code opens the mobile issue reporter pre-linked to that exact room and logs a Required Action in the portal.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            href="/actions"
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            View Required Actions Register →
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#0f3460',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🖨️ Print QR Posters ({rooms.length})
          </button>
        </div>
      </div>

      {/* Zone Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {['All Zones', ...NUPURE_ZONES].map(zone => {
          const active = selectedZone === zone;
          return (
            <button
              key={zone}
              type="button"
              onClick={() => setSelectedZone(zone)}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: active ? '1px solid #0f3460' : '1px solid #cbd5e1',
                background: active ? '#0f3460' : '#ffffff',
                color: active ? '#ffffff' : '#334155',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {zone}
            </button>
          );
        })}
      </div>

      {/* Printable Grid of Room QR Posters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: 20,
        }}
      >
        {rooms.map(r => {
          const targetUrl = `${SITE_BASE_URL}/report-issue?zone=${encodeURIComponent(r.zone)}&area=${encodeURIComponent(r.room)}&code=${encodeURIComponent(r.code)}`;
          const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(targetUrl)}`;

          return (
            <div
              key={r.id}
              style={{
                background: '#ffffff',
                border: '2px solid #0f3460',
                borderRadius: 16,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
                pageBreakInside: 'avoid',
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, #0f3460, #0284c7)',
                  color: '#ffffff',
                  padding: '14px 18px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#bae6fd' }}>
                  MJ Hygiene &bull; Nu-Pure Beverages
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 3 }}>{r.room}</div>
                <div style={{ fontSize: 11, color: '#e0f2fe', marginTop: 2 }}>
                  {r.zone} &bull; {r.code}
                </div>
              </div>

              <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                <div
                  style={{
                    display: 'inline-block',
                    padding: 10,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                  }}
                >
                  <img
                    src={qrImgUrl}
                    alt={`QR Code for ${r.room}`}
                    width={190}
                    height={190}
                    style={{ display: 'block' }}
                  />
                </div>

                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 12 }}>
                  Scan to Report a Cleaning Issue
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                  Need soap/paper restocked or urgent cleaning attention? Scan with your phone camera to log a Required Action.
                </div>
              </div>

              <div
                style={{
                  padding: '10px 16px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                <span style={{ color: '#64748b', fontWeight: 700 }}>{r.frequencyBadge} SCOPE</span>
                <Link
                  href={`/report-issue?zone=${encodeURIComponent(r.zone)}&area=${encodeURIComponent(r.room)}&code=${encodeURIComponent(r.code)}`}
                  target="_blank"
                  style={{
                    color: '#0284c7',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Test Scan Link ↗
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
