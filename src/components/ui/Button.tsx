import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    'bg-[#1B3A6B] text-white hover:bg-[#142D55] border border-[#1B3A6B] hover:border-[#142D55]',
  secondary:
    'bg-white text-[#1B3A6B] border border-[#E2E5EA] hover:bg-[#F7F8FA]',
  danger:
    'bg-[#DC2626] text-white hover:bg-red-700 border border-[#DC2626]',
  ghost:
    'bg-transparent text-[#6B7280] hover:bg-[#F7F8FA] border border-transparent',
};

const SIZE_STYLES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center gap-2 rounded-md font-medium transition-colors duration-150 cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
