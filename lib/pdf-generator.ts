import type { SubmissionDetail } from './types';
import { generateReportHTML } from './report-template';

interface TemplateSection {
  id: string;
  title: string;
  items: Array<{ id: string; label: string }>;
}

export async function generateSubmissionPDF(
  submission: SubmissionDetail,
  sections: TemplateSection[]
): Promise<Buffer> {
  const html = generateReportHTML(submission, sections);

  // Dynamic require to avoid Next.js bundling issues with native modules
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const htmlPdf = require('html-pdf-node') as {
    generatePdf: (
      file: { content: string },
      options: Record<string, unknown>
    ) => Promise<Buffer>;
  };

  return htmlPdf.generatePdf(
    { content: html },
    {
      format: 'A4',
      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
      printBackground: true,
    }
  );
}
