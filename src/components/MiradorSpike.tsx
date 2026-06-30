"use client";

import { useEffect, useRef, useId } from "react";

interface Props {
  manifestUrl: string;
}

export default function MiradorSpike({ manifestUrl }: Props) {
  const rawId = useId();
  const domId = `mirador-${rawId.replace(/:/g, "")}`;
  const instanceRef = useRef<{ unmount(): void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ viewer }, { default: maePlugins }, { annotationAdapters }] =
        await Promise.all([
          import("mirador"),
          import("mirador-annotation-editor"),
          import("mirador-annotation-editor"),
        ]);

      if (cancelled) return;

      instanceRef.current = viewer(
        {
          id: domId,
          windows: [{ manifestId: manifestUrl }],
          annotation: {
            adapter: (canvasId: string) =>
              new annotationAdapters.LocalStorageAdapter(canvasId, "spike-user"),
            allowTargetShapesStyling: true,
            readonly: false,
          },
          workspaceControlPanel: { enabled: false },
        },
        maePlugins,
      );
    })();

    return () => {
      cancelled = true;
      instanceRef.current?.unmount();
      instanceRef.current = null;
    };
  }, [domId, manifestUrl]);

  return (
    <div id={domId} style={{ width: "100%", height: "100%", minHeight: 640 }} />
  );
}
