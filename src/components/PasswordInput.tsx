"use client";

import { useState } from "react";

interface Props {
  id?: string;
  required?: boolean;
  minLength?: number;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm w-full focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 pr-16";

export default function PasswordInput({ id, required, minLength, value, onChange, placeholder }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
