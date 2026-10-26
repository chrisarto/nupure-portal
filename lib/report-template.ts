import type { SubmissionDetail } from './types';

interface TemplateSection {
  id: string;
  title: string;
  items: Array<{ id: string; label: string }>;
}

function scoreColor(score: number): string {
  if (score >= 95) return '#16a34a';
  if (score >= 85) return '#d97706';
  if (score >= 70) return '#ea580c';
  return '#dc2626';
}

function resultBadge(result: string): string {
  if (result === 'pass') return `<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">&check; Pass</span>`;
  if (result === 'fail') return `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">&times; Fail</span>`;
  if (result === 'reclean') return `<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">&#8635; Re-Clean</span>`;
  return '';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function generateReportHTML(
  submission: SubmissionDetail,
  sections: TemplateSection[]
): string {
  const overallScore = submission.overall_score ?? 0;
  const sectionScores = submission.section_scores ?? {};
  const responses = submission.responses ?? {};

  let sectionsHTML = sections.map((section) => {
    const sectionItems = section.items.filter(
      (item) => responses[item.id]?.result != null
    );
    if (sectionItems.length === 0) return '';

    const sc = sectionScores[section.id];
    const sScore = sc?.score ?? null;

    const itemsHTML = sectionItems.map((item) => {
      const resp = responses[item.id];
      const result = resp?.result ?? '';
      const borderColor = result === 'pass' ? '#16a34a' : result === 'fail' ? '#dc2626' : '#d97706';
      return `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px 12px;border-left:3px solid ${borderColor};">
          ${item.label}
          ${resp?.comment ? `<div style="font-size:11px;color:#64748b;margin-top:3px;font-style:italic;">${resp.comment}</div>` : ''}
        </td>
        <td style="padding:8px 12px;text-align:center;white-space:nowrap;">${resultBadge(result)}</td>
        ${resp?.photoUrl ? `<td style="padding:8px 12px;text-align:center;"><img src="${resp.photoUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;" /></td>` : '<td></td>'}
      </tr>`;
    }).join('');

    return `<div style="margin-bottom:20px;break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:10px 14px;border-radius:6px 6px 0 0;border:1px solid #e2e8f0;border-bottom:none;">
        <h3 style="margin:0;font-size:13px;font-weight:700;color:#0f172a;">${section.title}</h3>
        ${sScore !== null ? `<span style="font-size:13px;font-weight:800;color:${scoreColor(sScore)};">${sScore}%</span>` : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
        <colgroup><col style="width:70%"><col style="width:15%"><col style="width:15%"></colgroup>
        ${itemsHTML}
      </table>
    </div>`;
  }).join('');

  // Fallback for live-ingested reports (like Swabs) that don't have predefined template sections
  if (!sectionsHTML && Object.keys(responses).length > 0) {
    const keys = Object.keys(responses).filter(k => k !== 'global_photos' && responses[k]?.result != null);
    if (keys.length > 0) {
      const itemsHTML = keys.map(k => {
        const resp = responses[k];
        const result = resp.result ?? '';
        const label = (resp as any)._legacyText || k;
        const borderColor = result === 'pass' ? '#16a34a' : result === 'fail' ? '#dc2626' : '#d97706';
        return `<tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:8px 12px;border-left:3px solid ${borderColor};">
            ${label}
          </td>
          <td style="padding:8px 12px;text-align:center;white-space:nowrap;">${resultBadge(result)}</td>
          <td></td>
        </tr>`;
      }).join('');
      
      sectionsHTML = `<div style="margin-bottom:20px;break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:10px 14px;border-radius:6px 6px 0 0;border:1px solid #e2e8f0;border-bottom:none;">
          <h3 style="margin:0;font-size:13px;font-weight:700;color:#0f172a;">Inspection Items</h3>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
          <colgroup><col style="width:70%"><col style="width:15%"><col style="width:15%"></colgroup>
          ${itemsHTML}
        </table>
      </div>`;
    }
  }

  const scoreSummaryRows = sections
    .filter((s) => sectionScores[s.id] !== undefined)
    .map((s) => {
      const sc = sectionScores[s.id];
      return `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:6px 10px;font-size:12px;">${s.title}</td>
        <td style="padding:6px 10px;text-align:center;font-size:12px;color:#16a34a;font-weight:600;">${sc.pass ?? 0}</td>
        <td style="padding:6px 10px;text-align:center;font-size:12px;color:#d97706;font-weight:600;">${sc.reclean ?? 0}</td>
        <td style="padding:6px 10px;text-align:center;font-size:12px;color:#dc2626;font-weight:600;">${sc.fail ?? 0}</td>
        <td style="padding:6px 10px;text-align:center;font-size:12px;font-weight:700;color:${scoreColor(sc.score ?? 0)};">${sc.score ?? '—'}%</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${submission.template_name}</title>
<style>
* { margin:0;padding:0;box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#0f172a;background:white; }
@page { margin:15mm 12mm;size:A4 portrait; }
@media print { body { -webkit-print-color-adjust:exact;print-color-adjust:exact; } }
</style>
</head>
<body>
<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:white;padding:24px 28px;margin-bottom:20px;border-radius:8px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;opacity:0.7;text-transform:uppercase;margin-bottom:4px;">Nu-Pure Compliance Portal</div>
      <h1 style="font-size:20px;font-weight:800;margin-bottom:6px;">${submission.template_name}</h1>
      <div style="font-size:11px;opacity:0.8;">${formatDate(submission.submitted_at ?? submission.created_at)}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:36px;font-weight:900;line-height:1;color:${scoreColor(overallScore)};">${overallScore}%</div>
      <div style="font-size:10px;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">Overall Score</div>
    </div>
  </div>
</div>

<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:4px;">Inspector</div>
    <div style="font-size:13px;font-weight:600;">${submission.submitted_by || '—'}</div>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:4px;">Area / Location</div>
    <div style="font-size:13px;font-weight:600;">${submission.area || '—'}</div>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:4px;">Reference</div>
    <div style="font-size:11px;font-family:monospace;">${submission.id.slice(0,8).toUpperCase()}</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;text-align:center;">
    <div style="font-size:24px;font-weight:800;color:#16a34a;">${submission.score_pass ?? 0}</div>
    <div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;">Pass</div>
  </div>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;text-align:center;">
    <div style="font-size:24px;font-weight:800;color:#d97706;">${submission.score_reclean ?? 0}</div>
    <div style="font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;">Re-Clean</div>
  </div>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;text-align:center;">
    <div style="font-size:24px;font-weight:800;color:#dc2626;">${submission.score_fail ?? 0}</div>
    <div style="font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;">Fail</div>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;text-align:center;">
    <div style="font-size:24px;font-weight:800;color:#0f172a;">${submission.score_total ?? 0}</div>
    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Assessed</div>
  </div>
</div>

${scoreSummaryRows ? `<div style="margin-bottom:20px;break-inside:avoid;">
  <h2 style="font-size:13px;font-weight:700;margin-bottom:8px;border-bottom:2px solid #0f172a;padding-bottom:6px;">Section Score Summary</h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
    <thead><tr style="background:#f1f5f9;">
      <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;">Section</th>
      <th style="padding:7px 10px;text-align:center;font-size:11px;font-weight:700;color:#16a34a;">Pass</th>
      <th style="padding:7px 10px;text-align:center;font-size:11px;font-weight:700;color:#d97706;">Re-Clean</th>
      <th style="padding:7px 10px;text-align:center;font-size:11px;font-weight:700;color:#dc2626;">Fail</th>
      <th style="padding:7px 10px;text-align:center;font-size:11px;font-weight:700;">Score</th>
    </tr></thead>
    <tbody>${scoreSummaryRows}</tbody>
  </table>
</div>` : ''}

<h2 style="font-size:13px;font-weight:700;margin-bottom:12px;border-bottom:2px solid #0f172a;padding-bottom:6px;">Detailed Inspection Findings</h2>
${sectionsHTML}

${submission.notes ? `<div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;break-inside:avoid;">
  <h3 style="font-size:12px;font-weight:700;margin-bottom:6px;">Notes</h3>
  <p style="font-size:12px;color:#334155;line-height:1.6;">${submission.notes}</p>
</div>` : ''}

<div style="margin-top:28px;border-top:1px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;">
  <span>Nu-Pure Compliance Portal — Generated ${new Date().toLocaleDateString('en-AU')}</span>
  <span>Report ID: ${submission.id.slice(0,8).toUpperCase()}</span>
</div>
</body></html>`;
}
