import type { StaffRecord } from '@/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function titleCase(word: string): string {
  const i = MONTHS.findIndex(m => m.toUpperCase() === word.toUpperCase());
  return i >= 0 ? MONTHS[i] : word.charAt(0) + word.slice(1).toLowerCase();
}

function formatToday(): string {
  const d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SalaryCertificateData {
  fromMonth: string;
  fromYear: number;
  toMonth: string;
  toYear: number;
  reason: string;
  position: 'top' | 'bottom';
}

export function buildSalaryCertificateHTML(staff: StaffRecord, data: SalaryCertificateData): string {
  const name   = esc(staff.name);
  const desig  = esc(staff.designation);
  const dept   = esc(staff.dept);
  const reason = esc(data.reason);
  const today  = formatToday();

  const fromMonth = titleCase(data.fromMonth);
  const toMonth   = titleCase(data.toMonth);
  const isSingleMonth = data.fromMonth === data.toMonth && data.fromYear === data.toYear;
  const periodPhrase = isSingleMonth
    ? `for the month of <strong>${fromMonth} ${data.fromYear}</strong>`
    : `for the month(s) from <strong>${fromMonth} ${data.fromYear}</strong> to <strong>${toMonth} ${data.toYear}</strong>`;

  const marginTop = data.position === 'bottom' ? '148mm' : '0';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Salary Certificate Application &#8211; ${name}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    color: #000;
    background: #fff;
  }
  @media screen {
    html { background: #94a3b8; min-height: 100%; padding: 24px 0; }
    body { max-width: 210mm; margin: 0 auto; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,0.22); border-radius: 4px; padding: 10mm 15mm; }
  }

  .letter {
    margin-top: ${marginTop};
  }

  .to-date-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8pt;
  }
  .to-block { text-align: left; line-height: 1.4; font-size: 12pt; }
  .date-cell { text-align: right; font-size: 12pt; white-space: nowrap; }

  .from-block { text-align: left; line-height: 1.35; margin-bottom: 14pt; font-size: 12pt; }
  .from-label { font-weight: bold; text-decoration: underline; margin-bottom: 3pt; }

  .salutation { font-size: 12pt; margin-bottom: 10pt; }

  .subject-row { font-size: 12pt; margin-bottom: 12pt; margin-left: 72pt; line-height: 1.5; }
  .subject-label { font-weight: bold; }
  .subject-text { text-decoration: underline; }

  .para {
    font-size: 12pt;
    line-height: 1.7;
    text-align: justify;
    text-indent: 36pt;
    margin-bottom: 7pt;
  }

  .closing {
    margin-top: 10pt;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    font-size: 12pt;
    line-height: 1.6;
  }
  .closing-left { text-align: left; }
  .closing-right { text-align: right; }
  .sig-space { height: 26pt; }
  .sig-name { font-weight: bold; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="letter">

  <div class="to-date-row">
    <div class="to-block">
      <div><strong>To,</strong></div>
      <div>The Principal,</div>
      <div>Sanjay Memorial Polytechnic,</div>
      <div>Sagar.</div>
    </div>
    <div class="date-cell"><strong>Date:</strong> ${esc(today)}</div>
  </div>

  <div class="from-block">
    <div class="from-label">From,</div>
    <div>${name}</div>
    <div>${desig}</div>
    <div>${dept} Department</div>
    <div>Sanjay Memorial Polytechnic, Sagar.</div>
  </div>

  <div class="salutation">Sir,</div>

  <div class="subject-row">
    <span class="subject-label">Sub: </span>
    <span class="subject-text">Request for Issue of Salary Certificate.</span>
  </div>

  <p class="para">
    I request you to kindly issue me the Salary Certificate ${periodPhrase}, which is required for
    <strong>${reason}</strong> purpose.
  </p>

  <p class="para">I shall be obliged for the same.</p>

  <div class="closing">
    <div class="closing-left">Thanking You,</div>
    <div class="closing-right">
      <div>Yours Faithfully,</div>
      <div class="sig-space"></div>
      <div class="sig-name">${name}</div>
      <div>(Signature)</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

export function generateSalaryCertificate(staff: StaffRecord, data: SalaryCertificateData): void {
  const base = buildSalaryCertificateHTML(staff, data);
  const html = base.replace('</body>', `<script>
  window.onload = function () {
    window.print();
    window.addEventListener('afterprint', function () { window.close(); });
  };
</script>\n</body>`);
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) {
    win.addEventListener('afterprint', () => URL.revokeObjectURL(url));
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
