// Payslip PDF parser — best-effort, on-device extraction of salary components
// from a text-based payslip PDF. Produces a pre-fill the user reviews & confirms;
// never auto-saves. The line→component logic lives in the pdf-free ./payslipScan
// module (unit-testable); this file only handles the PDF text extraction.
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SalaryComponent } from '../types';
import { scanPayslipLines } from './payslipScan';

// Reuse the same worker setup as the bank-statement parser.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ParsedPayslip {
  components: SalaryComponent[];
  gross?: number;
  net?: number;
  needsPassword?: boolean;
  wrongPassword?: boolean;
  error?: string;
}

async function extractLines(file: File, password?: string): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const task = pdfjsLib.getDocument({ data: buffer, ...(password ? { password } : {}) });
  const pdf = await task.promise;
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, Array<{ x: number; str: string }>>();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const t = item as TextItem;
      if (!t.str.trim()) continue;
      const y = Math.round(t.transform[5] / 3) * 3; // 3px row tolerance
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: t.transform[4], str: t.str });
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const text = rows.get(y)!.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
    }
  }
  return lines;
}

export async function parsePayslipPdf(file: File, password?: string): Promise<ParsedPayslip> {
  let lines: string[];
  try {
    lines = await extractLines(file, password);
  } catch (e) {
    const msg = String((e as Error)?.message || e).toLowerCase();
    if (msg.includes('password')) {
      return { components: [], needsPassword: !password, wrongPassword: !!password };
    }
    return { components: [], error: 'Could not read this PDF. Try a text-based payslip export.' };
  }

  if (lines.join('').replace(/[^0-9]/g, '').length < 6) {
    return { components: [], error: 'This looks like a scanned image PDF. Use a text-based payslip.' };
  }

  const { components, gross, net } = scanPayslipLines(lines);
  if (components.length === 0 && gross == null && net == null) {
    return { components: [], error: 'No salary components found. You can still enter them manually.' };
  }
  return { components, gross, net };
}
