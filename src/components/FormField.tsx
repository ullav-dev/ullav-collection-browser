export const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full " +
  "focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

export const selectCls = inputCls;

interface Props {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export default function FormField({ label, htmlFor, hint, required, children }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
      {message}
    </div>
  );
}

export function SaveButton({ saving, label = "Save" }: { saving: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
    >
      {saving ? "Saving…" : label}
    </button>
  );
}
