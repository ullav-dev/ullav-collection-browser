"use client";

// Collapsible DAM asset picker panel for use in object forms.
// Renders the @ullav-dev/dam-picker inline when expanded.

import { useState } from "react";
import { DamPicker, type PickedAsset } from "@ullav-dev/dam-picker";

interface Props {
  token: string;
  username?: string;
  /** Called when the user selects an asset. */
  onSelect: (asset: PickedAsset) => void;
  /** Height of the picker panel when open. Default 320px. */
  height?: number;
  /** Toggle button label when closed. */
  label?: string;
}

export default function DamPickerPanel({ token, username, onSelect, height = 320, label }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 5.5 2-3.5 3 6z" clipRule="evenodd" />
        </svg>
        {open ? "Hide media library" : (label ?? "Browse media library…")}
      </button>

      {open && (
        <div
          className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-sm"
          style={{ height }}
        >
          <DamPicker
            apiBase="/api/dam"
            token={token}
            username={username}
            onSelect={(asset) => {
              onSelect(asset);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
