import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { StaffRecord } from '@/types';
import { MONTHS } from '@/constants/enums';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// ── Text Extraction ─────────────────────────────────────────────────────
// pdfjs-dist returns text items with X/Y coordinates.
// We sort by Y (descending = top of page first) then X (left→right)
// and group into lines by proximity, reconstructing newline-separated text
// that matches what pdfplumber produces.

async function extractPages(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Filter to real text items only (not marked-content markers)
    const items = content.items.filter(
      (item): item is TextItem => 'str' in item && (item as TextItem).str.length > 0,
    );

    if (items.length === 0) {
      pages.push('');
      continue;
    }

    // Sort top→bottom (Y descending in PDF coord space), then left→right
    const sorted = [...items].sort((a, b) => {
      const dy = b.transform[5] - a.transform[5];
      if (Math.abs(dy) > 3) return dy;           // different lines
      return a.transform[4] - b.transform[4];    // same line: left→right
    });

    // Group into lines: new line when Y shifts by more than 3 pts
    const lines: string[] = [];
    let lineTokens: string[] = [];
    let lastY = sorted[0].transform[5];

    for (const item of sorted) {
      const y = item.transform[5];
      if (Math.abs(y - lastY) > 3) {
        if (lineTokens.length) lines.push(lineTokens.join(' '));
        lineTokens = [];
        lastY = y;
      }
      const t = item.str.trim();
      if (t) lineTokens.push(t);
    }
    if (lineTokens.length) lines.push(lineTokens.join(' '));

    pages.push(lines.join('\n'));
  }

  return pages;
}

// ── Block Splitting ─────────────────────────────────────────────────────
// Each salary slip starts with "SNO: <number>". Split on that marker,
// discard the pre-first-SNO header fragment.

function splitBlocks(pages: string[]): string[] {
  const blocks: string[] = [];
  for (const page of pages) {
    const parts = page.split(/SNO:\s*\d+/);
    for (let i = 1; i < parts.length; i++) {
      const b = parts[i].trim();
      if (b) blocks.push(b);
    }
  }
  return blocks;
}

// ── Per-block Regex Extraction ──────────────────────────────────────────
// Mirrors the Python app exactly: re.search() on each field in the slip text.

interface RawSlip {
  empId: string;
  staffName: string;
  designation: string;
  payScale: string;
  ddoCode: string;
  daysWorked: number;
  nextIncrementDate: string;
  group: string;
  basicPay: number;
  daAmount: number;
  hraAmount: number;
  ir: number;
  sfn: number;
  p: number;
  spayTypist: number;
  itDeduction: number;
  ptDeduction: number;
  gslic: number;
  lic: number;
  fbf: number;
  gross: number;
  netSalary: number;
  totalDeductions: number;
  bankAccount: string;
  month: string;
  year: number;
}

function n(re: RegExp, text: string): number {
  const m = text.match(re);
  return m ? parseInt(m[1], 10) : 0;
}

function s(re: RegExp, text: string): string {
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

function parseBlock(slip: string): RawSlip | null {
  const empId = s(/EMP No\s+(\d+)/, slip);
  if (!empId) return null;

  const dateM = slip.match(/Month Of\s+([A-Za-z]+)\s+(\d{4})/);
  const rawMonth = dateM ? dateM[1] : '';
  const month = rawMonth.toUpperCase();
  const year = dateM ? parseInt(dateM[2], 10) : 0;

  const psM = slip.match(/Pay Scale\s*:\s*(\d+)-(\d+)/);

  return {
    empId,
    staffName:         s(/Sri\s*\/\s*Smt:?\s*([A-Z][A-Z\s.]+?)(?=\s*Days Worked|\s*Designation|\s*PAN)/s, slip),
    designation:       s(/Designation:?\s*([A-Z][A-Z\s()]+?)(?=\s*Pay Scale|\s*Group|\s*Basic)/s, slip),
    payScale:          psM ? `${psM[1]}-${psM[2]}` : '',
    ddoCode:           s(/DDO Code\s*:\s*(\w+)/, slip),
    daysWorked:        n(/Days Worked:\s*(\d+)/, slip),
    nextIncrementDate: s(/Next Increment Date:\s*([A-Za-z]+\s+\d{4})/, slip),
    group:             s(/Group\s*:\s*([A-Z])/, slip),
    basicPay:          n(/Basic\s*:\s*(\d+)/, slip),
    daAmount:          n(/\bDA\s+(\d+)/, slip),
    hraAmount:         n(/\bHRA\s+(\d+)/, slip),
    ir:                n(/\bIR\s+(\d+)/, slip),
    sfn:               n(/\bSFN\s+(\d+)/, slip),
    p:                 n(/\bP\s+(\d+)/, slip),
    spayTypist:        n(/SPAY-TYPIST\s+(\d+)/, slip),
    itDeduction:       n(/\bIT\s+(\d+)/, slip),
    ptDeduction:       n(/\bPT\s+(\d+)/, slip),
    gslic:             n(/\bGSLIC\s+(\d+)/, slip),
    lic:               n(/(?<!GS)LIC\s+(\d+)/, slip),
    fbf:               n(/\bFBF\s+(\d+)/, slip),
    gross:             n(/Gross Salary:\s*Rs\.\s*(\d+)/, slip),
    netSalary:         n(/Net Salary\s*:\s*Rs\.\s*(\d+)/, slip),
    totalDeductions:   n(/sum of deductions &Recoveries\s*:\s*Rs\.\s*(\d+)/, slip),
    bankAccount:       s(/Bank A\/C Number:\s*(\d+)/, slip),
    month:             MONTHS.includes(month) ? month : rawMonth,
    year,
  };
}

// ── Staff Matching ──────────────────────────────────────────────────────

export interface ParsedSlip extends RawSlip {
  staffId: string;
  matched: boolean;
}

// Staff records store "100156349", PDF gives "0100156349" — strip leading zeros to match.
function normEmpId(id: string): string {
  return id.trim().replace(/^0+/, '') || id.trim();
}

function matchSlips(rawSlips: RawSlip[], staffList: StaffRecord[]): ParsedSlip[] {
  const map = new Map<string, string>();
  for (const s of staffList) {
    if (s.id && s.empId) map.set(normEmpId(s.empId), s.id);
  }
  return rawSlips.map((r) => {
    const key = normEmpId(r.empId);
    return { ...r, staffId: map.get(key) ?? '', matched: map.has(key) };
  });
}

// ── Public Entry Point ──────────────────────────────────────────────────

export async function parseSalaryPdf(
  file: File,
  staffList: StaffRecord[],
): Promise<ParsedSlip[]> {
  const pages = await extractPages(file);
  const blocks = splitBlocks(pages);
  const rawSlips = blocks.map(parseBlock).filter((r): r is RawSlip => r !== null);
  return matchSlips(rawSlips, staffList);
}
