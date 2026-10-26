export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface PatternIssue {
  itemId: string;
  itemLabel: string;
  sectionTitle: string;
  failCount: number;
  totalCount: number;
  failRate: number; // 0-100
  results: string[]; // last N results for this item
}

export interface TrendPoint {
  date: string; // ISO
  score: number;
  submissionId: string;
}

export interface AnalysisResult {
  patterns: PatternIssue[];
  trend: TrendPoint[];
  averageScore: number | null;
  previousScore: number | null;
  scoreDelta: number | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const templateSlug = searchParams.get('template_slug') ?? '';
  const excludeId = searchParams.get('exclude') ?? '';

  if (!templateSlug) return NextResponse.json({ error: 'template_slug required' }, { status: 400 });

  const supabase = await createClient();

  // Fetch last 20 submitted reports for this template (excluding current)
  const { data: rows, error } = await supabase
    .from('nupure_form_submissions')
    .select('id, submitted_at, created_at, overall_score, responses, section_scores')
    .eq('template_slug', templateSlug)
    .eq('status', 'submitted')
    .neq('id', excludeId)
    .order('submitted_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const submissions = rows ?? [];

  // Build trend data
  const trend: TrendPoint[] = submissions
    .filter(r => r.overall_score !== null)
    .map(r => ({
      date: (r.submitted_at ?? r.created_at) as string,
      score: r.overall_score as number,
      submissionId: r.id as string,
    }))
    .reverse();

  // Average and previous score
  const scores = submissions.map(r => r.overall_score as number).filter(s => s !== null);
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const previousScore = scores.length > 0 ? scores[0] : null;

  // Pattern analysis — aggregate item results across all submissions
  const itemAgg: Record<string, { label: string; section: string; results: string[] }> = {};

  for (const sub of submissions) {
    const responses = (sub.responses ?? {}) as Record<string, { result?: string; comment?: string; _label?: string; _area?: string }>;
    for (const [itemId, resp] of Object.entries(responses)) {
      if (!resp?.result && !(resp as any).compliance) continue;
      
      const result = resp.result || ((resp as any).compliance === 'U' ? 'fail' : (resp as any).compliance === 'M' ? 'reclean' : 'pass');
      
      if (!itemAgg[itemId]) {
        itemAgg[itemId] = { 
          label: resp._label || itemId, 
          section: resp._area || '', 
          results: [] 
        };
      }
      itemAgg[itemId].results.push(result);
    }
  }

  // Calculate fail rates and filter to items with >= 30% fail/reclean rate across >= 3 occurrences
  const patterns: PatternIssue[] = Object.entries(itemAgg)
    .map(([itemId, agg]) => {
      const total = agg.results.length;
      const failCount = agg.results.filter(r => r === 'fail' || r === 'reclean').length;
      const failRate = total > 0 ? Math.round((failCount / total) * 100) : 0;
      return {
        itemId,
        itemLabel: agg.label,
        sectionTitle: agg.section,
        failCount,
        totalCount: total,
        failRate,
        results: agg.results.slice(0, 10),
      };
    })
    .filter(p => p.totalCount >= 3 && p.failRate >= 30)
    .sort((a, b) => b.failRate - a.failRate);

  return NextResponse.json({
    data: {
      patterns,
      trend,
      averageScore,
      previousScore,
      scoreDelta:
        previousScore !== null && averageScore !== null
          ? averageScore - previousScore
          : null,
    } satisfies AnalysisResult,
  });
}
