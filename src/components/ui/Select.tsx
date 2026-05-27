import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">
          {label}
          {props.required && <span className="text-[#DC2626] ml-1">*</span>}
        </label>
      )}
      <select
        {...props}
        className={[
          'w-full px-3 py-2 text-sm rounded-md border bg-white text-[#111827]',
          'focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent',
          'disabled:bg-[#F9FAFB] disabled:text-[#6B7280] disabled:cursor-not-allowed',
          error ? 'border-[#DC2626]' : 'border-[#E2E5EA]',
          className,
        ].join(' ')}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}
