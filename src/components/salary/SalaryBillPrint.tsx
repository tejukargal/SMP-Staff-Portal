import type { SalaryRow } from '@/types';

interface Props {
  rows: SalaryRow[];
  month: string;
  year: number;
}

function sum(rows: SalaryRow[], key: keyof SalaryRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

export function SalaryBillPrint({ rows, month, year }: Props) {
  return (
    <div className="print-only p-8 font-sans text-black bg-white">
      {/* Letterhead */}
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-xl font-bold uppercase tracking-widest">
          Sanjay Memorial Polytechnic
        </h1>
        <p className="text-sm mt-1">Sagar, Karnataka — Aided Diploma Engineering Institution</p>
        <h2 className="text-base font-bold mt-3 uppercase">
          Salary Bill — {month} {year}
        </h2>
      </div>

      {/* Table */}
      <table className="w-full text-[10px] border-collapse border border-black">
        <thead>
          <tr className="bg-gray-100">
            {['Sl', 'Name', 'Desig.', 'Dept', 'Basic', 'DA', 'HRA', 'Gross', 'NPS', 'PT', 'Oth.', 'Net'].map((h) => (
              <th key={h} className="border border-black px-1 py-1 text-left font-bold uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.staffId} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
              <td className="border border-black px-1 py-1">{i + 1}</td>
              <td className="border border-black px-1 py-1 font-medium">{r.name}</td>
              <td className="border border-black px-1 py-1">{r.designation}</td>
              <td className="border border-black px-1 py-1">{r.dept}</td>
              <td className="border border-black px-1 py-1 text-right">{r.basicPay.toLocaleString('en-IN')}</td>
              <td className="border border-black px-1 py-1 text-right">{r.daAmount.toLocaleString('en-IN')}</td>
              <td className="border border-black px-1 py-1 text-right">{r.hraAmount.toLocaleString('en-IN')}</td>
              <td className="border border-black px-1 py-1 text-right font-medium">{r.gross.toLocaleString('en-IN')}</td>
              <td className="border border-black px-1 py-1 text-right">{r.nps.toLocaleString('en-IN')}</td>
              <td className="border border-black px-1 py-1 text-right">{r.pt.toLocaleString('en-IN')}</td>
              <td className="border border-black px-1 py-1 text-right">{r.otherDed.toLocaleString('en-IN')}</td>
              <td className="border border-black px-1 py-1 text-right font-bold">{r.net.toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold bg-gray-200">
            <td colSpan={4} className="border border-black px-1 py-1 text-right uppercase">Total</td>
            <td className="border border-black px-1 py-1 text-right">{sum(rows, 'basicPay').toLocaleString('en-IN')}</td>
            <td className="border border-black px-1 py-1 text-right">{sum(rows, 'daAmount').toLocaleString('en-IN')}</td>
            <td className="border border-black px-1 py-1 text-right">{sum(rows, 'hraAmount').toLocaleString('en-IN')}</td>
            <td className="border border-black px-1 py-1 text-right">{sum(rows, 'gross').toLocaleString('en-IN')}</td>
            <td className="border border-black px-1 py-1 text-right">{sum(rows, 'nps').toLocaleString('en-IN')}</td>
            <td className="border border-black px-1 py-1 text-right">{sum(rows, 'pt').toLocaleString('en-IN')}</td>
            <td className="border border-black px-1 py-1 text-right">{sum(rows, 'otherDed').toLocaleString('en-IN')}</td>
            <td className="border border-black px-1 py-1 text-right">{sum(rows, 'net').toLocaleString('en-IN')}</td>
          </tr>
        </tfoot>
      </table>

      {/* Signatures */}
      <div className="mt-12 flex justify-between text-xs">
        <div className="text-center">
          <div className="border-t border-black w-40 pt-1">Prepared By</div>
        </div>
        <div className="text-center">
          <div className="border-t border-black w-40 pt-1">Checked By</div>
        </div>
        <div className="text-center">
          <div className="border-t border-black w-40 pt-1">Principal</div>
        </div>
      </div>
    </div>
  );
}
