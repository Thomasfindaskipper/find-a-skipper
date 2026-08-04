import React from 'react';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-gray-500">{label}</span>
      {children}
      {hint && <span className="block text-xs mt-1 text-gray-500">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2.5 text-[14.5px] outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2.5 text-[14.5px] outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 min-h-[80px]"
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2.5 text-[14.5px] outline-none bg-white focus:border-navy focus:ring-2 focus:ring-navy/15"
    />
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' }) {
  const styles = {
    primary: 'bg-navy text-white hover:bg-navyDeep',
    outline: 'bg-white text-navyDeep border-2 border-navyDeep',
    ghost: 'bg-transparent text-gray-500',
  } as const;
  return (
    <button
      {...props}
      className={`font-bold rounded-xl px-5 py-3 text-[15px] transition disabled:opacity-60 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-white/90 text-navy">
      {children}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 mb-5 p-3 rounded-lg text-sm bg-red-50 text-red-700">
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  text,
  actionLabel,
  actionHref,
}: {
  text: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="text-center py-20 rounded-2xl bg-white border border-navy/[0.08]">
      <p className="text-sm mb-4 text-gray-500">{text}</p>
      {actionLabel && actionHref && (
        <a href={actionHref} className="inline-block font-semibold text-sm px-4 py-2.5 rounded-lg bg-navy text-white">
          {actionLabel}
        </a>
      )}
    </div>
  );
}

export function initials(name: string) {
  return (name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}
