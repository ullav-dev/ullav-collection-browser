"use client";

import dynamic from "next/dynamic";

const MiradorSpike = dynamic(() => import("@/components/MiradorSpike"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen text-slate-500">
      Loading Mirador…
    </div>
  ),
});

// Public IIIF manifest for spike testing
const TEST_MANIFEST =
  "https://iiif.io/api/cookbook/recipe/0001-mvm-image/manifest.json";

export default function TestMiradorPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <MiradorSpike manifestUrl={TEST_MANIFEST} />
    </div>
  );
}
