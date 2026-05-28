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
          'w-full px-3 py-2 text-sm rounded-lg border bg-white text-gray-900',
          'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent',
          'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
          error ? 'border-red-400' : 'border-gray-200',
          className,
        ].join(' ')}
      />
      {hint && !error && <p className="text-xs text-[#6B7280]">{hint}</p>}
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}
