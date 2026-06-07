import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ── Inline types (computed shapes from Dashboard) ─────────────────────────────

type MatrixRow = {
  desig: string;
  cells: { sanctioned: number; filled: number; vacant: number }[];
  totSanctioned: number;
  totVacant: number;
};

type SubtotalRow = {
  cells: { sanctioned: number; vacant: number }[];
  totSanctioned: number;
  totVacant: number;
};

export type VacancyMatrixData = {
  teachingRows: MatrixRow[];
  nonTeachingRows: MatrixRow[];
  otherRows: MatrixRow[];
  teachingSub: SubtotalRow;
  nonTeachingSub: SubtotalRow;
  grandTotal: SubtotalRow;
};

export type DeptVacancyStat = {
  dept: string;
  sanctioned: number; sanctionedT: number; sanctionedNT: number;
  inService: number; filledT: number; filledNT: number;
  vacant: number; vacantT: number; vacantNT: number;
};

export type CategoryStat = {
  dept: string;
  tInSvc: number; ntInSvc: number;
};

export type CatDeptRow = {
  cat: string;
  deptCounts: Record<string, number>;
  total: number;
};

// ── PDF shared ────────────────────────────────────────────────────────────────

const M  = 7;
const FS = 9;
const CP = { top: 1.6, right: 2.5, bottom: 1.6, left: 2.5 };

const HC : [number, number, number] = [30,  64, 175];
const AC : [number, number, number] = [248, 250, 252];
const LC : [number, number, number] = [226, 232, 240];
const TC : [number, number, number] = [15,  23,  42];
const SC : [number, number, number] = [100, 116, 139];
const FC : [number, number, number] = [148, 163, 184];

const RED  : [number, number, number] = [185,  28,  28];
const GREEN: [number, number, number] = [ 22, 163,  74];
const GREY : [number, number, number] = [200, 200, 200];
const T_BG : [number, number, number] = [237, 233, 254];
const T_FG : [number, number, number] = [124,  58, 237];
const NT_BG: [number, number, number] = [254, 243, 199];
const NT_FG: [number, number, number] = [180,  83,   9];
const GT_BG: [number, number, number] = [224, 242, 254];
const GT_FG: [number, number, number] = [  3, 105, 161];

function ds() {
  return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pdfHeader(doc: jsPDF, title: string): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TC);
  doc.text(title, M, 9);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SC);
  doc.text(`Generated ${ds()}`, W - M, 9, { align: 'right' });
  doc.setTextColor(0);
  doc.setDrawColor(...LC);
  doc.setLineWidth(0.2);
  doc.line(M, 11.5, W - M, 11.5);
  return 14;
}

function pdfFooter(doc: jsPDF, n: number) {
  const total = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFontSize(6.5);
  doc.setTextColor(...FC);
  doc.text('Sanjay Memorial Polytechnic, Sagar', M, H - 2.5);
  doc.text(`Page ${n} of ${total}`, W - M, H - 2.5, { align: 'right' });
  doc.setTextColor(0);
}

// Cell helpers
type CellObj = { content: string | number; styles: Record<string, unknown> };
type Cell = string | number | CellObj;

function vacCell(vacant: number, sanctioned: number): Cell {
  if (sanctioned === 0) return { content: '—', styles: { textColor: GREY, halign: 'center' } };
  if (vacant === 0)    return { content: '0', styles: { textColor: GREEN, halign: 'center', fontStyle: 'bold' } };
  return { content: vacant, styles: { textColor: RED, halign: 'center', fontStyle: 'bold' } };
}

function totCell(v: number, bg: [number,number,number], fg: [number,number,number]): CellObj {
  return { content: v > 0 ? v : '0', styles: { fillColor: bg, textColor: v > 0 ? RED : fg, fontStyle: 'bold', halign: 'center' } };
}

function labelCell(text: string, bg: [number,number,number], fg: [number,number,number]): CellObj {
  return { content: text, styles: { fillColor: bg, textColor: fg, fontStyle: 'bold', halign: 'left' } };
}

function sectionRow(label: string, span: number, bg: [number,number,number], fg: [number,number,number]): Cell[] {
  return [{ content: label, colSpan: span, styles: { fillColor: bg, textColor: fg, fontStyle: 'bold' } } as CellObj];
}

// ── 1. Vacancy Matrix PDF ─────────────────────────────────────────────────────

export function exportVacancyMatrixPdf(data: VacancyMatrixData, departments: string[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const startY = pdfHeader(doc, 'Dept × Designation Vacancy');
  const span = departments.length + 2;

  const body: Cell[][] = [];

  function dataRow(r: MatrixRow): Cell[] {
    return [
      r.desig,
      ...r.cells.map(c => vacCell(c.vacant, c.sanctioned)),
      r.totVacant > 0
        ? { content: r.totVacant, styles: { textColor: RED, fontStyle: 'bold', halign: 'center' } }
        : { content: '0', styles: { textColor: GREY, halign: 'center' } },
    ];
  }

  function subRow(label: string, sub: SubtotalRow, bg: [number,number,number], fg: [number,number,number]): Cell[] {
    return [
      labelCell(label, bg, fg),
      ...sub.cells.map(c => {
        const cell = vacCell(c.vacant, c.sanctioned) as CellObj;
        return { ...cell, styles: { ...cell.styles, fillColor: bg } };
      }),
      totCell(sub.totVacant, bg, fg),
    ];
  }

  if (data.teachingRows.length > 0) {
    body.push(sectionRow('TEACHING', span, T_BG, T_FG));
    data.teachingRows.forEach(r => body.push(dataRow(r)));
    body.push(subRow('Teaching Sub.', data.teachingSub, T_BG, T_FG));
  }

  if (data.nonTeachingRows.length > 0) {
    body.push(sectionRow('NON-TEACHING', span, NT_BG, NT_FG));
    data.nonTeachingRows.forEach(r => body.push(dataRow(r)));
    body.push(subRow('Non-Teaching Sub.', data.nonTeachingSub, NT_BG, NT_FG));
  }

  data.otherRows.forEach(r => body.push(dataRow(r)));

  body.push([
    labelCell('Grand Total', GT_BG, GT_FG),
    ...data.grandTotal.cells.map(c => {
      const cell = vacCell(c.vacant, c.sanctioned) as CellObj;
      return { ...cell, styles: { ...cell.styles, fillColor: GT_BG } };
    }),
    totCell(data.grandTotal.totVacant, GT_BG, GT_FG),
  ]);

  // Fixed cols: desig(32) + total(20); remaining width split across departments
  const deptW = Math.max(Math.floor((297 - 2 * M - 32 - 20) / departments.length), 20);

  autoTable(doc, {
    startY,
    margin: { left: M, right: M, top: M, bottom: 7 },
    head: [['Designation', ...departments, 'Total']],
    body,
    styles: { fontSize: FS, cellPadding: CP, valign: 'middle', lineColor: LC, lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: HC, textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: AC },
    columnStyles: {
      0: { halign: 'left', cellWidth: 32 },
      ...Object.fromEntries(departments.map((_, i) => [i + 1, { halign: 'center', cellWidth: deptW }])),
      [departments.length + 1]: { halign: 'center', cellWidth: 20 },
    },
    didDrawPage: data => pdfFooter(doc, data.pageNumber),
  });

  doc.save('SMP_Vacancy_Matrix.pdf');
}

// ── 2. Department Vacancy Summary PDF ─────────────────────────────────────────

export function exportDeptVacancySummaryPdf(
  rows: DeptVacancyStat[],
  totals: { totalSanctioned: number; totalFilled: number; totalVacant: number }
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const startY = pdfHeader(doc, 'Department Vacancy Summary');

  const body: Cell[][] = rows.map(r => [
    r.dept,
    r.sanctionedT  || '—', r.sanctionedNT || '—', r.sanctioned  || '—',
    r.filledT      || '—', r.filledNT     || '—', r.inService   || '—',
    r.vacantT  > 0 ? { content: r.vacantT,  styles: { textColor: RED, fontStyle: 'bold', halign: 'center' } } : '0',
    r.vacantNT > 0 ? { content: r.vacantNT, styles: { textColor: RED, fontStyle: 'bold', halign: 'center' } } : '0',
    r.vacant   > 0 ? { content: r.vacant,   styles: { textColor: RED, fontStyle: 'bold', halign: 'center' } } : '0',
  ]);

  const totVacT  = rows.reduce((s, r) => s + r.vacantT,  0);
  const totVacNT = rows.reduce((s, r) => s + r.vacantNT, 0);

  body.push([
    labelCell('Total', GT_BG, GT_FG),
    { content: rows.reduce((s, r) => s + r.sanctionedT,  0), styles: { fillColor: GT_BG, fontStyle: 'bold', halign: 'center', textColor: [124, 58, 237] } },
    { content: rows.reduce((s, r) => s + r.sanctionedNT, 0), styles: { fillColor: GT_BG, fontStyle: 'bold', halign: 'center', textColor: [180, 83, 9]   } },
    { content: totals.totalSanctioned,                        styles: { fillColor: GT_BG, fontStyle: 'bold', halign: 'center', textColor: GT_FG          } },
    { content: rows.reduce((s, r) => s + r.filledT,  0),     styles: { fillColor: GT_BG, fontStyle: 'bold', halign: 'center', textColor: [124, 58, 237] } },
    { content: rows.reduce((s, r) => s + r.filledNT, 0),     styles: { fillColor: GT_BG, fontStyle: 'bold', halign: 'center', textColor: [180, 83, 9]   } },
    { content: totals.totalFilled,                            styles: { fillColor: GT_BG, fontStyle: 'bold', halign: 'center', textColor: GREEN           } },
    totCell(totVacT,             GT_BG, GT_FG),
    totCell(totVacNT,            GT_BG, GT_FG),
    totCell(totals.totalVacant,  GT_BG, GT_FG),
  ]);

  autoTable(doc, {
    startY,
    margin: { left: M, right: M, top: M, bottom: 7 },
    head: [
      [
        { content: 'Dept',       rowSpan: 2, styles: { valign: 'middle', halign: 'left' } },
        { content: 'Sanctioned', colSpan: 3, styles: { halign: 'center', fillColor: [219, 234, 254] as [number,number,number], textColor: [3, 105, 161] as [number,number,number] } },
        { content: 'Filled',     colSpan: 3, styles: { halign: 'center', fillColor: [220, 252, 231] as [number,number,number], textColor: [22, 163, 74]  as [number,number,number] } },
        { content: 'Vacant',     colSpan: 3, styles: { halign: 'center', fillColor: [254, 226, 226] as [number,number,number], textColor: [185, 28, 28]  as [number,number,number] } },
      ],
      [
        { content: 'T',     styles: { halign: 'center' } },
        { content: 'NT',    styles: { halign: 'center' } },
        { content: 'Total', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'T',     styles: { halign: 'center' } },
        { content: 'NT',    styles: { halign: 'center' } },
        { content: 'Total', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'T',     styles: { halign: 'center' } },
        { content: 'NT',    styles: { halign: 'center' } },
        { content: 'Total', styles: { halign: 'center', fontStyle: 'bold' } },
      ],
    ],
    body,
    styles: { fontSize: FS, cellPadding: CP, valign: 'middle', lineColor: LC, lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: HC, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: AC },
    columnStyles: {
      0: { halign: 'left', cellWidth: 30 },
      1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center', fontStyle: 'bold' },
      7: { halign: 'center' }, 8: { halign: 'center' }, 9: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: M, right: M, top: M, bottom: 7 },
    didDrawPage: data => pdfFooter(doc, data.pageNumber),
  });

  doc.save('SMP_Dept_Vacancy_Summary.pdf');
}

// ── 3. By Designation PDF ──────────────────────────────────────────────────────

export function exportDesignationBreakdownPdf(rows: [string, number][], total: number): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startY = pdfHeader(doc, 'Staff by Designation  ·  In-Service');

  const body: Cell[][] = [
    ...rows.map(([desig, count]) => [desig, count] as Cell[]),
    [labelCell('Total', GT_BG, GT_FG), { content: total, styles: { fillColor: GT_BG, textColor: GT_FG, fontStyle: 'bold', halign: 'center' } }],
  ];

  autoTable(doc, {
    startY,
    margin: { left: M, right: M, top: M, bottom: 7 },
    head: [['Designation', 'Count']],
    body,
    styles: { fontSize: FS, cellPadding: CP, valign: 'middle', lineColor: LC, lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: HC, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: AC },
    columnStyles: { 0: { halign: 'left', cellWidth: 80 }, 1: { halign: 'center', cellWidth: 30 } },
    didDrawPage: data => pdfFooter(doc, data.pageNumber),
  });

  doc.save('SMP_By_Designation.pdf');
}

// ── 4. Department × Category PDF ──────────────────────────────────────────────

export function exportDeptCategoryPdf(rows: CategoryStat[], totals: { tInSvc: number; ntInSvc: number }): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startY = pdfHeader(doc, 'Department × Category  ·  In-Service');

  const body: Cell[][] = [
    ...rows.map(r => [r.dept, r.tInSvc || '—', r.ntInSvc || '—', (r.tInSvc + r.ntInSvc) || '—'] as Cell[]),
    [
      labelCell('Total', GT_BG, GT_FG),
      { content: totals.tInSvc,  styles: { fillColor: GT_BG, fontStyle: 'bold', halign: 'center', textColor: [124, 58, 237] } },
      { content: totals.ntInSvc, styles: { fillColor: GT_BG, fontStyle: 'bold', halign: 'center', textColor: [180, 83,   9] } },
      { content: totals.tInSvc + totals.ntInSvc, styles: { fillColor: GT_BG, fontStyle: 'bold', halign: 'right', textColor: GT_FG } },
    ],
  ];

  autoTable(doc, {
    startY,
    margin: { left: M, right: M, top: M, bottom: 7 },
    head: [['Department', 'Teaching', 'Non-Teaching', 'Total']],
    body,
    styles: { fontSize: FS, cellPadding: CP, valign: 'middle', lineColor: LC, lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: HC, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: AC },
    columnStyles: { 0: { halign: 'left', cellWidth: 55 }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
    didDrawPage: data => pdfFooter(doc, data.pageNumber),
  });

  doc.save('SMP_Dept_Category.pdf');
}

// ── 5. Category-wise Staff Count PDF ──────────────────────────────────────────

export function exportCategoryDeptMatrixPdf(
  rows: CatDeptRow[],
  colTotals: Record<string, number>,
  grandTotal: number,
  departments: string[]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const startY = pdfHeader(doc, 'Category-wise Staff Count  ·  In-Service');

  const body: Cell[][] = [
    ...rows.map(r => [r.cat, ...departments.map(d => r.deptCounts[d] || '—'), r.total] as Cell[]),
    [
      labelCell('Total', GT_BG, GT_FG),
      ...departments.map(d => ({ content: colTotals[d] || '—', styles: { fillColor: GT_BG, fontStyle: 'bold', halign: 'center' } } as CellObj)),
      { content: grandTotal, styles: { fillColor: GT_BG, textColor: GT_FG, fontStyle: 'bold', halign: 'right' } },
    ],
  ];

  autoTable(doc, {
    startY,
    margin: { left: M, right: M, top: M, bottom: 7 },
    head: [['Category', ...departments, 'Total']],
    body,
    styles: { fontSize: FS, cellPadding: CP, valign: 'middle', lineColor: LC, lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: HC, textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: AC },
    columnStyles: {
      0: { halign: 'left', cellWidth: 30 },
      ...Object.fromEntries(departments.map((_, i) => [i + 1, { halign: 'center' }])),
      [departments.length + 1]: { halign: 'right' },
    },
    didDrawPage: data => pdfFooter(doc, data.pageNumber),
  });

  doc.save('SMP_Category_Staff_Count.pdf');
}

// ── Excel exports ─────────────────────────────────────────────────────────────

function wb() { return XLSX.utils.book_new(); }

function save(book: XLSX.WorkBook, rows: unknown[][], sheet: string, file: string) {
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), sheet);
  XLSX.writeFile(book, file);
}

export function exportVacancyMatrixXlsx(data: VacancyMatrixData, departments: string[]): void {
  const rows: unknown[][] = [['Designation', ...departments, 'Vacant Total']];

  if (data.teachingRows.length > 0) {
    rows.push(['TEACHING']);
    data.teachingRows.forEach(r =>
      rows.push([r.desig, ...r.cells.map(c => c.sanctioned === 0 ? '—' : c.vacant), r.totVacant])
    );
    rows.push(['Teaching Sub.', ...data.teachingSub.cells.map(c => c.sanctioned === 0 ? '—' : c.vacant), data.teachingSub.totVacant]);
  }

  if (data.nonTeachingRows.length > 0) {
    rows.push(['NON-TEACHING']);
    data.nonTeachingRows.forEach(r =>
      rows.push([r.desig, ...r.cells.map(c => c.sanctioned === 0 ? '—' : c.vacant), r.totVacant])
    );
    rows.push(['Non-Teaching Sub.', ...data.nonTeachingSub.cells.map(c => c.sanctioned === 0 ? '—' : c.vacant), data.nonTeachingSub.totVacant]);
  }

  data.otherRows.forEach(r =>
    rows.push([r.desig, ...r.cells.map(c => c.sanctioned === 0 ? '—' : c.vacant), r.totVacant])
  );

  rows.push(['Grand Total', ...data.grandTotal.cells.map(c => c.sanctioned === 0 ? '—' : c.vacant), data.grandTotal.totVacant]);

  save(wb(), rows, 'Vacancy Matrix', 'SMP_Vacancy_Matrix.xlsx');
}

export function exportDeptVacancySummaryXlsx(
  rows: DeptVacancyStat[],
  totals: { totalSanctioned: number; totalFilled: number; totalVacant: number }
): void {
  const data: unknown[][] = [
    ['Dept', 'Sanc T', 'Sanc NT', 'Sanctioned', 'Filled T', 'Filled NT', 'Filled', 'Vacant T', 'Vacant NT', 'Vacant'],
    ...rows.map(r => [r.dept, r.sanctionedT, r.sanctionedNT, r.sanctioned, r.filledT, r.filledNT, r.inService, r.vacantT, r.vacantNT, r.vacant]),
    ['Total',
      rows.reduce((s, r) => s + r.sanctionedT,  0),
      rows.reduce((s, r) => s + r.sanctionedNT, 0),
      totals.totalSanctioned,
      rows.reduce((s, r) => s + r.filledT,  0),
      rows.reduce((s, r) => s + r.filledNT, 0),
      totals.totalFilled,
      rows.reduce((s, r) => s + r.vacantT,  0),
      rows.reduce((s, r) => s + r.vacantNT, 0),
      totals.totalVacant,
    ],
  ];
  save(wb(), data, 'Dept Vacancy Summary', 'SMP_Dept_Vacancy_Summary.xlsx');
}

export function exportDesignationBreakdownXlsx(rows: [string, number][], total: number): void {
  const data: unknown[][] = [
    ['Designation', 'Count (In-Service)'],
    ...rows,
    ['Total', total],
  ];
  save(wb(), data, 'By Designation', 'SMP_By_Designation.xlsx');
}

export function exportDeptCategoryXlsx(rows: CategoryStat[], totals: { tInSvc: number; ntInSvc: number }): void {
  const data: unknown[][] = [
    ['Department', 'Teaching', 'Non-Teaching', 'Total'],
    ...rows.map(r => [r.dept, r.tInSvc, r.ntInSvc, r.tInSvc + r.ntInSvc]),
    ['Total', totals.tInSvc, totals.ntInSvc, totals.tInSvc + totals.ntInSvc],
  ];
  save(wb(), data, 'Dept × Category', 'SMP_Dept_Category.xlsx');
}

export function exportCategoryDeptMatrixXlsx(
  rows: CatDeptRow[],
  colTotals: Record<string, number>,
  grandTotal: number,
  departments: string[]
): void {
  const data: unknown[][] = [
    ['Category', ...departments, 'Total'],
    ...rows.map(r => [r.cat, ...departments.map(d => r.deptCounts[d] ?? 0), r.total]),
    ['Total', ...departments.map(d => colTotals[d] ?? 0), grandTotal],
  ];
  save(wb(), data, 'Category Staff Count', 'SMP_Category_Staff_Count.xlsx');
}
