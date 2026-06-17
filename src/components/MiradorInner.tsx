"use client";

import { useEffect, useRef, useId } from "react";
import { ANNOTATION_PENDING_EVENT, ANNOTATION_SAVED_EVENT } from "./AnnotationEditorPanel";
import type { PendingAnnotation } from "./AnnotationEditorPanel";

interface Props {
  manifestUrl: string;
  token: string;
  username: string;
}

export default function MiradorInner({ manifestUrl, token, username }: Props) {
  const rawId = useId();
  const domId = `mirador-${rawId.replace(/:/g, "")}`;
  const instanceRef = useRef<{ unmount(): void; store?: unknown } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ viewer }, { default: maePlugins }, { CartlannAnnotationAdapter }] =
        await Promise.all([
          import("mirador"),
          import("mirador-annotation-editor"),
          import("@/lib/CartlannAnnotationAdapter"),
        ]);

      if (cancelled) return;

      // Wrap the adapter so that create/update fire events the panel can listen to.
      // The editing panel handles body content; MAE handles spatial targeting only.
      function wrapAdapter(canvasId: string) {
        const adapter = new CartlannAnnotationAdapter(canvasId, username, token);
        const original = {
          create: adapter.create.bind(adapter),
          update: adapter.update.bind(adapter),
        };

        adapter.create = async (annotation: Record<string, unknown>) => {
          // Fire pending event so the panel editor opens
          const pending: PendingAnnotation = {
            id: annotation.id as string | undefined,
            canvasId,
            body: extractMarkdownBody(annotation),
            token,
            username,
          };
          window.dispatchEvent(new CustomEvent(ANNOTATION_PENDING_EVENT, { detail: pending }));
          return original.create(annotation);
        };

        adapter.update = async (annotation: Record<string, unknown>) => {
          const pending: PendingAnnotation = {
            id: annotation.id as string,
            canvasId,
            body: extractMarkdownBody(annotation),
            token,
            username,
          };
          window.dispatchEvent(new CustomEvent(ANNOTATION_PENDING_EVENT, { detail: pending }));
          return original.update(annotation);
        };

        return adapter;
      }

      const { createTheme } = await import("@mui/material");

      const cartlannTheme = createTheme({
        palette: {
          primary: { main: "#0d9488" },    // teal-600
          secondary: { main: "#0f766e" },  // teal-700
        },
      });

      instanceRef.current = viewer(
        {
          id: domId,
          windows: [{ manifestId: manifestUrl }],
          annotation: {
            adapter: wrapAdapter,
            allowTargetShapesStyling: true,
            readonly: false,
            cartlannToken: token,
            cartlannUsername: username,
          },
          workspaceControlPanel: { enabled: false },
          theme: cartlannTheme,
        },
        maePlugins,
      );
    })();

    return () => {
      cancelled = true;
      instanceRef.current?.unmount();
      instanceRef.current = null;
    };
  }, [domId, manifestUrl, token, username]);

  return (
    <div
      id={domId}
      style={{ width: "100%", height: "100%", minHeight: 640 }}
    />
  );
}

function extractMarkdownBody(annotation: Record<string, unknown>): string {
  const body = annotation.body;
  if (!body) return "";
  const bodies = Array.isArray(body) ? body : [body];
  const textBody = bodies.find(
    (b: unknown) =>
      typeof b === "object" &&
      b !== null &&
      (b as Record<string, unknown>).type === "TextualBody",
  ) as Record<string, unknown> | undefined;
  if (!textBody) return "";
  return String(textBody.value ?? "");
}
