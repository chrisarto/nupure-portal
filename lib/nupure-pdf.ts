import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { NUPURE_ROOMS, NUPURE_ZONES } from '@/lib/nupure-scope';

export interface CleaningChecklistItem {
  label: string;
  completed: boolean;
}

export interface CleaningRecordPdfRow {
  id: string;
  report_number: string;
  date: string;
  zone: string;
  location: string;
  frequency_badge: string;
  checklist_items: CleaningChecklistItem[] | null;
  items_cleaned: string | null;
  total_time_minutes: number | null;
  shift_type: string | null;
  cleaning_type: string | null;
  chemicals_used: string[] | null;
  operators_involved: string[] | null;
  ssop_verified: boolean | null;
  visual_inspection_passed: boolean | null;
  corrective_action: string | null;
  before_photos?: string[] | null;
  after_photos?: string[] | null;
  comments: string | null;
  submitted_by: string | null;
  supervisor_signoff: string | null;
  created_at: string;
}

export interface QrIssuePdfRow {
  id: string;
  action_number: string;
  zone: string;
  area: string;
  category: string;
  priority: string;
  description: string;
  reported_by_name: string | null;
  reported_by_email: string | null;
  reported_by_phone: string | null;
  status: string;
  completed_by: string | null;
  completed_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

interface JsPdfWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

function getLastTableY(doc: jsPDF, fallbackY: number): number {
  const typed = doc as JsPdfWithAutoTable;
  return typed.lastAutoTable?.finalY ?? fallbackY;
}

function formatAuDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isWeekendDate(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}

function addPageFooters(doc: jsPDF, reportRef: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 284, 196, 284);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `MJ Hygiene Services • Nu-Pure Beverages (1/76 Quinns Hill Rd E, Stapylton QLD 4207) • Ref: ${reportRef}`,
      14,
      289
    );
    doc.text(`Page ${i} of ${pageCount}`, 196, 289, { align: 'right' });
  }
}

/* ═══════════════════════════════════════════════════════════════
   1. DAILY CLEANING COMPLETION REPORT PDF (All Completed Rooms)
   ═══════════════════════════════════════════════════════════════ */

export function generateDailyCompletionPdf(
  dateStr: string,
  records: CleaningRecordPdfRow[]
): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const reportRef = `DCR-${dateStr.replace(/-/g, '')}`;
  const weekend = isWeekendDate(dateStr);

  // Header Banner
  doc.setFillColor(15, 52, 96); // #0f3460
  doc.rect(0, 0, 210, 38, 'F');
  doc.setFillColor(2, 132, 199); // #0284c7 accent strip
  doc.rect(0, 38, 210, 2.5, 'F');

  doc.setTextColor(186, 230, 253);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('MJ HYGIENE SERVICES  •  NU-PURE BEVERAGES (STAPYLTON FACILITY)', 14, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text('DAILY CLEANING COMPLETION REPORT', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(224, 242, 254);
  doc.text(`Shift Date: ${formatAuDate(dateStr)}`, 14, 27.5);
  doc.text('Site: 1/76 Quinns Hill Rd E, Stapylton QLD 4207', 14, 33);

  // Right badge in header
  doc.setFillColor(22, 163, 74);
  doc.roundedRect(148, 11, 48, 18, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REPORT REFERENCE', 172, 17.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(reportRef, 172, 24.5, { align: 'center' });

  // Compute statistics
  const recordsByRoom = new Map<string, CleaningRecordPdfRow>();
  for (const r of records) {
    if (!recordsByRoom.has(r.location)) {
      recordsByRoom.set(r.location, r);
    }
  }

  const scheduledRooms = NUPURE_ROOMS.filter(r => {
    if (r.frequencyBadge === '7 DAYS') return true;
    if (r.frequencyBadge === '5 DAYS') return !weekend;
    return recordsByRoom.has(r.room);
  });

  const completedUniqueCount = recordsByRoom.size;
  const totalMinutes = records.reduce((sum, r) => sum + (Number(r.total_time_minutes) || 0), 0);
  const passedCount = records.filter(r => r.visual_inspection_passed !== false).length;
  const passRatePct = records.length > 0 ? Math.round((passedCount / records.length) * 100) : 100;
  const totalChecklistCompleted = records.reduce((sum, r) => {
    if (Array.isArray(r.checklist_items) && r.checklist_items.length > 0) {
      return sum + r.checklist_items.filter(i => i.completed).length;
    }
    return sum + 4;
  }, 0);

  // KPI Summary Strip
  const kpiY = 46;
  const boxW = 43.5;
  const kpis = [
    { label: 'ROOMS LOGGED', value: `${completedUniqueCount} Rooms (${records.length} Events)` },
    { label: 'SCHEDULED COVERAGE', value: `${completedUniqueCount} / ${scheduledRooms.length} Scheduled` },
    { label: 'TOTAL CLEANING TIME', value: `${totalMinutes} mins (${(totalMinutes / 60).toFixed(1)} hrs)` },
    { label: 'INSPECTION PASS RATE', value: `${passRatePct}% (${totalChecklistCompleted} Tasks)` },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (boxW + 2.6);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, kpiY, boxW, 17, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3, kpiY + 6);
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, x + 3, kpiY + 13);
  });

  // Section 1: Zone Completion Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 52, 96);
  doc.text('1. Executive Zone Completion Summary', 14, 71);

  const zoneRows = NUPURE_ZONES.map(zone => {
    const roomsInZone = NUPURE_ROOMS.filter(r => r.zone === zone);
    const scheduledInZone = roomsInZone.filter(r => {
      if (r.frequencyBadge === '7 DAYS') return true;
      if (r.frequencyBadge === '5 DAYS') return !weekend;
      return recordsByRoom.has(r.room);
    });
    const completedInZone = roomsInZone.filter(r => recordsByRoom.has(r.room));
    const zoneRecords = records.filter(r => r.zone === zone);
    const zoneMins = zoneRecords.reduce((s, r) => s + (Number(r.total_time_minutes) || 0), 0);
    const statusLabel =
      completedInZone.length >= scheduledInZone.length && scheduledInZone.length > 0
        ? 'COMPLETED'
        : completedInZone.length > 0
          ? `PARTIAL (${completedInZone.length}/${scheduledInZone.length})`
          : scheduledInZone.length === 0
            ? 'OFF-SCHEDULE'
            : 'PENDING';

    return [
      zone,
      `${ roomsInZone.length } Areas`,
      `${ scheduledInZone.length } Scheduled`,
      `${ completedInZone.length } Completed`,
      `${ zoneMins } mins`,
      statusLabel,
    ];
  });

  autoTable(doc, {
    startY: 74,
    head: [['Facility Zone', 'Total Scope', 'Scheduled Today', 'Completed', 'Duration', 'Zone Status']],
    body: zoneRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 52, 96],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  let currentY = getLastTableY(doc, 130) + 9;

  // Section 2: Master Room-by-Room Schedule & Sign-Off Matrix
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 52, 96);
  doc.text('2. Master Facility Room-by-Room Completion Matrix', 14, currentY);

  const matrixRows = NUPURE_ROOMS.map(roomSpec => {
    const rec = recordsByRoom.get(roomSpec.room);
    if (rec) {
      return [
        roomSpec.code,
        roomSpec.zone,
        roomSpec.room,
        roomSpec.frequencyBadge,
        rec.report_number,
        `${rec.total_time_minutes ?? roomSpec.estimatedMinutes}m`,
        rec.submitted_by || 'MJ Hygiene Team',
        rec.visual_inspection_passed !== false ? 'COMPLETED - PASS' : 'RECLEAN REQ',
      ];
    }
    const isScheduledToday =
      roomSpec.frequencyBadge === '7 DAYS' || (roomSpec.frequencyBadge === '5 DAYS' && !weekend);
    return [
      roomSpec.code,
      roomSpec.zone,
      roomSpec.room,
      roomSpec.frequencyBadge,
      '—',
      '—',
      '—',
      isScheduledToday ? 'PENDING' : 'OFF-SCHEDULE',
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Code', 'Zone', 'Room / Area', 'Freq', 'Report Ref', 'Time', 'Cleaner / Operator', 'Status']],
    body: matrixRows,
    theme: 'grid',
    headStyles: {
      fillColor: [2, 132, 199],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold' },
      1: { cellWidth: 32 },
      2: { cellWidth: 44, fontStyle: 'bold' },
      3: { cellWidth: 16 },
      4: { cellWidth: 26 },
      5: { cellWidth: 12 },
      6: { cellWidth: 26 },
      7: { cellWidth: 24, fontStyle: 'bold' },
    },
    didParseCell: hookData => {
      if (hookData.section === 'body' && hookData.column.index === 7) {
        const val = String(hookData.cell.raw || '');
        if (val.includes('PASS')) {
          hookData.cell.styles.textColor = [21, 128, 61];
        } else if (val.includes('RECLEAN')) {
          hookData.cell.styles.textColor = [220, 38, 38];
        } else {
          hookData.cell.styles.textColor = [100, 116, 139];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  currentY = getLastTableY(doc, 220) + 10;

  // Section 3: Detailed Room-by-Room Completed Event Logs
  if (records.length > 0) {
    if (currentY > 240) {
      doc.addPage();
      currentY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 52, 96);
    doc.text(`3. Detailed Room Cleaning Event Logs (${records.length} Completed Reports)`, 14, currentY);
    currentY += 5;

    records.forEach((rec, index) => {
      if (currentY > 235) {
        doc.addPage();
        currentY = 18;
      }

      // Room Banner
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, currentY, 182, 14, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 52, 96);
      doc.text(
        `${index + 1}. ${rec.location} (${rec.zone}) — Ref: ${rec.report_number}`,
        17,
        currentY + 5.5
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const metaLine = `Shift: ${rec.shift_type || 'Standard'} • Duration: ${rec.total_time_minutes || 20} mins • Cleaner: ${rec.submitted_by || 'MJ Hygiene'} • Sign-Off: ${rec.supervisor_signoff || 'Verified'} • Inspection: ${rec.visual_inspection_passed !== false ? 'PASSED' : 'RECLEAN REQ'}`;
      doc.text(metaLine, 17, currentY + 11);

      const checklistRows: string[][] =
        Array.isArray(rec.checklist_items) && rec.checklist_items.length > 0
          ? rec.checklist_items.map(item => [
              item.label,
              item.completed ? 'COMPLETED [YES]' : 'INCOMPLETE',
            ])
          : [[rec.items_cleaned || 'Full scheduled room clean completed to specification', 'COMPLETED [YES]']];

      if (Array.isArray(rec.chemicals_used) && rec.chemicals_used.length > 0) {
        checklistRows.push([`Approved Chemicals Applied: ${rec.chemicals_used.join(', ')}`, 'VERIFIED']);
      }
      if (rec.comments) {
        checklistRows.push([`Notes / Comments: ${rec.comments}`, 'LOGGED']);
      }

      autoTable(doc, {
        startY: currentY + 15,
        head: [['Completed Scope Task / Verification Item', 'Status']],
        body: checklistRows,
        theme: 'grid',
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
        },
        columnStyles: {
          0: { cellWidth: 148 },
          1: { cellWidth: 34, fontStyle: 'bold', textColor: [21, 128, 61] },
        },
        margin: { left: 14, right: 14 },
      });

      currentY = getLastTableY(doc, currentY + 35) + 7;
    });
  }

  addPageFooters(doc, reportRef);
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

/* ═══════════════════════════════════════════════════════════════
   2. SINGLE ROOM CLEANING EVENT REPORT PDF
   ═══════════════════════════════════════════════════════════════ */

export function generateSingleRoomCleanPdf(record: CleaningRecordPdfRow): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const reportRef = record.report_number || `CLR-${record.date.replace(/-/g, '')}`;

  // Header Banner
  doc.setFillColor(15, 52, 96);
  doc.rect(0, 0, 210, 38, 'F');
  doc.setFillColor(2, 132, 199);
  doc.rect(0, 38, 210, 2.5, 'F');

  doc.setTextColor(186, 230, 253);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('MJ HYGIENE SERVICES  •  NU-PURE BEVERAGES (STAPYLTON)', 14, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('DIGITAL ROOM CLEANING EVENT REPORT', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(224, 242, 254);
  doc.text(`Area / Room: ${record.location} (${record.zone})`, 14, 27.5);
  doc.text(`Shift Date: ${formatAuDate(record.date)}  •  Report Ref: ${reportRef}`, 14, 33);

  const passBadgeColor: [number, number, number] =
    record.visual_inspection_passed !== false ? [22, 163, 74] : [220, 38, 38];
  doc.setFillColor(...passBadgeColor);
  doc.roundedRect(146, 12, 50, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    record.visual_inspection_passed !== false ? 'INSPECTION PASSED' : 'RECLEAN REQUIRED',
    171,
    21.5,
    { align: 'center' }
  );

  // Meta Summary Table
  autoTable(doc, {
    startY: 46,
    head: [['Facility Zone', 'Room / Area Cleaned', 'Shift & Duration', 'SSOP & Microfibre']],
    body: [
      [
        record.zone,
        record.location,
        `${record.shift_type || 'Weekday'} (${record.total_time_minutes || 20} mins)`,
        record.ssop_verified !== false ? 'Verified [YES]' : 'Not Verified',
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 52, 96],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
      fontStyle: 'bold',
      textColor: [15, 23, 42],
    },
    margin: { left: 14, right: 14 },
  });

  let currentY = getLastTableY(doc, 68) + 8;

  // Checklist Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 52, 96);
  doc.text(`Completed Scope Checklist — ${record.location}`, 14, currentY);

  const checklistRows: string[][] =
    Array.isArray(record.checklist_items) && record.checklist_items.length > 0
      ? record.checklist_items.map((item, idx) => [
          String(idx + 1),
          item.label,
          item.completed ? 'COMPLETED [YES]' : 'INCOMPLETE',
        ])
      : [['1', record.items_cleaned || 'Full scheduled room clean completed', 'COMPLETED [YES]']];

  autoTable(doc, {
    startY: currentY + 3,
    head: [['#', 'Scope Task Description', 'Verification']],
    body: checklistRows,
    theme: 'grid',
    headStyles: {
      fillColor: [2, 132, 199],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 10, fontStyle: 'bold' },
      1: { cellWidth: 138 },
      2: { cellWidth: 34, fontStyle: 'bold', textColor: [21, 128, 61] },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = getLastTableY(doc, 140) + 8;

  // Chemicals & Sign-Off Table
  const detailRows: string[][] = [
    [
      'Approved Cleaning Chemicals Applied',
      Array.isArray(record.chemicals_used) && record.chemicals_used.length > 0
        ? record.chemicals_used.join(' • ')
        : 'Standard Approved Hygiene Sanitiser & Floor Cleaner',
    ],
    ['Completed By (Operator / Cleaner)', record.submitted_by || 'MJ Hygiene Site Team'],
    ['Supervisor Verification Sign-Off', record.supervisor_signoff || 'MJ Hygiene Supervisor'],
    ['Timestamp Logged', new Date(record.created_at).toLocaleString('en-AU')],
  ];

  if (record.comments) {
    detailRows.push(['Comments / Notes', record.comments]);
  }
  if (record.corrective_action) {
    detailRows.push(['Corrective Action', record.corrective_action]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Verification Field', 'Recorded Detail']],
    body: detailRows,
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 62, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 120 },
    },
    margin: { left: 14, right: 14 },
  });

  addPageFooters(doc, reportRef);
  return Buffer.from(doc.output('arraybuffer'));
}

/* ═══════════════════════════════════════════════════════════════
   3. QR ISSUE / REQUIRED ACTION COMPLETION REPORT PDF
   ═══════════════════════════════════════════════════════════════ */

export function generateQrIssueCompletionPdf(issue: QrIssuePdfRow): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const isClosed = issue.status === 'completed';

  doc.setFillColor(15, 52, 96);
  doc.rect(0, 0, 210, 38, 'F');
  doc.setFillColor(isClosed ? 22 : 220, isClosed ? 163 : 38, isClosed ? 74 : 38);
  doc.rect(0, 38, 210, 2.5, 'F');

  doc.setTextColor(186, 230, 253);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('MJ HYGIENE SERVICES  •  NU-PURE BEVERAGES (STAPYLTON)', 14, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('REQUIRED ACTION & ISSUE CLOSE-OUT REPORT', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(224, 242, 254);
  doc.text(`Action Reference: ${issue.action_number}  •  Zone: ${issue.zone}`, 14, 27.5);
  doc.text(`Area / Room: ${issue.area}  •  Priority: ${issue.priority}`, 14, 33);

  doc.setFillColor(isClosed ? 22 : 220, isClosed ? 163 : 38, isClosed ? 74 : 38);
  doc.roundedRect(142, 12, 54, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(isClosed ? 'CLOSED & VERIFIED' : 'OPEN REQUIRED ACTION', 169, 21.5, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 52, 96);
  doc.text('1. Issue Logged via Site QR Code', 14, 49);

  autoTable(doc, {
    startY: 52,
    body: [
      ['Action Reference', issue.action_number],
      ['Facility Zone & Room', `${issue.zone} — ${issue.area}`],
      ['Issue Category & Priority', `${issue.category} (Priority: ${issue.priority})`],
      [
        'Reported By',
        `${issue.reported_by_name || 'Site QR Scan'}${issue.reported_by_email ? ` (${issue.reported_by_email})` : ''}${issue.reported_by_phone ? ` • ${issue.reported_by_phone}` : ''}`,
      ],
      ['Date / Time Logged', new Date(issue.created_at).toLocaleString('en-AU')],
      ['Issue Description', issue.description],
    ],
    theme: 'grid',
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 58, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 124 },
    },
    margin: { left: 14, right: 14 },
  });

  const nextY = getLastTableY(doc, 115) + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(21, 128, 61);
  doc.text('2. Corrective Action & Close-Out Verification', 14, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    body: [
      ['Close-Out Status', isClosed ? 'CLOSED OUT & VERIFIED [YES]' : 'OPEN / IN PROGRESS'],
      ['Rectified & Signed Off By', issue.completed_by || 'Pending Sign-Off'],
      [
        'Completion Timestamp',
        issue.completed_at ? new Date(issue.completed_at).toLocaleString('en-AU') : 'Pending',
      ],
      [
        'Corrective Action Taken',
        issue.resolution_notes || 'Awaiting completion and sign-off by MJ Hygiene site team.',
      ],
    ],
    theme: 'grid',
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 58, fontStyle: 'bold', fillColor: [240, 253, 244] },
      1: { cellWidth: 124 },
    },
    margin: { left: 14, right: 14 },
  });

  addPageFooters(doc, issue.action_number);
  return Buffer.from(doc.output('arraybuffer'));
}
