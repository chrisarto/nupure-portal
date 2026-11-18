import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import './env.mjs';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_TRAINING || 'appPTtErtzoAx7NAb';
const DOCS_TABLE = 'tblwtH46TSh45tpnD';
const NU_PURE_SITE_ID = 'reckkI3UVCSarhLI2';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SB_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

const CHEMICAL_CHART_DOC_CODE = 'MJH-CHR-NUPURE-001';
const ISSUE_DATE = '2026-11-18';
const REVIEW_DATE = '2031-11-18';

const CHEMICALS = [
  {
    sectionClass: 'sec-blue',
    sectionTitle: 'SURFACE & FLOOR',
    name: 'Use All',
    code: 'USAL',
    supplier: 'True Blue Chemicals',
    packSize: '5L Drum',
    ph: 'pH 7.0 – 8.0 (Neutral)',
    appearance: 'Yellow Liquid • Citrus Odour',
    hazardBadge: 'NON-HAZARDOUS',
    hazardClass: 'ndg',
    dgBadge: 'Non-DG',
    dgClass: 'ndg',
    colourZones: [
      { label: 'BLUE — Offices, Hallways & Lab Floor', bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
      { label: 'GREEN — Lunchrooms & Kitchenettes', bg: '#dcfce7', color: '#166534', border: '#86efac' },
    ],
    desc: 'Multi-Purpose Neutral Hard Surface & Floor Cleaner (SOP-01, SOP-02, SOP-04)',
    application: [
      'General hard-surface spray & wipe (desks, tables, benches, counters, doors, sills, partitions)',
      'Damp-mopping vinyl, tile & sealed hard floors across offices, lunchrooms & Laboratory floor',
      'Safe neutral pH formula — will not dull or strip vinyl/sealed flooring',
    ],
    whereUsed: [
      'Head Office (NP-HO-01 to 04, 06, 07)',
      'Production Offices (NP-PR-01 to 03)',
      'Laboratory Vinyl Floor ONLY (NP-PR-04)',
      'Production Lunchroom & Entry (NP-PR-05)',
      'Warehouse Offices & Kitchen (NP-WH-01 to 04)',
      'Mezzanine Rooms & Kitchen (NP-MZ-01 to 04)',
      'Gatehouse & Security Bldg (NP-GH-02 to 04)',
    ],
    safetyAndPpe: [
      'PPE Required: Disposable nitrile gloves, closed safety shoes, safety glasses when decanting.',
      'Safe Handling: Avoid eye contact and prolonged skin contact. Do not mix with other chemicals.',
      'First Aid: Eyes — flush immediately with water. Skin — rinse with water. Poisons Info: 13 11 26.',
    ],
    sdsRef: 'TBC00051 (v2.0)',
    sdsIssued: '01/09/2023',
    sdsReview: '01/09/2028 (5-Yr)',
    sdsUrl: 'https://api.nupure.tmservices.cloud/storage/v1/object/public/documents/sds/Use_All_SDS_2023-09-01.pdf',
  },
  {
    sectionClass: 'sec-san',
    sectionTitle: 'DISINFECTANT',
    name: 'Airlift Jelly Bean',
    code: 'CHRC-41015A (5L) / CHRC-41015 (15L)',
    supplier: 'Research Products (Freudenberg)',
    packSize: '5L / 15L Drum',
    ph: 'pH 6.0 – 7.0 (Neutral)',
    appearance: 'Bright Red Liquid • Jellybean Fragrance',
    hazardBadge: 'NON-HAZARDOUS',
    hazardClass: 'ndg',
    dgBadge: 'Non-DG',
    dgClass: 'ndg',
    colourZones: [
      { label: 'YELLOW — Washroom Basins, Showers & Touchpoints', bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
      { label: 'RED — Sanitary Bins, Toilets & Cubicle Floors', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
      { label: 'BLUE — General High-Touch Disinfection', bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    ],
    desc: 'Commercial General-Purpose Disinfectant & Deodoriser (SOP-01, SOP-03, SOP-05)',
    application: [
      'Disinfecting & deodorising washroom sinks, taps, splashbacks, doors, handles & partitions',
      'Sanitising internal/external casings of Sanitary Waste Units (SB-01 to SB-10) during weekly service',
      'Mopping & disinfecting amenity floors and deodorising general waste receptacles',
    ],
    whereUsed: [
      'Head Office Amenities (NP-HO-05)',
      'Production Male & Female Amenities (NP-PR-06, 07)',
      'First Aid Room General Surfaces (NP-PR-08)',
      'Warehouse Toilets (NP-WH-05, NP-WH-06)',
      'Mezzanine Toilets (NP-MZ-05, NP-MZ-06)',
      "Gatehouse Drivers' Toilet (NP-GH-01)",
      'Sanitary Waste Units (SB-01 to SB-10)',
    ],
    safetyAndPpe: [
      'PPE Required: Disposable nitrile gloves, safety glasses, closed safety shoes/overalls.',
      'Safe Handling: Avoid eye contact, repeated skin contact, and inhalation of mists/aerosols. Store away from foodstuffs.',
      'First Aid: Eyes — wash out immediately with water. Skin — flush with running water. Poisons Info: 13 11 26.',
    ],
    sdsRef: 'FHCS00016 (v5.0)',
    sdsIssued: '04/09/2026',
    sdsReview: '04/09/2031 (5-Yr)',
    sdsUrl: 'https://api.nupure.tmservices.cloud/storage/v1/object/public/documents/sds/Airlift_Jellybean_SDS_2026-09-04.pdf',
  },
  {
    sectionClass: 'sec-acid',
    sectionTitle: 'WASHROOM ACID',
    name: 'Blue Lazer',
    code: 'BLAZ',
    supplier: 'True Blue Chemicals',
    packSize: '5L Drum',
    ph: 'pH < 2.5 (Acidic — Phosphoric Acid 10–30%, Quat 1–10%)',
    appearance: 'Viscous Blue Liquid • Oceanic Odour',
    hazardBadge: 'DANGER — CORROSIVE TO EYES (H318) & SKIN IRRITANT (H315)',
    hazardClass: 'dg',
    dgBadge: 'Non-DG',
    dgClass: 'ndg',
    colourZones: [
      { label: 'RED — Toilet Bowls, Urinals & Cubicle Floors', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
      { label: 'YELLOW — Showers, Soap Scum & Scale Removal', bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
    ],
    desc: 'Heavy-Duty Acidic Bathroom Cleaner, Descaler & Sanitiser (SOP-03)',
    application: [
      'Descaling & sanitising toilet bowls, urinals, flushing rims & encrusted mineral deposits',
      'Removing soap build-up, body fat & hard-water scale from Production shower bases, walls & fittings',
      'Observe manufacturer contact time; scrub with segregated RED (toilet) or YELLOW (shower/basin) tools & rinse',
    ],
    whereUsed: [
      'Production Male Amenities & Shower (NP-PR-06)',
      'Production Female Amenities & Shower (NP-PR-07)',
      'Head Office Male/Female/Accessible Toilets (NP-HO-05)',
      'Warehouse Unisex & Accessible Toilets (NP-WH-05, 06)',
      'Mezzanine Male & Female Toilets (NP-MZ-05, 06)',
      "Gatehouse Drivers' Toilet (NP-GH-01)",
    ],
    safetyAndPpe: [
      'MANDATORY PPE: Safety glasses / eye shield, nitrile rubber gloves, closed safety shoes.',
      'CRITICAL WARNING: Causes serious eye damage (corneal burns) & skin irritation. NEVER mix with chlorine/bleach or alkaline products.',
      'First Aid: IF IN EYES: Irrigate with copious water for 15 minutes holding eyelids open & seek urgent medical attention.',
    ],
    sdsRef: 'TBC00007 (v2.0)',
    sdsIssued: '01/09/2023',
    sdsReview: '01/09/2028 (5-Yr)',
    sdsUrl: 'https://api.nupure.tmservices.cloud/storage/v1/object/public/documents/sds/Blue_Lazer_SDS_2023-09-01.pdf',
  },
  {
    sectionClass: 'sec-amen',
    sectionTitle: 'URINAL HYGIENE',
    name: 'V-Screen Dual — Ice Cool',
    code: 'V-SCN-DUAL-IC-EU',
    supplier: 'Vectair Systems Ltd',
    packSize: 'Pack (Urinal Screens)',
    ph: 'Solid EVA Matrix (Not Applicable)',
    appearance: 'Opaque Blue Solid • Ice Cool Fragrance',
    hazardBadge: 'WARNING — SKIN SENSITISER (H317)',
    hazardClass: 'flam',
    dgBadge: 'Non-DG',
    dgClass: 'ndg',
    colourZones: [
      { label: 'RED — Urinal Fixtures Only', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    ],
    desc: 'Dual-Sided Anti-Splash & Deodorising Urinal Screen (SOP-03)',
    application: [
      'Placed directly over urinal drain outlets to prevent splashback, trap debris & provide continuous deodorisation',
      'Inspect during daily urinal cleaning (SOP-03) and replace when fragrance is depleted or screen is fouled',
      'Remove old screen using RED-segregated gloved hands and dispose in sealed general waste',
    ],
    whereUsed: [
      'Production Male Amenities — 2 Urinals (NP-PR-06)',
      'Head Office Male Amenities — Urinals (NP-HO-05)',
      'Mezzanine Male Toilet (NP-MZ-05)',
    ],
    safetyAndPpe: [
      'PPE Required: Disposable nitrile gloves and eye protection when handling/replacing urinal screens.',
      'Safe Handling: Contains fragrance sensitisers (H317: May cause an allergic skin reaction). Wash hands with soap & water after handling.',
      'First Aid: IF ON SKIN: Wash with plenty of soap and water. If skin irritation or rash occurs: Get medical advice/attention.',
    ],
    sdsRef: 'SDS_1155 (v4.0)',
    sdsIssued: '21/02/2024',
    sdsReview: '21/02/2029 (5-Yr)',
    sdsUrl: 'https://api.nupure.tmservices.cloud/storage/v1/object/public/documents/sds/V-Screen_Dual_Ice_Cool_SDS_2024-02-21.pdf',
  },
];

async function fetchQrDataUri(targetUrl) {
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=6&ecc=M&data=${encodeURIComponent(targetUrl)}`;
  const res = await fetch(qrApiUrl);
  if (!res.ok) throw new Error(`Failed to fetch QR code for ${targetUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function getLogoDataUri() {
  const candidates = [
    'D:\\chemical charts folder\\mj-logo.png',
    path.resolve('public/logo.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      return `data:image/png;base64,${buf.toString('base64')}`;
    }
  }
  return '';
}

function buildHtml({ logoDataUri, portalQrDataUri, cardsWithQr, darkTheme = false }) {
  const bgPage = darkTheme ? '#0f172a' : '#ffffff';
  const textMain = darkTheme ? '#f8fafc' : '#1e293b';
  const cardBg = darkTheme ? '#1e293b' : '#ffffff';
  const cardBorder = darkTheme ? '#334155' : '#cbd5e1';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MJ Hygiene — Nu-Pure Beverages Chemical Quick Reference & SDS Wall Chart</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: ${bgPage};
  color: ${textMain};
  padding: 6px 10px;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
@page { size: A3 landscape; margin: 6mm; }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 3px solid #f59e0b;
  padding-bottom: 6px;
  margin-bottom: 8px;
  gap: 16px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.header-left img {
  height: 50px;
  ${darkTheme ? 'filter: brightness(0) invert(1);' : ''}
}
.header-title .eyebrow {
  font-size: 9.5px;
  font-weight: 800;
  color: ${darkTheme ? '#38bdf8' : '#0284c7'};
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.header-title h1 {
  font-size: 22px;
  font-weight: 900;
  color: ${darkTheme ? '#ffffff' : '#1e40af'};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 1px 0;
}
.header-title .sub {
  color: ${darkTheme ? '#cbd5e1' : '#475569'};
  font-size: 11.5px;
  font-weight: 600;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-meta {
  text-align: right;
  font-size: 10.5px;
  color: ${darkTheme ? '#cbd5e1' : '#475569'};
  font-weight: 600;
  line-height: 1.35;
}
.header-meta strong {
  color: ${darkTheme ? '#ffffff' : '#0f172a'};
  font-size: 11px;
}
.portal-qr-box {
  display: flex;
  align-items: center;
  gap: 7px;
  background: ${darkTheme ? '#1e293b' : '#f8fafc'};
  border: 1.5px solid ${darkTheme ? '#334155' : '#cbd5e1'};
  border-radius: 7px;
  padding: 4px 7px;
}
.portal-qr-box img {
  width: 46px;
  height: 46px;
  border-radius: 4px;
  background: #ffffff;
}
.portal-qr-text {
  font-size: 8.8px;
  font-weight: 700;
  color: ${darkTheme ? '#e2e8f0' : '#334155'};
  line-height: 1.25;
  max-width: 88px;
}

.grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.section-wrapper {
  display: flex;
  border: 2px solid;
  border-radius: 8px;
  overflow: hidden;
  page-break-inside: avoid;
}
.section-header {
  width: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  font-size: 12px;
  font-weight: 900;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  padding: 8px 0;
  flex-shrink: 0;
}
.section-content {
  flex: 1;
  padding: 7px;
  display: flex;
}

/* Category 50% Opacity Section Styles */
.sec-blue { border-color: #2563eb; }
.sec-blue .section-header { background: #2563eb; }
.sec-blue .section-content { background: rgba(59, 130, 246, 0.22); }

.sec-san { border-color: #059669; }
.sec-san .section-header { background: #059669; }
.sec-san .section-content { background: rgba(16, 185, 129, 0.22); }

.sec-acid { border-color: #dc2626; }
.sec-acid .section-header { background: #dc2626; }
.sec-acid .section-content { background: rgba(239, 68, 68, 0.20); }

.sec-amen { border-color: #7c3aed; }
.sec-amen .section-header { background: #7c3aed; }
.sec-amen .section-content { background: rgba(139, 92, 246, 0.22); }

.card {
  background: ${cardBg};
  border: 1px solid ${cardBorder};
  border-radius: 7px;
  padding: 8px 11px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.card-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chem-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: wrap;
}
.chem-name {
  font-size: 15.5px;
  font-weight: 900;
  color: ${darkTheme ? '#ffffff' : '#0f172a'};
  line-height: 1.1;
}
.chem-code {
  font-size: 9.8px;
  font-weight: 700;
  color: ${darkTheme ? '#94a3b8' : '#475569'};
  margin-top: 1px;
}
.badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.hz {
  font-size: 8.5px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 800;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.hz.dg { background: #dc2626; }
.hz.ndg { background: #16a34a; }
.hz.flam { background: #d97706; }

.chem-desc {
  font-size: 10.2px;
  font-weight: 700;
  color: ${darkTheme ? '#38bdf8' : '#0369a1'};
}
.specs-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 9.5px;
  font-weight: 700;
  color: ${darkTheme ? '#cbd5e1' : '#334155'};
  background: ${darkTheme ? '#0f172a' : '#f8fafc'};
  padding: 3px 7px;
  border-radius: 4px;
  border: 1px solid ${darkTheme ? '#334155' : '#e2e8f0'};
}
.colour-zones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.cz-pill {
  font-size: 8.8px;
  font-weight: 800;
  padding: 1.5px 7px;
  border-radius: 999px;
  border: 1px solid;
}
.info-block {
  font-size: 9.4px;
  line-height: 1.3;
  color: ${darkTheme ? '#e2e8f0' : '#1e293b'};
}
.info-block strong.block-label {
  display: block;
  font-size: 8.6px;
  font-weight: 800;
  text-transform: uppercase;
  color: ${darkTheme ? '#94a3b8' : '#475569'};
  letter-spacing: 0.04em;
  margin-bottom: 1.5px;
}
.info-list {
  padding-left: 13px;
  margin: 0;
}
.info-list li {
  margin-bottom: 1px;
}
.areas {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.area-tag {
  font-size: 8.6px;
  padding: 1.5px 6px;
  border-radius: 4px;
  font-weight: 700;
  background: ${darkTheme ? '#334155' : '#e0f2fe'};
  color: ${darkTheme ? '#e2e8f0' : '#0f3460'};
  border: 1px solid ${darkTheme ? '#475569' : '#bae6fd'};
}
.safety-box {
  background: ${darkTheme ? 'rgba(254, 243, 199, 0.08)' : '#fffbeb'};
  border: 1px solid ${darkTheme ? '#b45309' : '#fde68a'};
  border-left: 3px solid #f59e0b;
  border-radius: 5px;
  padding: 4px 7px;
  font-size: 9px;
  line-height: 1.28;
  color: ${darkTheme ? '#fef3c7' : '#78350f'};
}
.safety-box.danger {
  background: ${darkTheme ? 'rgba(254, 226, 226, 0.1)' : '#fef2f2'};
  border-color: ${darkTheme ? '#dc2626' : '#fecaca'};
  border-left: 3px solid #dc2626;
  color: ${darkTheme ? '#fecaca' : '#7f1d1d'};
}

/* Right QR Column inside each Chemical Card */
.card-qr {
  width: 118px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  background: ${darkTheme ? '#0f172a' : '#f8fafc'};
  border: 1.5px solid ${darkTheme ? '#334155' : '#cbd5e1'};
  border-radius: 7px;
  padding: 6px 5px;
  text-align: center;
}
.qr-title {
  font-size: 8.8px;
  font-weight: 900;
  text-transform: uppercase;
  color: ${darkTheme ? '#38bdf8' : '#0f3460'};
  letter-spacing: 0.04em;
}
.card-qr img {
  width: 92px;
  height: 92px;
  background: #ffffff;
  padding: 2px;
  border-radius: 5px;
  border: 1px solid #cbd5e1;
  margin: 2px 0;
}
.sds-dates {
  font-size: 8.2px;
  font-weight: 700;
  color: ${darkTheme ? '#cbd5e1' : '#334155'};
  line-height: 1.28;
}
.sds-dates .rev-due {
  color: ${darkTheme ? '#4ade80' : '#15803d'};
  font-weight: 800;
}
.sds-link {
  display: inline-block;
  width: 100%;
  font-size: 8.8px;
  font-weight: 800;
  color: #ffffff;
  background: #1e40af;
  text-decoration: none;
  padding: 3.5px 5px;
  border-radius: 4px;
  margin-top: 2px;
}

/* Bottom PPE & Critical Rules Bar */
.ppe-bar {
  background: ${darkTheme ? '#1e293b' : '#fefce8'};
  border: 2px solid #facc15;
  border-radius: 8px;
  padding: 7px 12px;
  margin-top: 8px;
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  gap: 14px;
}
.ppe-col h3 {
  font-size: 10.2px;
  font-weight: 900;
  color: ${darkTheme ? '#facc15' : '#854d0e'};
  margin-bottom: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.ppe-col p, .ppe-col ul {
  font-size: 9px;
  color: ${darkTheme ? '#e2e8f0' : '#422006'};
  line-height: 1.35;
}
.ppe-col ul {
  padding-left: 14px;
}
.seg-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-top: 2px;
}
.seg-item {
  font-size: 8.5px;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 4px;
  border-left: 3.5px solid;
  line-height: 1.25;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  color: ${darkTheme ? '#94a3b8' : '#64748b'};
  margin-top: 5px;
  font-weight: 700;
  border-top: 1px solid ${darkTheme ? '#334155' : '#e2e8f0'};
  padding-top: 4px;
}
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    ${logoDataUri ? `<img src="${logoDataUri}" alt="MJ Hygiene Services">` : ''}
    <div class="header-title">
      <div class="eyebrow">Document ID: ${CHEMICAL_CHART_DOC_CODE} &bull; Controlled Site Chemical Register &amp; SDS QR Wall Chart</div>
      <h1>Chemical Quick Reference &amp; SDS Wall Chart</h1>
      <div class="sub">Nu-Pure Beverages — Stapylton Facility (1/76 Quinns Hill Rd E, Stapylton QLD 4207) &bull; MJ Hygiene Approved Chemicals</div>
    </div>
  </div>

  <div class="header-right">
    <div class="header-meta">
      <div><strong>Suppliers:</strong> True Blue Chemicals &bull; Research Products &bull; Vectair Systems</div>
      <div><strong>Portal SDS Library:</strong> https://nupure.tmservices.cloud/documents</div>
      <div style="margin-top:3px">
        <span class="hz dg">DANGER / CORROSIVE</span> &nbsp;
        <span class="hz flam">WARNING / SENSITISER</span> &nbsp;
        <span class="hz ndg">NON-HAZARDOUS / NON-DG</span>
      </div>
    </div>
    <div class="portal-qr-box">
      <img src="${portalQrDataUri}" alt="Portal SDS Library QR">
      <div class="portal-qr-text">
        <strong style="color:#0284c7;display:block;font-size:10px">SCAN FOR PORTAL</strong>
        Live SDS Library &amp; Room Checklists
      </div>
    </div>
  </div>
</div>

<div class="grid-2x2">
  ${cardsWithQr
    .map(
      c => `
  <div class="section-wrapper ${c.sectionClass}">
    <div class="section-header">${c.sectionTitle}</div>
    <div class="section-content">
      <div class="card">
        <div class="card-main">
          <div class="chem-top">
            <div>
              <div class="chem-name">${c.name}</div>
              <div class="chem-code">Product Code: <strong>${c.code}</strong> &bull; Supplier: <strong>${c.supplier}</strong> (${c.packSize})</div>
            </div>
            <div class="badges">
              <span class="hz ${c.hazardClass}">${c.hazardBadge}</span>
              <span class="hz ${c.dgClass}">${c.dgBadge}</span>
            </div>
          </div>

          <div class="chem-desc">${c.desc}</div>

          <div class="specs-row">
            <span>🧪 <strong>pH / Type:</strong> ${c.ph}</span>
            <span>💧 <strong>Appearance:</strong> ${c.appearance}</span>
          </div>

          <div class="colour-zones">
            ${c.colourZones
              .map(
                z =>
                  `<span class="cz-pill" style="background:${z.bg};color:${z.color};border-color:${z.border}">🎨 ${z.label}</span>`
              )
              .join('')}
          </div>

          <div class="info-block">
            <strong class="block-label">Approved Application &amp; Method:</strong>
            <ul class="info-list">
              ${c.application.map(line => `<li>${line}</li>`).join('')}
            </ul>
          </div>

          <div class="info-block">
            <strong class="block-label">Where Used at Nu-Pure Stapylton (Approved Areas):</strong>
            <div class="areas">
              ${c.whereUsed.map(a => `<span class="area-tag">${a}</span>`).join('')}
            </div>
          </div>

          <div class="safety-box ${c.hazardClass === 'dg' ? 'danger' : ''}">
            <strong style="text-transform:uppercase;font-size:9.5px;display:block;margin-bottom:2px">⚠️ Safety, PPE &amp; First Aid Controls:</strong>
            <ul class="info-list">
              ${c.safetyAndPpe.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="card-qr">
          <div class="qr-title">📱 Scan for Full SDS</div>
          <img src="${c.qrDataUri}" alt="SDS QR Code for ${c.name}">
          <div class="sds-dates">
            <div><strong>Ref:</strong> ${c.sdsRef}</div>
            <div><strong>Issued:</strong> ${c.sdsIssued}</div>
            <div class="rev-due"><strong>Review:</strong> ${c.sdsReview}</div>
          </div>
          <a class="sds-link" href="${c.sdsUrl}" target="_blank" rel="noopener noreferrer">📄 Open SDS PDF ↗</a>
        </div>
      </div>
    </div>
  </div>`
    )
    .join('\n')}
</div>

<div class="ppe-bar">
  <div class="ppe-col">
    <h3>⚠️ Mandatory PPE &amp; Chemical Handling Rules</h3>
    <ul>
      <li><strong>Eye Protection (Safety Glasses):</strong> Mandatory when handling or decanting <strong>Blue Lazer</strong> (Corrosive to Eyes — H318) and recommended when decanting any chemical.</li>
      <li><strong>Hand &amp; Foot Protection:</strong> Disposable nitrile rubber gloves and closed work/safety boots must be worn for all cleaning &amp; hygiene tasks. Change gloves between zones.</li>
      <li><strong>Label &amp; Dispensing Control:</strong> Only dispense at authorised points into correctly labelled trigger bottles/buckets. <strong>Never reuse food or drink containers.</strong></li>
      <li><strong>Emergency / Poisons Info:</strong> Australia Poisons Information Centre: <strong>13 11 26</strong>. Ensure eyewash stations are unobstructed.</li>
    </ul>
  </div>

  <div class="ppe-col" style="border-left:1px solid #fde047;padding-left:16px">
    <h3 style="color:#0f3460">🎨 Colour-Coded Equipment Segregation (MJH-SOP-NUPURE-001)</h3>
    <div class="seg-grid">
      <div class="seg-item" style="background:#fee2e2;color:#991b1b;border-color:#dc2626">
        <strong>RED — Toilets &amp; Urinals:</strong><br>Toilet bowls, urinals, sanitary bins (SB-01..10) &amp; cubicle floors. <em>Never use in sinks, kitchens or offices.</em>
      </div>
      <div class="seg-item" style="background:#fef9c3;color:#854d0e;border-color:#eab308">
        <strong>YELLOW — Washrooms &amp; Showers:</strong><br>Basins, taps, mirrors, showers, vanity tops &amp; tiled walls. <em>Never use on toilets or food areas.</em>
      </div>
      <div class="seg-item" style="background:#dcfce7;color:#166534;border-color:#16a34a">
        <strong>GREEN — Lunchrooms &amp; Kitchens:</strong><br>Dining tables, food benches, microwaves, fridges &amp; sinks. <em>Dedicated food-area cloths only.</em>
      </div>
      <div class="seg-item" style="background:#dbeafe;color:#1e40af;border-color:#2563eb">
        <strong>BLUE — Offices &amp; General Floors:</strong><br>General offices, boardrooms, reception, internal glass &amp; Laboratory vinyl floor (SOP-04).
      </div>
    </div>
  </div>

  <div class="ppe-col" style="border-left:1px solid #fde047;padding-left:16px">
    <h3 style="color:#b91c1c">⛔ Critical Nu-Pure Site Boundaries</h3>
    <ul>
      <li><strong>NEVER Mix Chemicals:</strong> Never combine <strong>Blue Lazer</strong> (acid) with bleach/chlorine or alkaline cleaners — toxic gas hazard.</li>
      <li><strong>Strict Laboratory Rule (NP-PR-04 / SOP-04):</strong> Use <strong>Use All</strong> with clean <strong>BLUE</strong> floor tools on the vinyl floor ONLY. Do NOT touch lab benches, chemicals, samples or instruments.</li>
      <li><strong>Managed Air Fresheners (AF-01 to AF-09):</strong> Keep aerosols away from ignition sources; do not spray near people, food or open electricals.</li>
      <li><strong>5-Year SDS Review Control:</strong> All site SDS documents are controlled in the Portal (<code>/documents</code>) and reviewed at least every 5 years from issue date.</li>
    </ul>
  </div>
</div>

<div class="footer">
  <span>${CHEMICAL_CHART_DOC_CODE} (v1.0) | MJ Hygiene Management Services Pty Ltd — Nu-Pure Beverages (Stapylton Facility)</span>
  <span>Issued: 18 Nov 2026 &bull; SDS 5-Year Review Cycle Verified &bull; Scan any QR code above with a phone/tablet camera to open the full PDF Safety Data Sheet</span>
</div>

</body>
</html>`;
}

async function main() {
  console.log('1. Generating QR codes for the 4 SDS links and Portal SDS Library...');
  const logoDataUri = getLogoDataUri();
  const portalQrDataUri = await fetchQrDataUri('https://nupure.tmservices.cloud/documents');

  const cardsWithQr = [];
  for (const c of CHEMICALS) {
    const qrDataUri = await fetchQrDataUri(c.sdsUrl);
    cardsWithQr.push({ ...c, qrDataUri });
    console.log(`   ✓ Generated QR Code for ${c.name} -> ${c.sdsUrl}`);
  }

  console.log('\n2. Writing Print-Ready (White/50% Colour) & Web (Dark) HTML Wall Charts...');
  const printHtml = buildHtml({ logoDataUri, portalQrDataUri, cardsWithQr, darkTheme: false });
  const webHtml = buildHtml({ logoDataUri, portalQrDataUri, cardsWithQr, darkTheme: true });

  const localDocsDir = path.resolve('public/docs');
  fs.mkdirSync(localDocsDir, { recursive: true });

  const localPrintHtmlPath = path.join(localDocsDir, 'NuPure_Chemical_Wall_Chart_Print.html');
  const localWebHtmlPath = path.join(localDocsDir, 'NuPure_Chemical_Wall_Chart.html');
  const localPdfPath = path.join(localDocsDir, 'NuPure_Chemical_Wall_Chart.pdf');

  fs.writeFileSync(localPrintHtmlPath, printHtml, 'utf8');
  fs.writeFileSync(localWebHtmlPath, webHtml, 'utf8');
  console.log(`   ✓ Saved ${localPrintHtmlPath}`);
  console.log(`   ✓ Saved ${localWebHtmlPath}`);

  console.log('\n3. Rendering A3 Landscape PDF Wall Chart via Headless Chrome...');
  const chromeCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const browserExe = chromeCandidates.find(p => fs.existsSync(p));
  if (!browserExe) throw new Error('Neither Chrome nor Edge found for headless PDF rendering');

  execFileSync(browserExe, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${localPdfPath}`,
    `file:///${localPrintHtmlPath.replace(/\\/g, '/')}`,
  ]);

  const pdfBuffer = fs.readFileSync(localPdfPath);
  console.log(`   ✓ Rendered PDF Wall Chart: ${localPdfPath} (${pdfBuffer.length} bytes)`);

  // Copy HTML & PDF to \\mjserver\Mj Services Working Folder\NU Pure Beverages (and Z:\NU Pure Beverages)
  const networkDirs = [
    '\\\\mjserver\\Mj Services Working Folder\\NU Pure Beverages',
    '\\\\mjserver\\Mj Services Working Folder\\NU Pure Beverages\\SDS',
    'Z:\\NU Pure Beverages',
  ];
  for (const dir of networkDirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.writeFileSync(path.join(dir, 'MJ Hygiene — Nu-Pure Chemical Quick Reference Wall Chart (Print).pdf'), pdfBuffer);
        fs.writeFileSync(path.join(dir, 'NuPure_Chemical_Wall_Chart_Print.html'), printHtml, 'utf8');
        fs.writeFileSync(path.join(dir, 'NuPure_Chemical_Wall_Chart.html'), webHtml, 'utf8');
        console.log(`   ✓ Copied PDF & HTML Wall Charts to ${dir}`);
      }
    } catch (err) {
      console.warn(`   ! Could not copy to ${dir}:`, err.message);
    }
  }

  console.log('\n4. Uploading NuPure_Chemical_Wall_Chart.pdf to Supabase Storage & Linking in Portal Documents...');
  const pubPath = 'NuPure_Chemical_Wall_Chart.pdf';
  const pubUp = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${pubPath}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: pdfBuffer,
  });
  if (!pubUp.ok) throw new Error(`Supabase public upload failed: ${await pubUp.text()}`);
  const publicPdfUrl = `${SUPABASE_URL}/storage/v1/object/public/documents/${pubPath}`;

  const storagePath = `training-documents/${CHEMICAL_CHART_DOC_CODE}/NuPure_Chemical_Wall_Chart.pdf`;
  await fetch(`${SUPABASE_URL}/storage/v1/object/nupure-attachments/${storagePath}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: pdfBuffer,
  });

  // Upsert in Airtable (tblwtH46TSh45tpnD)
  const formula = `{Document Code} = "${CHEMICAL_CHART_DOC_CODE}"`;
  const params = new URLSearchParams({ filterByFormula: formula });
  const existingRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}?${params}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  const existingJson = existingRes.ok ? await existingRes.json() : { records: [] };
  const existing = (existingJson.records || [])[0];

  const fields = {
    'Document Code': CHEMICAL_CHART_DOC_CODE,
    'Long Name': 'Nu-Pure Beverages — Site Chemical Quick Reference & SDS QR Code Wall Chart (A3 Poster)',
    'Document Type': 'Safety Data Sheet',
    'Status': 'Control Document',
    'Version Number': 1.0,
    'Date Created': ISSUE_DATE,
    'Reviewed Date': ISSUE_DATE,
    'Review Period (years)': 5,
    'Re-Training Frequency': 1,
    'Requires Practical': false,
    'Site Assigned': [NU_PURE_SITE_ID],
    'Room/Area': [
      'Head Office',
      'Production Areas',
      'Warehouse Areas',
      'Mezzanine Floor',
      "Gatehouse & Drivers' Toilet",
      'Hygiene Services & Consumables',
    ],
    'Document Link': [
      {
        url: publicPdfUrl,
        filename: `${CHEMICAL_CHART_DOC_CODE} - NuPure_Chemical_Wall_Chart.pdf`,
      },
    ],
  };

  let recordId = existing?.id;
  let airtableFields = {};
  if (existing) {
    const patchRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}/${existing.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, typecast: true }),
    });
    if (patchRes.ok) {
      const updated = await patchRes.json();
      recordId = updated.id;
      airtableFields = updated.fields || {};
    }
  } else {
    const postRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${DOCS_TABLE}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, typecast: true }),
    });
    if (postRes.ok) {
      const created = await postRes.json();
      recordId = created.id;
      airtableFields = created.fields || {};
    }
  }
  if (!recordId) recordId = 'rec_chem_chart_nupure_001';

  const attObj = {
    id: `att_${recordId}`,
    url: `supabase-storage://${storagePath}`,
    storagePath,
    publicUrl: publicPdfUrl,
    filename: `${CHEMICAL_CHART_DOC_CODE} - NuPure_Chemical_Wall_Chart.pdf`,
    size: pdfBuffer.length,
    type: 'application/pdf',
  };

  const sbRow = {
    airtable_id: recordId,
    data: {
      ...airtableFields,
      ...fields,
      'Reviewed Date': ISSUE_DATE,
      'Next Review Date': `${REVIEW_DATE}T00:00:00.000Z`,
      'Site Name (from Grid view)': ['Nu Pure Beverages'],
      'Document Link': [attObj],
      'Document Upload': [attObj],
    },
    synced_at: new Date().toISOString(),
  };

  await fetch(`${SUPABASE_URL}/rest/v1/nupure_training_documents`, {
    method: 'POST',
    headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([sbRow]),
  });

  console.log(`   ✓ Synced ${CHEMICAL_CHART_DOC_CODE} to Airtable [${recordId}] & Supabase!`);
  console.log(`   ✓ Public PDF URL: ${publicPdfUrl}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
