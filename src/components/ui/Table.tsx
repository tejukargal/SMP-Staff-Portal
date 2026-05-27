import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-[#E2E5EA] ${className}`}>
      <table className="w-full text-sm border-collapse table-striped">
        {children}
      </table>
    </div>
  );
}

export function Thead({ children, top = 0 }: { children: React.ReactNode; top?: number }) {
  return (
    <thead className="bg-[#F7F8FA] sticky z-10" style={{ top }}>
      {children}
    </thead>
  );
}

export function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide border-b border-[#E2E5EA] ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2.5 text-sm text-[#111827] border-b border-[#E2E5EA] ${className}`}>
      {children}
    </td>
  );
}

export function Tr({ children, className = '', ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-[#F0F4FF] transition-colors ${className}`} {...rest}>
      {children}
    </tr>
  );
}
