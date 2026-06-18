"use client";

import dynamic from "next/dynamic";

const IiifViewerInner = dynamic(() => import("./IiifViewerInner"), { ssr: false });

interface Props {
  manifestUrl: string;
  objectTitle: string;
  onClose: () => void;
}

export function IiifViewerModal({ manifestUrl, objectTitle, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={objectTitle}
    >
      <IiifViewerInner manifestUrl={manifestUrl} />
      <button
        onClick={onClose}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[9999] text-white/80 hover:text-white text-xs px-5 py-1.5 rounded-full bg-black/70 hover:bg-black/90 border border-white/30 hover:border-white/60 transition-colors"
      >
        Close viewer
      </button>
    </div>
  );
}
