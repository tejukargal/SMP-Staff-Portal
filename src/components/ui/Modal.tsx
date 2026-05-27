import React, { useEffect } from 'react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Modal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ animation: 'backdrop-enter 0.2s ease-out' }}
    >
      <div
        className="absolute inset-0 bg-black/40"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={onCancel}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 z-10 border border-gray-100"
        style={{ animation: 'modal-enter 0.25s ease-out' }}
      >
        <h2 className="text-base font-semibold text-[#111827] mb-2">{title}</h2>
        <div className="text-sm text-[#6B7280] mb-6">{message}</div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
