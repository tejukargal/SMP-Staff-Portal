import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div
      className={`overflow-auto rounded-2xl border border-sky-100 bg-white/80 ${className}`}
      style={{ boxShadow: '0 1px 4px 0 rgba(14,165,233,0.06)' }}
    >
      <table className="w-full text-sm border-collapse table-striped">
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead
      className="sticky top-0 z-10"
      style={{ background: 'linear-gradient(90deg, #e0f2fe, #eff6ff)' }}
    >
      {children}
    </thead>
  );
}

export function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-sky-100 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2.5 text-sm text-gray-800 border-b border-sky-50 ${className}`}>
      {children}
    </td>
  );
}

export function Tr({ children, className = '', ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-sky-50/70 transition-colors ${className}`} {...rest}>
      {children}
    </tr>
  );
}
