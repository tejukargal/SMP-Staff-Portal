import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { StaffRecord } from '@/types';
import { formatDate, computeServiceYears } from './dateUtils';

// ── Shared constants ──────────────────────────────────────────────────────────

const MARGIN    = 10;
const FONT_SIZE = 8.5;
const CELL_PAD  = { top: 2.8, right: 3, bottom: 2.8, left: 3 };
const PAD_H     = CELL_PAD.left + CELL_PAD.right;

const HEAD_COLOR : [number, number, number] = [30,  64, 175];   // blue-800
const ALT_COLOR  : [number, number, number] = [248, 250, 252];  // slate-50
const LINE_COLOR : [number, number, number] = [226, 232, 240];  // slate-200
const TITLE_COLOR: [number, number, number] = [15,  23,  42];   // near-black
const SUB_COLOR  : [number, number, number] = [100, 116, 139];  // slate-500
const FOOT_COLOR : [number, number, number] = [148, 163, 184];  // slate-400

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateStr() {
  return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pageFooter(doc: jsPDF, pageNumber: number) {
  const total = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(...FOOT_COLOR);
  doc.text(`Page ${pageNumber} of ${total}`, pageW - MARGIN, pageH - 4, { align: 'right' });
  doc.setTextColor(0);
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TITLE_COLOR);
  doc.text('Sanjay Memorial Polytechnic, Sagar', MARGIN, 13);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TITLE_COLOR);
  doc.text(title, MARGIN, 20);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SUB_COLOR);
  doc.text(subtitle, MARGIN, 25.5);
  doc.text(`Generated ${dateStr()}`, pageW - MARGIN, 25.5, { align: 'right' });
  doc.setTextColor(0);

  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, 28, pageW - MARGIN, 28);
}

type ColDef = {
  header: string;
  halign: 'left' | 'center' | 'right';
  get: (s: StaffRecord, i: number) => string | number;
};

function measureColWidths(doc: jsPDF, cols: ColDef[], rows: StaffRecord[], usableW: number, flexIdx: number) {
  doc.setFontSize(FONT_SIZE);
  let fixed = 0;
  const widths = cols.map((col, idx) => {
    if (idx === flexIdx) return 0;
    doc.setFont('helvetica', 'bold');
    let w = doc.getTextWidth(col.header);
    doc.setFont('helvetica', 'normal');
    rows.forEach((s, i) => { const cw = doc.getTextWidth(String(col.get(s, i))); if (cw > w) w = cw; });
    const colW = w + PAD_H + 2;
    fixed += colW;
    return colW;
  });
  widths[flexIdx] = Math.max(usableW - fixed, 28);
  return widths;
}

function buildTable(
  doc: jsPDF,
  cols: ColDef[],
  rows: StaffRecord[],
  widths: number[],
  startY: number,
  landscape = false,
) {
  const usableW = (landscape ? 297 : 210) - MARGIN * 2;
  const tableW  = widths.reduce((s, w) => s + w, 0);
  const colStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {};
  cols.forEach((c, i) => { colStyles[i] = { cellWidth: widths[i], halign: c.halign }; });

  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 12 },
    head: [cols.map(c => c.header)],
    body: rows.map((s, i) => cols.map(c => c.get(s, i))),
    tableWidth: Math.min(tableW, usableW),
    styles: {
      fontSize: FONT_SIZE,
      cellPadding: CELL_PAD,
      valign: 'middle',
      overflow: 'ellipsize',
      lineColor: LINE_COLOR,
      lineWidth: 0.15,
    },
    headStyles: { fillColor: HEAD_COLOR, textColor: 255, fontStyle: 'bold', fontSize: FONT_SIZE },
    alternateRowStyles: { fillColor: ALT_COLOR },
    columnStyles: colStyles,
    didDrawPage: data => pageFooter(doc, data.pageNumber),
  });
}

// ── Staff List PDF ────────────────────────────────────────────────────────────

export function exportStaffListPdf(staff: StaffRecord[], filters: {
  search?: string; dept?: string; type?: string; status?: string; desig?: string; category?: string;
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const usableW = 297 - MARGIN * 2;

  const chips: string[] = [];
  if (filters.search)   chips.push(`"${filters.search}"`);
  if (filters.dept)     chips.push(filters.dept);
  if (filters.type)     chips.push(filters.type);
  if (filters.status)   chips.push(filters.status);
  if (filters.desig)    chips.push(filters.desig);
  if (filters.category) chips.push(`Category: ${filters.category}`);
  chips.push(`${staff.length} record${staff.length !== 1 ? 's' : ''}`);

  drawHeader(doc, 'Staff List', chips.join('  ·  '));

  const cols: ColDef[] = [
    { header: 'Sl',          halign: 'center', get: (_, i) => i + 1         },
    { header: 'Name',        halign: 'left',   get: s => s.name             },
    { header: 'Emp ID',      halign: 'left',   get: s => s.empId            },
    { header: 'Designation', halign: 'left',   get: s => s.designation      },
    { header: 'Type',        halign: 'center', get: s => s.type             },
    { header: 'Dept',        halign: 'center', get: s => s.dept             },
    { header: 'Status',      halign: 'center', get: s => s.status           },
    { header: 'Category',    halign: 'center', get: s => s.category || '—'  },
    { header: 'DOE',         halign: 'center', get: s => formatDate(s.doe)  },
  ];

  const measure = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const widths  = measureColWidths(measure, cols, staff, usableW, 1); // flex: Name
  buildTable(doc, cols, staff, widths, 31, true);
  doc.save('SMP_Staff_List.pdf');
}

// ── Retired Staff PDF ─────────────────────────────────────────────────────────

export function exportRetiredStaffPdf(staff: StaffRecord[], filters: { search?: string; dept?: string; desig?: string; category?: string }): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const usableW = 210 - MARGIN * 2;

  const chips: string[] = [];
  if (filters.search)   chips.push(`"${filters.search}"`);
  if (filters.dept)     chips.push(filters.dept);
  if (filters.desig)    chips.push(filters.desig);
  if (filters.category) chips.push(`Category: ${filters.category}`);
  chips.push(`${staff.length} record${staff.length !== 1 ? 's' : ''}`);

  drawHeader(doc, 'Retired Staff List', chips.join('  ·  '));

  const cols: ColDef[] = [
    { header: 'Sl',          halign: 'center', get: (_, i) => i + 1         },
    { header: 'Name',        halign: 'left',   get: s => s.name             },
    { header: 'Emp ID',      halign: 'left',   get: s => s.empId            },
    { header: 'Designation', halign: 'left',   get: s => s.designation      },
    { header: 'Dept',        halign: 'center', get: s => s.dept             },
    { header: 'Category',    halign: 'center', get: s => s.category || '—'  },
    { header: 'DOE',         halign: 'center', get: s => formatDate(s.doe)  },
  ];

  const measure = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const widths  = measureColWidths(measure, cols, staff, usableW, 1);
  buildTable(doc, cols, staff, widths, 31, false);
  doc.save('SMP_Retired_Staff.pdf');
}

// ── Service Register PDF ──────────────────────────────────────────────────────

export function exportServiceRegisterPdf(staff: StaffRecord[], filters: { search?: string; dept?: string; desig?: string }): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const usableW = 210 - MARGIN * 2;

  const chips: string[] = [];
  if (filters.search) chips.push(`"${filters.search}"`);
  if (filters.dept)   chips.push(filters.dept);
  if (filters.desig)  chips.push(filters.desig);
  chips.push(`${staff.length} record${staff.length !== 1 ? 's' : ''}`);

  drawHeader(doc, 'Service Register', chips.join('  ·  '));

  const cols: ColDef[] = [
    { header: 'Sl',           halign: 'center', get: (_, i) => i + 1               },
    { header: 'Name',         halign: 'left',   get: s => s.name                   },
    { header: 'Emp ID',       halign: 'left',   get: s => s.empId                  },
    { header: 'Dept',         halign: 'center', get: s => s.dept                   },
    { header: 'DOE',          halign: 'center', get: s => formatDate(s.doe)        },
    { header: 'DOR',          halign: 'center', get: s => formatDate(s.dor ?? '')  },
    { header: 'Service Years',halign: 'center', get: s => `${computeServiceYears(s.doe)} yrs` },
  ];

  const measure = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const widths  = measureColWidths(measure, cols, staff, usableW, 1);
  buildTable(doc, cols, staff, widths, 31, false);
  doc.save('SMP_Service_Register.pdf');
}

// ── Seniority List PDF ────────────────────────────────────────────────────────

export function exportSeniorityListPdf(staff: StaffRecord[], filters: { search?: string; dept?: string; type?: string; desig?: string }): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const usableW = 210 - MARGIN * 2;

  const chips: string[] = [];
  if (filters.search) chips.push(`"${filters.search}"`);
  if (filters.dept)   chips.push(filters.dept);
  if (filters.type)   chips.push(filters.type);
  if (filters.desig)  chips.push(filters.desig);
  chips.push(`${staff.length} record${staff.length !== 1 ? 's' : ''}`);

  drawHeader(doc, 'Seniority List', chips.join('  ·  '));

  const cols: ColDef[] = [
    { header: 'Sl',          halign: 'center', get: (_, i) => i + 1         },
    { header: 'Name',        halign: 'left',   get: s => s.name             },
    { header: 'Designation', halign: 'left',   get: s => s.designation      },
    { header: 'Type',        halign: 'center', get: s => s.type             },
    { header: 'Dept',        halign: 'center', get: s => s.dept             },
    { header: 'DOE',         halign: 'center', get: s => formatDate(s.doe)  },
  ];

  const measure = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const widths  = measureColWidths(measure, cols, staff, usableW, 1);
  buildTable(doc, cols, staff, widths, 31, false);
  doc.save('SMP_Seniority_List.pdf');
}

// ── By Designation PDF ────────────────────────────────────────────────────────

export function exportByDesignationPdf(staff: StaffRecord[], filters: { search?: string; dept?: string; type?: string; desig?: string }): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const usableW = 210 - MARGIN * 2;

  const chips: string[] = [];
  if (filters.search) chips.push(`"${filters.search}"`);
  if (filters.dept)   chips.push(filters.dept);
  if (filters.type)   chips.push(filters.type);
  if (filters.desig)  chips.push(filters.desig);
  chips.push(`${staff.length} record${staff.length !== 1 ? 's' : ''}`);

  drawHeader(doc, 'Staff by Designation', chips.join('  ·  '));

  const cols: ColDef[] = [
    { header: 'Sl',          halign: 'center', get: (_, i) => i + 1         },
    { header: 'Name',        halign: 'left',   get: s => s.name             },
    { header: 'Emp ID',      halign: 'left',   get: s => s.empId            },
    { header: 'Type',        halign: 'center', get: s => s.type             },
    { header: 'Dept',        halign: 'center', get: s => s.dept             },
    { header: 'Status',      halign: 'center', get: s => s.status           },
    { header: 'DOE',         halign: 'center', get: s => formatDate(s.doe)  },
  ];

  const measure = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const widths  = measureColWidths(measure, cols, staff, usableW, 1);

  // Group by designation and build sections with sub-headers
  const groups: Record<string, StaffRecord[]> = {};
  staff.forEach(s => { if (!groups[s.designation]) groups[s.designation] = []; groups[s.designation].push(s); });

  let sl = 1;
  let startY = 31;
  let first  = true;

  Object.entries(groups).forEach(([desig, members]) => {
    // Designation sub-header row (span all cols, blue-50 bg, bold)
    const tableW = widths.reduce((s, w) => s + w, 0);
    const colStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {};
    cols.forEach((c, i) => { colStyles[i] = { cellWidth: widths[i], halign: c.halign }; });

    autoTable(doc, {
      startY: first ? startY : undefined,
      margin: { left: MARGIN, right: MARGIN, top: 30, bottom: 12 },
      head: first ? [cols.map(c => c.header)] : undefined,
      body: [
        [{ content: desig, colSpan: cols.length, styles: { fillColor: [239, 246, 255], textColor: HEAD_COLOR, fontStyle: 'bold', halign: 'left' } }],
        ...members.map(s => cols.map(c => c.get(s, sl++))),
      ],
      tableWidth: Math.min(tableW, usableW),
      styles: { fontSize: FONT_SIZE, cellPadding: CELL_PAD, valign: 'middle', overflow: 'ellipsize', lineColor: LINE_COLOR, lineWidth: 0.15 },
      headStyles: { fillColor: HEAD_COLOR, textColor: 255, fontStyle: 'bold', fontSize: FONT_SIZE },
      alternateRowStyles: { fillColor: ALT_COLOR },
      columnStyles: colStyles,
      didDrawPage: data => pageFooter(doc, data.pageNumber),
    });
    first = false;
    startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  });

  doc.save('SMP_By_Designation.pdf');
}

// ── Contact Directory PDF ─────────────────────────────────────────────────────

export function exportContactDirPdf(staff: StaffRecord[], filters: { search?: string; dept?: string; type?: string }): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const usableW = 210 - MARGIN * 2;

  const chips: string[] = [];
  if (filters.search) chips.push(`"${filters.search}"`);
  if (filters.dept)   chips.push(filters.dept);
  if (filters.type)   chips.push(filters.type);
  chips.push(`${staff.length} record${staff.length !== 1 ? 's' : ''}`);

  drawHeader(doc, 'Contact Directory', chips.join('  ·  '));

  const cols: ColDef[] = [
    { header: 'Sl',    halign: 'center', get: (_, i) => i + 1   },
    { header: 'Name',  halign: 'left',   get: s => s.name        },
    { header: 'Type',  halign: 'center', get: s => s.type        },
    { header: 'Dept',  halign: 'center', get: s => s.dept        },
    { header: 'Phone', halign: 'left',   get: s => s.phone || '—'},
    { header: 'Email', halign: 'left',   get: s => s.email || '—'},
  ];

  const measure = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const widths  = measureColWidths(measure, cols, staff, usableW, 1);
  buildTable(doc, cols, staff, widths, 31, false);
  doc.save('SMP_Contact_Directory.pdf');
}

// ── Dispatch helper — picks the right exporter per report key ─────────────────

export type ReportKey =
  | 'staff-list' | 'retired' | 'service-register'
  | 'seniority'  | 'by-designation' | 'contact-dir';

export function exportReportPdf(
  key: ReportKey,
  data: StaffRecord[],
  filters: { search?: string; dept?: string; type?: string; status?: string; desig?: string; category?: string },
): void {
  switch (key) {
    case 'staff-list':       return exportStaffListPdf(data, filters);
    case 'retired':          return exportRetiredStaffPdf(data, filters);
    case 'service-register': return exportServiceRegisterPdf(data, filters);
    case 'seniority':        return exportSeniorityListPdf(data, filters);
    case 'by-designation':   return exportByDesignationPdf(data, filters);
    case 'contact-dir':      return exportContactDirPdf(data, filters);
  }
}
