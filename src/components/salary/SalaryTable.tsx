import { DeptBadge } from '@/components/ui/Badge';
import { formatINR } from '@/utils/salaryUtils';
import type { SalaryRow } from '@/types';

interface Props {
  rows: SalaryRow[];
  onChange: (id: string, field: keyof SalaryRow, value: number) => void;
}

const editableFields: (keyof SalaryRow)[] = ['basicPay', 'daPercent', 'hraPercent', 'nps', 'pt', 'otherDed'];

function sum(rows: SalaryRow[], key: keyof SalaryRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

export function SalaryTable({ rows, onChange }: Props) {
  return (
    <div className="overflow-auto rounded-lg border border-[#E2E5EA]">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-[#F7F8FA] sticky top-0 z-10">
          <tr>
            <th className="px-2 py-2.5 text-left border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">Sl</th>
            <th className="px-2 py-2.5 text-left border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">Name</th>
            <th className="px-2 py-2.5 text-left border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">Desig.</th>
            <th className="px-2 py-2.5 text-left border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">Dept</th>
            <th className="px-2 py-2.5 text-right border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">Basic</th>
            <th className="px-2 py-2.5 text-right border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">DA%</th>
            <th className="px-2 py-2.5 text-right border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">DA</th>
            <th className="px-2 py-2.5 text-right border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">HRA%</th>
            <th className="px-2 py-2.5 text-right border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">HRA</th>
            <th className="px-2 py-2.5 text-right border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">Gross</th>
            <th className="px-2 py-2.5 text-right border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">NPS</th>
            <th className="px-2 py-2.5 text-right border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">PT</th>
            <th className="px-2 py-2.5 text-right border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">Oth.Ded</th>
            <th className="px-2 py-2.5 text-right border-b border-[#E2E5EA] text-[#6B7280] uppercase tracking-wide font-semibold">Net Pay</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.staffId} className={i % 2 === 1 ? 'bg-[#F9FAFB]' : 'bg-white'}>
              <td className="px-2 py-2 text-[#6B7280] border-b border-[#E2E5EA]">{i + 1}</td>
              <td className="px-2 py-2 border-b border-[#E2E5EA] font-medium max-w-36 truncate">{r.name}</td>
              <td className="px-2 py-2 border-b border-[#E2E5EA] text-[#6B7280]">{r.designation}</td>
              <td className="px-2 py-2 border-b border-[#E2E5EA]"><DeptBadge dept={r.dept} /></td>
              {editableFields.includes('basicPay') && (
                <td className="px-2 py-2 border-b border-[#E2E5EA]">
                  <EditableCell value={r.basicPay} onChange={(v) => onChange(r.staffId, 'basicPay', v)} />
                </td>
              )}
              <td className="px-2 py-2 border-b border-[#E2E5EA]">
                <EditableCell value={r.daPercent} onChange={(v) => onChange(r.staffId, 'daPercent', v)} suffix="%" />
              </td>
              <td className="px-2 py-2 border-b border-[#E2E5EA] text-right">{r.daAmount.toLocaleString('en-IN')}</td>
              <td className="px-2 py-2 border-b border-[#E2E5EA]">
                <EditableCell value={r.hraPercent} onChange={(v) => onChange(r.staffId, 'hraPercent', v)} suffix="%" />
              </td>
              <td className="px-2 py-2 border-b border-[#E2E5EA] text-right">{r.hraAmount.toLocaleString('en-IN')}</td>
              <td className="px-2 py-2 border-b border-[#E2E5EA] text-right font-medium">{r.gross.toLocaleString('en-IN')}</td>
              <td className="px-2 py-2 border-b border-[#E2E5EA]">
                <EditableCell value={r.nps} onChange={(v) => onChange(r.staffId, 'nps', v)} />
              </td>
              <td className="px-2 py-2 border-b border-[#E2E5EA]">
                <EditableCell value={r.pt} onChange={(v) => onChange(r.staffId, 'pt', v)} />
              </td>
              <td className="px-2 py-2 border-b border-[#E2E5EA]">
                <EditableCell value={r.otherDed} onChange={(v) => onChange(r.staffId, 'otherDed', v)} />
              </td>
              <td className="px-2 py-2 border-b border-[#E2E5EA] text-right font-bold text-[#16A34A]">
                {r.net.toLocaleString('en-IN')}
              </td>
            </tr>
          ))}
        </tbody>
        {/* Totals row */}
        <tfoot className="bg-[#1B3A6B] text-white sticky bottom-0">
          <tr>
            <td colSpan={4} className="px-2 py-2.5 font-bold text-sm">TOTAL</td>
            <td className="px-2 py-2.5 text-right font-bold">{sum(rows, 'basicPay').toLocaleString('en-IN')}</td>
            <td className="px-2 py-2.5" />
            <td className="px-2 py-2.5 text-right font-bold">{sum(rows, 'daAmount').toLocaleString('en-IN')}</td>
            <td className="px-2 py-2.5" />
            <td className="px-2 py-2.5 text-right font-bold">{sum(rows, 'hraAmount').toLocaleString('en-IN')}</td>
            <td className="px-2 py-2.5 text-right font-bold">{sum(rows, 'gross').toLocaleString('en-IN')}</td>
            <td className="px-2 py-2.5 text-right font-bold">{sum(rows, 'nps').toLocaleString('en-IN')}</td>
            <td className="px-2 py-2.5 text-right font-bold">{sum(rows, 'pt').toLocaleString('en-IN')}</td>
            <td className="px-2 py-2.5 text-right font-bold">{sum(rows, 'otherDed').toLocaleString('en-IN')}</td>
            <td className="px-2 py-2.5 text-right font-bold text-[#E8A020]">{formatINR(sum(rows, 'net'))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EditableCell({
  value,
  onChange,
  suffix = '',
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 px-1.5 py-0.5 text-right text-xs border border-[#E2E5EA] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
        min={0}
      />
      {suffix && <span className="text-[#6B7280]">{suffix}</span>}
    </div>
  );
}
