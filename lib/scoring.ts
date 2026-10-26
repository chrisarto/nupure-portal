import type { FormSection, FormResponses } from './types';

export interface SectionScore {
  sectionId: string;
  title: string;
  total: number;
  pass: number;
  fail: number;
  reclean: number;
  score: number; // 0-100
}

export interface SubmissionScores {
  total: number;
  pass: number;
  fail: number;
  reclean: number;
  overallScore: number; // 0-100, 1dp
  sectionScores: SectionScore[];
}

/**
 * Compute overall and per-section scores from form responses.
 * Scoring: Pass=1.0, Re-Clean=0.5, Fail=0.0
 * Unassessed items are excluded from the denominator.
 */
export function computeScores(
  sections: FormSection[],
  responses: FormResponses
): SubmissionScores {
  let totalPass = 0;
  let totalFail = 0;
  let totalReclean = 0;
  let totalAssessed = 0;

  const sectionScores: SectionScore[] = sections.map((section) => {
    let sPass = 0, sFail = 0, sReclean = 0, sTotal = 0;
    for (const item of section.items) {
      const result = responses[item.id]?.result ?? null;
      if (result === null) continue;
      sTotal++;
      if (result === 'pass') sPass++;
      else if (result === 'fail') sFail++;
      else if (result === 'reclean') sReclean++;
    }
    const sScore = sTotal === 0 ? 100 : Math.round(((sPass + sReclean * 0.5) / sTotal) * 1000) / 10;
    totalPass += sPass;
    totalFail += sFail;
    totalReclean += sReclean;
    totalAssessed += sTotal;
    return { sectionId: section.id, title: section.title, total: sTotal, pass: sPass, fail: sFail, reclean: sReclean, score: sScore };
  });

  const overallScore =
    totalAssessed === 0
      ? 100
      : Math.round(((totalPass + totalReclean * 0.5) / totalAssessed) * 1000) / 10;

  return {
    total: totalAssessed,
    pass: totalPass,
    fail: totalFail,
    reclean: totalReclean,
    overallScore,
    sectionScores,
  };
}

/** Returns a CSS color class name based on score */
export function scoreColor(score: number): string {
  if (score >= 95) return 'scoreExcellent';
  if (score >= 85) return 'scoreGood';
  if (score >= 70) return 'scoreWarning';
  return 'scorePoor';
}

/** Returns emoji for score */
export function scoreEmoji(score: number): string {
  if (score >= 95) return '✅';
  if (score >= 85) return '🟡';
  if (score >= 70) return '🟠';
  return '🔴';
}
