import { useState, useMemo } from 'react';
import { Printer, Download, X } from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import { Button } from '@/components/ui/Button';
import { DeptBadge, StatusBadge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { formatDate, computeServiceYears } from '@/utils/dateUtils';
import { exportReportToExcel } from '@/utils/exportUtils';
import type { StaffRecord } from '@/types';
import { DEPARTMENTS } from '@/constants/enums';

type ReportKey =
  | 'dept-wise'
  | 'teaching'
  | 'non-teaching'
  | 'retired'
  | 'service-register'
  | 'seniority'
  | 'by-designation'
  | 'contact-dir';

interface ReportDef {
  key: ReportKey;
  title: string;
  description: string;
}

const REPORTS: ReportDef[] = [
  { key: 'dept-wise', title: 'Department-wise Staff Register', description: 'All staff grouped by department' },
  { key: 'teaching', title: 'Teaching Staff List', description: 'All teaching staff members' },
  { key: 'non-teaching', title: 'Non-Teaching Staff List', description: 'All non-teaching staff members' },
  { key: 'retired', title: 'Retired Staff List', description: 'Staff with RTRD status' },
  { key: 'service-register', title: 'Service Register', description: 'Name, Emp ID, DOE, DOR, Service Years' },
  { key: 'seniority', title: 'Seniority List', description: 'Sorted by DOE ascending, grouped by designation' },
  { key: 'by-designation', title: 'Staff by Designation', description: 'Grouped pivot view by designation' },
  { key: 'contact-dir', title: 'Contact Directory', description: 'Name, Phone, Email, Dept (no sensitive data)' },
];

function getReport(key: ReportKey, staff: StaffRecord[]): StaffRecord[] {
  switch (key) {
    case 'teaching': return staff.filter((s) => s.type === 'TEACHING');
    case 'non-teaching': return staff.filter((s) => s.type === 'NON-TEACHING');
    case 'retired': return staff.filter((s) => s.status === 'RTRD');
    case 'service-register': return [...staff].sort((a, b) => a.doe.localeCompare(b.doe));
    case 'seniority': return [...staff].sort((a, b) => a.doe.localeCompare(b.doe));
    case 'by-designation': return [...staff].sort((a, b) => a.designation.localeCompare(b.designation));
    case 'dept-wise': return [...staff].sort((a, b) => a.dept.localeCompare(b.dept));
    case 'contact-dir': return [...staff].sort((a, b) => a.name.localeCompare(b.name));
    default: return staff;
  }
}

function toExportRow(key: ReportKey, s: StaffRecord): Record<string, unknown> {
  if (key === 'contact-dir') {
    return { NAME: s.name, DEPT: s.dept, PHONE: s.phone, EMAIL: s.email };
  }
  if (key === 'service-register') {
    return {
      NAME: s.name, 'EMP ID': s.empId, DOE: formatDate(s.doe),
      DOR: formatDate(s.dor), 'SERVICE YEARS': computeServiceYears(s.doe),
    };
  }
  return {
    NAME: s.name, 'EMP ID': s.empId, DESIGNATION: s.designation,
    TYPE: s.type, DEPT: s.dept, STATUS: s.status, DOE: formatDate(s.doe),
  };
}

export default function Reports() {
  const { staff, loading } = useStaff();
  const [activeReport, setActiveReport] = useState<ReportKey | null>(null);

  const reportData = useMemo(
    () => (activeReport ? getReport(activeReport, staff) : []),
    [activeReport, staff]
  );

  const handleExport = () => {
    if (!activeReport) return;
    const rows = reportData.map((s) => toExportRow(activeReport, s));
    const def = REPORTS.find((r) => r.key === activeReport);
    exportReportToExcel(rows, def?.title ?? 'Report', `SMP_${activeReport}`);
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="flex flex-col gap-5">
      {/* Report cards */}
      {!activeReport && (
        <div className="grid grid-cols-2 gap-4">
          {REPORTS.map((r) => (
            <button
              key={r.key}
              onClick={() => setActiveReport(r.key)}
              className="bg-white rounded-xl border border-[#E2E5EA] p-5 text-left hover:border-[#1B3A6B] hover:shadow-sm transition-all"
            >
              <h3 className="text-sm font-semibold text-[#111827] mb-1">{r.title}</h3>
              <p className="text-xs text-[#6B7280]">{r.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Report preview */}
      {activeReport && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between no-print">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">
                {REPORTS.find((r) => r.key === activeReport)?.title}
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">{reportData.length} records</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setActiveReport(null)}>
                <X className="w-3.5 h-3.5" />
                Close
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" />
                Export Excel
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                Print
              </Button>
            </div>
          </div>

          <ReportTable reportKey={activeReport} data={reportData} />
        </div>
      )}
    </div>
  );
}

function ReportTable({ reportKey, data }: { reportKey: ReportKey; data: StaffRecord[] }) {
  if (reportKey === 'contact-dir') {
    return (
      <Table>
        <Thead>
          <tr>
            <Th>Sl</Th><Th>Name</Th><Th>Dept</Th><Th>Phone</Th><Th>Email</Th>
          </tr>
        </Thead>
        <tbody>
          {data.map((s, i) => (
            <Tr key={s.id}>
              <Td>{i + 1}</Td>
              <Td className="font-medium">{s.name}</Td>
              <Td><DeptBadge dept={s.dept} /></Td>
              <Td>{s.phone || '—'}</Td>
              <Td>{s.email || '—'}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    );
  }

  if (reportKey === 'service-register') {
    return (
      <Table>
        <Thead>
          <tr>
            <Th>Sl</Th><Th>Name</Th><Th>Emp ID</Th><Th>DOE</Th><Th>DOR</Th><Th>Service Years</Th>
          </tr>
        </Thead>
        <tbody>
          {data.map((s, i) => (
            <Tr key={s.id}>
              <Td>{i + 1}</Td>
              <Td className="font-medium">{s.name}</Td>
              <Td className="font-mono text-xs">{s.empId}</Td>
              <Td>{formatDate(s.doe)}</Td>
              <Td>{formatDate(s.dor)}</Td>
              <Td>{computeServiceYears(s.doe)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    );
  }

  if (reportKey === 'dept-wise') {
    return (
      <div className="flex flex-col gap-6">
        {DEPARTMENTS.map((dept) => {
          const deptStaff = data.filter((s) => s.dept === dept);
          if (deptStaff.length === 0) return null;
          return (
            <div key={dept}>
              <div className="flex items-center gap-2 mb-2">
                <DeptBadge dept={dept} />
                <span className="text-xs text-[#6B7280]">{deptStaff.length} staff</span>
              </div>
              <StaffMiniTable data={deptStaff} />
            </div>
          );
        })}
      </div>
    );
  }

  if (reportKey === 'seniority' || reportKey === 'by-designation') {
    const groups: Record<string, StaffRecord[]> = {};
    const groupKey = reportKey === 'by-designation' ? 'designation' : 'designation';
    data.forEach((s) => {
      const key = s[groupKey as keyof StaffRecord] as string;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    return (
      <div className="flex flex-col gap-6">
        {Object.entries(groups).map(([group, members]) => (
          <div key={group}>
            <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">{group}</h3>
            <StaffMiniTable data={members} />
          </div>
        ))}
      </div>
    );
  }

  return <StaffMiniTable data={data} />;
}

function StaffMiniTable({ data }: { data: StaffRecord[] }) {
  return (
    <Table>
      <Thead>
        <tr>
          <Th>Sl</Th><Th>Name</Th><Th>Emp ID</Th><Th>Designation</Th>
          <Th>Type</Th><Th>Dept</Th><Th>Status</Th><Th>DOE</Th>
        </tr>
      </Thead>
      <tbody>
        {data.map((s, i) => (
          <Tr key={s.id}>
            <Td className="text-[#6B7280]">{i + 1}</Td>
            <Td className="font-medium">{s.name}</Td>
            <Td className="font-mono text-xs">{s.empId}</Td>
            <Td>{s.designation}</Td>
            <Td className="text-xs text-[#6B7280]">{s.type}</Td>
            <Td><DeptBadge dept={s.dept} /></Td>
            <Td><StatusBadge status={s.status} /></Td>
            <Td className="text-xs">{formatDate(s.doe)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
