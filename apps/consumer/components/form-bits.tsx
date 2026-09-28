import type { ReactNode } from "react";

// Small shared pieces for the simple public forms (suggest, contact).

export function FormField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-sm text-gray-500">{hint}</p>}
    </div>
  );
}

export function FormDone({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div role="status" className="rounded-3xl border border-line bg-white p-8 text-center sm:p-10">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-moss">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <h2 className="font-display mt-5 text-3xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-gray-600">{body}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
