import { useState, useMemo } from 'react';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import { SalaryTable } from '@/components/salary/SalaryTable';
import { SalaryBillPrint } from '@/components/salary/SalaryBillPrint';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { MONTHS, DEPARTMENTS } from '@/constants/enums';
import { computeDAAmount, computeHRAAmount, computeGross, computeNet } from '@/utils/salaryUtils';
import { exportSalaryBillToExcel } from '@/utils/exportUtils';
import type { SalaryRow, DeptEnum } from '@/types';
import { currentYear } from '@/utils/dateUtils';

function buildRows(staff: ReturnType<typeof useStaff>['staff']): SalaryRow[] {
  return staff
    .filter((s) => s.status === 'IN SERVICE')
    .map((s) => {
      const basicPay = s.basicPay ?? 0;
      const daPercent = s.da ?? 0;
      const hraPercent = s.hra ?? 0;
      const nps = s.nps ?? 0;
      const pt = s.pt ?? 0;
      const daAmount = computeDAAmount(basicPay, daPercent);
      const hraAmount = computeHRAAmount(basicPay, hraPercent);
      const gross = computeGross(basicPay, daPercent, hraPercent);
      const net = computeNet(gross, nps, pt);
      return {
        staffId: s.id ?? s.empId,
        name: s.name,
        designation: s.designation,
        dept: s.dept,
        basicPay,
        daPercent,
        hraPercent,
        daAmount,
        hraAmount,
        gross,
        nps,
        pt,
        otherDed: 0,
        net,
      };
    });
}

const NOW = new Date();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear() - i);

export default function SalaryBill() {
  const { staff, loading } = useStaff();
  const [month, setMonth] = useState(MONTHS[NOW.getMonth()]);
  const [year, setYear] = useState(currentYear());
  const [filterType, setFilterType] = useState<'ALL' | 'TEACHING' | 'NON-TEACHING' | 'DEPT'>('ALL');
  const [filterDept, setFilterDept] = useState<DeptEnum | ''>('');
  const [step, setStep] = useState<1 | 2>(1);
  const [rows, setRows] = useState<SalaryRow[]>([]);

  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      if (filterType === 'TEACHING') return s.type === 'TEACHING';
      if (filterType === 'NON-TEACHING') return s.type === 'NON-TEACHING';
      if (filterType === 'DEPT') return s.dept === filterDept;
      return true;
    });
  }, [staff, filterType, filterDept]);

  const handleGenerate = () => {
    setRows(buildRows(filteredStaff));
    setStep(2);
  };

  const handleCellChange = (staffId: string, field: keyof SalaryRow, value: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.staffId !== staffId) return r;
        const updated = { ...r, [field]: value };
        updated.daAmount = computeDAAmount(updated.basicPay, updated.daPercent);
        updated.hraAmount = computeHRAAmount(updated.basicPay, updated.hraPercent);
        updated.gross = computeGross(updated.basicPay, updated.daPercent, updated.hraPercent);
        updated.net = computeNet(updated.gross, updated.nps, updated.pt, updated.otherDed);
        return updated;
      })
    );
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="flex flex-col gap-5">
      {step === 1 && (
        <div className="bg-white rounded-xl border border-[#E2E5EA] p-6 max-w-lg">
          <h2 className="text-base font-semibold text-[#111827] mb-5">Step 1 — Select Parameters</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-2 text-sm border border-[#E2E5EA] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              >
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-2 text-sm border border-[#E2E5EA] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1 mb-4">
            <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">Filter</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
              className="px-3 py-2 text-sm border border-[#E2E5EA] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            >
              <option value="ALL">All Staff (In Service)</option>
              <option value="TEACHING">Teaching Only</option>
              <option value="NON-TEACHING">Non-Teaching Only</option>
              <option value="DEPT">By Department</option>
            </select>
          </div>

          {filterType === 'DEPT' && (
            <div className="flex flex-col gap-1 mb-4">
              <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">Department</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value as DeptEnum)}
                className="px-3 py-2 text-sm border border-[#E2E5EA] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              >
                <option value="">Select...</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          <p className="text-xs text-[#6B7280] mb-4">
            {filteredStaff.filter((s) => s.status === 'IN SERVICE').length} staff members will be included.
          </p>

          <Button onClick={handleGenerate}>Generate Bill Preview</Button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between no-print">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">
                Salary Bill — {month} {year}
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {rows.length} staff • Edit any cell to override
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => exportSalaryBillToExcel(rows, month, year)}
              >
                <Download className="w-3.5 h-3.5" />
                Export Excel
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                Print Bill
              </Button>
            </div>
          </div>

          <SalaryTable rows={rows} onChange={handleCellChange} />

          <SalaryBillPrint rows={rows} month={month} year={year} />
        </div>
      )}
    </div>
  );
}
