"use client";

import { useEffect, useRef } from "react";
import type { Viewer as UniversalViewer } from "universalviewer";
import "universalviewer/dist/esm/index.css";

interface Props {
  manifestUrl: string;
}

export default function IiifViewerInner({ manifestUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<UniversalViewer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // UV needs explicit pixel dimensions — percentage/vh sizing is not picked up correctly.
    function setDimensions() {
      if (!container) return;
      container.style.width = `${window.innerWidth}px`;
      container.style.height = `${window.innerHeight}px`;
    }
    setDimensions();

    let cancelled = false;
    import("universalviewer").then(({ init }) => {
      if (cancelled || !containerRef.current) return;
      viewerRef.current = init(containerRef.current, { iiifManifestId: manifestUrl });
    });

    function handleResize() {
      setDimensions();
      viewerRef.current?.resize();
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [manifestUrl]);

  return <div ref={containerRef} className="uv" />;
}
