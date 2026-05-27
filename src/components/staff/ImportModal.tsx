import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, AlertTriangle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DeptBadge, StatusBadge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { getAllStaff } from '@/firebase/firestore';
import { db } from '@/firebase/firestore';
import { writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore';
import { computeDOR } from '@/utils/dateUtils';
import type { StaffRecord, DesignationEnum, DeptEnum, StatusEnum, StaffType } from '@/types';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ParsedRow {
  sl: number;
  name: string;
  empId: string;
  designation: string;
  type: string;
  dept: string;
  status: string;
  dob: string;
  doe: string;
  dor: string;
  bankAccountNo: string;
  pan: string;
  aadhar: string;
  phone: string;
  email: string;
  payScale: string;
  basicPay: number;
  // Personal
  caste: string;
  category: string;
  // Education
  dateOfCompletion: string;
  classObtained: string;
  university: string;
  // Service
  approvalOrderNumber: string;
  dateOfApproval: string;
  arrearsTakenFrom: string;
  errors: string[];
}

// Column name → field key mapping (lowercase keys)
const COL_MAP: Record<string, keyof ParsedRow> = {
  // Core
  'sl':                      'sl',
  'name':                    'name',
  'designation':             'designation',
  'type':                    'type',
  'dept':                    'dept',
  'department':              'dept',
  'status':                  'status',
  // Dates
  'dob':                     'dob',
  'date of birth':           'dob',
  'doe':                     'doe',
  'date of entry':           'doe',
  'date of entry into service': 'doe',
  'date of joining':         'doe',
  'doj':                     'doe',
  // IDs
  'emp id':                  'empId',
  'emp_id':                  'empId',
  'empid':                   'empId',
  'employee id':             'empId',
  // Financial compliance
  'bank acct no':            'bankAccountNo',
  'bank account no':         'bankAccountNo',
  'bank account':            'bankAccountNo',
  'account no':              'bankAccountNo',
  'bank acct':               'bankAccountNo',
  'pan':                     'pan',
  'aadhar':                  'aadhar',
  'aadhaar':                 'aadhar',
  'adhaar':                  'aadhar',
  'uidai':                   'aadhar',
  // Contact
  'phone':                   'phone',
  'mobile':                  'phone',
  'phone no':                'phone',
  'mobile no':               'phone',
  'contact':                 'phone',
  'mail id':                 'email',
  'email':                   'email',
  'email id':                'email',
  'mail':                    'email',
  // Pay
  'pay scale':               'payScale',
  'payscale':                'payScale',
  'basic pay':               'basicPay',
  'basic':                   'basicPay',
  // Personal
  'caste':                   'caste',
  'cast':                    'caste',
  'category':                'category',
  'cat':                     'category',
  // Education
  'date of completion':      'dateOfCompletion',
  'completion date':         'dateOfCompletion',
  'date of qualification':   'dateOfCompletion',   // actual Excel column name
  'qualification date':      'dateOfCompletion',
  'doc':                     'dateOfCompletion',
  'class obtained':          'classObtained',
  'class':                   'classObtained',
  'university':              'university',
  'univ':                    'university',
  // Service order
  'approval order number':   'approvalOrderNumber',
  'approval order no':       'approvalOrderNumber',
  'approval order no.':      'approvalOrderNumber', // trailing-period variant in real Excel
  'order no':                'approvalOrderNumber',
  'order no.':               'approvalOrderNumber',
  'approval no':             'approvalOrderNumber',
  'approval no.':            'approvalOrderNumber',
  'date of approval':        'dateOfApproval',
  'approval date':           'dateOfApproval',
  'doa':                     'dateOfApproval',
  'arrears taken from':      'arrearsTakenFrom',
  'arrears from':            'arrearsTakenFrom',
  'arrears':                 'arrearsTakenFrom',
};

const MONTH_NAMES: Record<string, string> = {
  jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
};

function parseDate(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';

  // JS Date object — from XLSX cellDates:true
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,'0')}-${String(raw.getDate()).padStart(2,'0')}`;
  }

  // Excel serial number — raw numeric cell
  if (typeof raw === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d && d.y > 1900) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    } catch { /* not a valid serial */ }
    return '';
  }

  const str = String(raw).trim();
  if (!str) return '';

  // Already ISO  YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD-MM-YY or DD-MM-YYYY (supports - / . separators)
  const dmy = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2,'0');
    const mon = dmy[2].padStart(2,'0');
    let yr = parseInt(dmy[3], 10);
    if (yr < 100) yr = yr >= 25 ? 1900 + yr : 2000 + yr;
    return `${yr}-${mon}-${day}`;
  }

  // "15 Jun 2010" or "15-Jun-2010" or "15/Jun/2010"
  const dmy2 = str.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})[-\/\s](\d{2,4})$/);
  if (dmy2) {
    const mon = MONTH_NAMES[dmy2[2].toLowerCase()];
    if (mon) {
      let yr = parseInt(dmy2[3], 10);
      if (yr < 100) yr = yr >= 25 ? 1900 + yr : 2000 + yr;
      return `${yr}-${mon}-${dmy2[1].padStart(2,'0')}`;
    }
  }

  // "Jun 15 2010" or "June 15, 2010"
  const mdy = str.match(/^([A-Za-z]{3,9})\s+(\d{1,2})[,\s]+(\d{4})$/);
  if (mdy) {
    const mon = MONTH_NAMES[mdy[1].slice(0,3).toLowerCase()];
    if (mon) return `${mdy[3]}-${mon}-${mdy[2].padStart(2,'0')}`;
  }

  // "May-84" or "Apr-1980" — month name + 2 or 4 digit year
  const my = str.match(/^([A-Za-z]{3,9})[-\/\s](\d{2,4})$/);
  if (my) {
    const mon = MONTH_NAMES[my[1].slice(0,3).toLowerCase()];
    if (mon) {
      let yr = parseInt(my[2], 10);
      if (yr < 100) yr = yr >= 25 ? 1900 + yr : 2000 + yr;
      return `${yr}-${mon}-01`;
    }
  }

  return '';
}

function normaliseAadhaar(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 12);
}

function parseRows(sheet: XLSX.WorkSheet): ParsedRow[] {
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  if (json.length === 0) return [];

  // Normalise a header string: collapse whitespace/newlines, lowercase
  const normaliseHeader = (h: string) =>
    h.trim().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').toLowerCase();

  // Build header → field mapping from first row keys
  const headerMap: Record<string, keyof ParsedRow> = {};
  Object.keys(json[0]).forEach((h) => {
    const key = COL_MAP[normaliseHeader(h)];
    if (key) headerMap[h] = key;
  });

  const DATE_FIELDS = new Set<keyof ParsedRow>(['dob', 'doe', 'dateOfCompletion', 'dateOfApproval', 'arrearsTakenFrom']);
  const NUM_FIELDS  = new Set<keyof ParsedRow>(['sl', 'basicPay']);

  return json.map((row, i) => {
    const p: ParsedRow = {
      sl: 0, name: '', empId: '', designation: '', type: '', dept: '',
      status: '', dob: '', doe: '', dor: '', bankAccountNo: '', pan: '',
      aadhar: '', phone: '', email: '', payScale: '', basicPay: 0,
      caste: '', category: '',
      dateOfCompletion: '', classObtained: '', university: '',
      approvalOrderNumber: '', dateOfApproval: '', arrearsTakenFrom: '',
      errors: [],
    };

    for (const [col, field] of Object.entries(headerMap)) {
      const val = row[col];
      if (NUM_FIELDS.has(field)) {
        (p[field] as number) = Number(val) || 0;
      } else if (DATE_FIELDS.has(field)) {
        (p[field] as string) = parseDate(val);
      } else if (field === 'aadhar') {
        p.aadhar = normaliseAadhaar(val);
      } else if (field === 'email') {
        p.email = String(val ?? '').trim().toLowerCase();
      } else {
        (p[field] as string) = String(val ?? '').trim().toUpperCase();
      }
    }

    // Email fallback: try common casing variants not reached by COL_MAP loop
    if (!p.email) {
      const emailRaw = String(row['Mail ID'] ?? row['MAIL ID'] ?? row['Email'] ?? row['email'] ?? '').trim();
      if (emailRaw) p.email = emailRaw.toLowerCase();
    }

    // Auto-fill sl if missing
    if (!p.sl) p.sl = i + 1;

    // Auto-compute DOR from DOB
    if (p.dob) p.dor = computeDOR(p.dob);

    // Validation
    if (!p.name)  p.errors.push('Name missing');
    if (!p.empId) p.errors.push('Emp ID missing');
    if (!p.dob)   p.errors.push('DOB invalid');
    if (!p.doe)   p.errors.push('DOE invalid');

    return p;
  });
}

function rowToStaffRecord(row: ParsedRow, createdBy: string): Omit<StaffRecord, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    sl:            row.sl,
    name:          row.name,
    empId:         row.empId,
    designation:   (row.designation || 'OTHER') as DesignationEnum,
    type:          (row.type || 'TEACHING') as StaffType,
    dept:          (row.dept || 'OFFICE') as DeptEnum,
    status:        (row.status || 'IN SERVICE') as StatusEnum,
    dob:           row.dob,
    doe:           row.doe,
    bankAccountNo: row.bankAccountNo,
    pan:           row.pan,
    aadhar:        row.aadhar,
    phone:         row.phone,
    email:         row.email,
    createdBy,
    // Optional — only spread when a real value exists
    ...(row.dor                    ? { dor:                 row.dor }                 : {}),
    ...(row.payScale               ? { payScale:            row.payScale }            : {}),
    ...(row.basicPay > 0           ? { basicPay:            row.basicPay }            : {}),
    ...(row.caste                  ? { caste:               row.caste }               : {}),
    ...(row.category               ? { category:            row.category }            : {}),
    ...(row.dateOfCompletion       ? { dateOfCompletion:    row.dateOfCompletion }    : {}),
    ...(row.classObtained          ? { classObtained:       row.classObtained }       : {}),
    ...(row.university             ? { university:          row.university }          : {}),
    ...(row.approvalOrderNumber    ? { approvalOrderNumber: row.approvalOrderNumber } : {}),
    ...(row.dateOfApproval         ? { dateOfApproval:      row.dateOfApproval }      : {}),
    ...(row.arrearsTakenFrom       ? { arrearsTakenFrom:    row.arrearsTakenFrom }    : {}),
  };
}

export function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [fileName, setFileName]   = useState('');
  const [step, setStep]           = useState<'upload' | 'preview'>('upload');
  const [dragOver, setDragOver]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [importError, setImportError] = useState('');

  const reset = () => {
    setRows([]); setFileName(''); setStep('upload');
    setDragOver(false); setImporting(false); setProgress(0); setImportError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = parseRows(ws);
        setRows(parsed);
        setStep('preview');
      } catch {
        setImportError('Could not parse file. Please use .xlsx, .xls, or .csv format.');
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const validRows   = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    setImportError('');
    try {
      // Get current max sl to avoid duplicates
      const existing = await getAllStaff();
      const existingEmpIds = new Set(existing.map((s) => s.empId));
      const maxSl = existing.reduce((m, s) => Math.max(m, s.sl), 0);

      // Filter out already-existing empIds
      const toImport = validRows.filter((r) => !existingEmpIds.has(r.empId));
      const skipped  = validRows.length - toImport.length;

      if (toImport.length === 0) {
        setImportError(`All ${validRows.length} records already exist in the database (matched by Emp ID).`);
        setImporting(false);
        return;
      }

      // Re-number sl from current max
      let slCounter = maxSl;

      // Batch write — max 500 per batch
      const CHUNK = 450;
      let done = 0;
      for (let i = 0; i < toImport.length; i += CHUNK) {
        const chunk = toImport.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach((row) => {
          slCounter++;
          const ref = doc(collection(db, 'staff'));
          const record = rowToStaffRecord({ ...row, sl: slCounter }, user?.uid ?? '');
          batch.set(ref, {
            ...record,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
        done += chunk.length;
        setProgress(Math.round((done / toImport.length) * 100));
      }

      onImported();
      handleClose();
      if (skipped > 0) {
        // Show skipped count in parent via onImported callback — handled by parent toast
      }
      void skipped; // consumed above
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ animation: 'backdrop-enter 0.2s ease-out' }}
    >
      <div
        className="absolute inset-0 bg-black/40"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={handleClose}
      />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full mx-4 z-10 border border-gray-100 flex flex-col"
        style={{
          animation: 'modal-enter 0.25s ease-out',
          maxWidth: step === 'preview' ? 900 : 480,
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E5EA] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-[#1B3A6B]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#111827]">Import Staff from Excel / CSV</h2>
              {fileName && <p className="text-xs text-[#6B7280] mt-0.5">{fileName}</p>}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="p-6 flex flex-col gap-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200 ${dragOver ? 'drop-zone-active border-[#1B3A6B]' : 'border-[#E2E5EA] hover:border-[#1B3A6B] hover:bg-[#F7F8FA]'}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] flex items-center justify-center">
                <Upload className="w-7 h-7 text-[#1B3A6B]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[#111827]">Drop your file here or click to browse</p>
                <p className="text-xs text-[#6B7280] mt-1">Supports .xlsx, .xls, .csv</p>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />

            {importError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FEE2E2] text-[#DC2626] text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {importError}
              </div>
            )}

            <div className="bg-[#F7F8FA] rounded-xl p-4 text-xs text-[#6B7280]">
              <p className="font-medium text-[#374151] mb-1.5">Expected columns (order doesn't matter):</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Sl','Name','Emp ID','Designation','Type','Dept','Status',
                  'DOB','DOE','Phone','Mail ID',
                  'Caste','Category',
                  'Date of Completion','Class Obtained','University',
                  'Approval Order Number','Date of Approval','Arrears Taken From',
                  'Bank Acct No','PAN','Aadhar','Pay Scale','Basic Pay',
                ].map((c) => (
                  <span key={c} className="px-2 py-0.5 bg-white border border-[#E2E5EA] rounded text-[10px] font-mono">{c}</span>
                ))}
              </div>
              <p className="mt-2 text-[11px]">Date format: DD-MM-YY or DD-MM-YYYY · All columns optional except Name, Emp ID, DOB, DOE</p>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Summary bar */}
            <div className="flex items-center gap-4 px-6 py-3 bg-[#F7F8FA] border-b border-[#E2E5EA] shrink-0 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-[#16A34A] font-medium">
                <CheckCircle className="w-4 h-4" />
                {validRows.length} valid
              </div>
              {invalidRows.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-[#DC2626] font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {invalidRows.length} with errors (will be skipped)
                </div>
              )}
              <div className="flex-1" />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setStep('upload'); setRows([]); setFileName(''); }}
              >
                Change file
              </Button>
              <Button
                size="sm"
                onClick={() => { void handleImport(); }}
                loading={importing}
                disabled={validRows.length === 0}
              >
                Import {validRows.length} Records
              </Button>
            </div>

            {/* Progress bar */}
            {importing && (
              <div className="px-6 py-2 shrink-0">
                <div className="h-1.5 bg-[#E2E5EA] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1B3A6B] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-[#6B7280] mt-1">{progress}% uploaded…</p>
              </div>
            )}

            {importError && (
              <div className="mx-6 mt-2 flex items-start gap-2 p-3 rounded-xl bg-[#FEE2E2] text-[#DC2626] text-xs shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {importError}
              </div>
            )}

            {/* Preview table */}
            <div className="flex-1 overflow-auto px-6 pb-6 pt-3">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b-2 border-[#E2E5EA]">
                    {['#', 'Name', 'Emp ID', 'Designation', 'Type', 'Dept', 'Status', 'DOB', 'DOE', 'Caste', 'Category', 'Phone', 'Valid'].map((h) => (
                      <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-[#F3F4F6] ${row.errors.length > 0 ? 'bg-[#FFF7F7]' : 'hover:bg-[#F7F8FA]'} transition-colors`}
                      style={{ animation: `content-enter 0.2s ease-out ${Math.min(i * 20, 300)}ms both` }}
                    >
                      <td className="px-2 py-2 text-[#6B7280] font-mono">{i + 1}</td>
                      <td className="px-2 py-2 font-medium max-w-36 truncate">{row.name || '—'}</td>
                      <td className="px-2 py-2 font-mono text-[#374151]">{row.empId || '—'}</td>
                      <td className="px-2 py-2 text-[#374151]">{row.designation || '—'}</td>
                      <td className="px-2 py-2 text-[#374151] whitespace-nowrap">{row.type || '—'}</td>
                      <td className="px-2 py-2">
                        {row.dept ? <DeptBadge dept={row.dept as DeptEnum} /> : '—'}
                      </td>
                      <td className="px-2 py-2">
                        {row.status ? <StatusBadge status={row.status as StatusEnum} /> : '—'}
                      </td>
                      <td className="px-2 py-2 font-mono text-[#374151] whitespace-nowrap">{row.dob || '—'}</td>
                      <td className="px-2 py-2 font-mono text-[#374151] whitespace-nowrap">{row.doe || '—'}</td>
                      <td className="px-2 py-2 text-[#374151]">{row.caste || '—'}</td>
                      <td className="px-2 py-2 text-[#374151]">{row.category || '—'}</td>
                      <td className="px-2 py-2 text-[#374151]">{row.phone || '—'}</td>
                      <td className="px-2 py-2">
                        {row.errors.length === 0
                          ? <span className="text-[#16A34A] font-medium">✓ OK</span>
                          : <span className="text-[#DC2626] font-medium">✗ Skip</span>}
                      </td>
                      <td className="px-2 py-2 text-[#DC2626]">
                        {row.errors.join(', ') || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
