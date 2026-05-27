import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  uppercase?: boolean;
  hint?: string;
}

export function Input({ label, error, uppercase = false, hint, className = '', onChange, ...props }: InputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uppercase) {
      const syntheticEvent = {
        ...e,
        target: { ...e.target, value: e.target.value.toUpperCase() },
        currentTarget: { ...e.currentTarget, value: e.currentTarget.value.toUpperCase() },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange?.(syntheticEvent);
    } else {
      onChange?.(e);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">
          {label}
          {props.required && <span className="text-[#DC2626] ml-1">*</span>}
        </label>
      )}
      <input
        {...props}
        onChange={handleChange}
        style={uppercase ? { textTransform: 'uppercase', ...props.style } : props.style}
        className={[
          'w-full px-3 py-2 text-sm rounded-md border bg-white text-[#111827]',
          'placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent',
          'disabled:bg-[#F9FAFB] disabled:text-[#6B7280] disabled:cursor-not-allowed',
          error ? 'border-[#DC2626]' : 'border-[#E2E5EA]',
          className,
        ].join(' ')}
      />
      {hint && !error && <p className="text-xs text-[#6B7280]">{hint}</p>}
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}
