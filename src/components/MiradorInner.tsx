"use client";

import { useEffect, useRef, useId } from "react";
import "mirador-annotation-editor/dist/index.css";
import {
  ANNOTATION_PENDING_EVENT,
  ANNOTATION_SAVED_EVENT,
  ANNOTATION_ID_ASSIGNED_EVENT,
  ANNOTATION_COMPLETE_EVENT,
  getCurrentAnnotationBody,
} from "./AnnotationEditorPanel";
import type { PendingAnnotation } from "./AnnotationEditorPanel";

interface Props {
  manifestUrl: string;
  token: string;
  username: string;
  collectionId?: string;
  onAllWindowsClosed?: () => void;
}

// Mirador 4 and MAE 1.x produce several console.error warnings under React 19:
//   - element.ref deprecation (React 19 compat — still functional)
//   - <HotKey /> casing (Mirador internal component)
// These are all third-party library issues; suppress them while Mirador is mounted.
const MIRADOR_SUPPRESSED_WARNINGS = [
  "Accessing element.ref was removed",
  "is using incorrect casing",
  "is unrecognized in this browser",
  "synchronously unmount a root while React was already rendering",
];

function suppressMiradorWarnings() {
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && MIRADOR_SUPPRESSED_WARNINGS.some((w) => (args[0] as string).includes(w))) return;
    orig(...args);
  };
  return () => { console.error = orig; };
}

export default function MiradorInner({ manifestUrl, token, username, collectionId, onAllWindowsClosed }: Props) {
  const rawId = useId();
  const domId = `mirador-${rawId.replace(/:/g, "")}`;
  const instanceRef = useRef<{ unmount(): void; store?: unknown } | null>(null);
  // Keep a ref so closures inside the viewer always see the latest collectionId
  // (the viewer is only created once; collectionId may update as collections load).
  const collectionIdRef = useRef(collectionId);
  collectionIdRef.current = collectionId;
  const onAllWindowsClosedRef = useRef(onAllWindowsClosed);
  onAllWindowsClosedRef.current = onAllWindowsClosed;

  useEffect(() => {
    const restoreConsole = suppressMiradorWarnings();
    let cancelled = false;
    let unsubscribeStore: (() => void) | undefined;

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
        const adapter = new CartlannAnnotationAdapter(canvasId, username, token, () => collectionIdRef.current);
        const original = {
          create: adapter.create.bind(adapter),
          update: adapter.update.bind(adapter),
        };

        adapter.create = async (annotation: Record<string, unknown>) => {
          // Merge whatever the user typed in the right-panel editor into the annotation.
          const bodyText = getCurrentAnnotationBody();
          const annotationWithBody: Record<string, unknown> = bodyText
            ? { ...annotation, body: { type: "TextualBody", format: "text/markdown", value: bodyText } }
            : annotation;

          const result = await original.create(annotationWithBody);

          // Extract the note UUID from the saved annotation id (…/annotation/{uuid}).
          const savedId = (result as { items?: Array<{ id?: string }> })?.items?.[0]?.id ?? "";
          const noteId = savedId.split("/").at(-1) ?? "";

          // Notify the panel (flash "Saved", clear body) and refresh the notes list.
          window.dispatchEvent(new CustomEvent(ANNOTATION_COMPLETE_EVENT));
          window.dispatchEvent(new CustomEvent(ANNOTATION_SAVED_EVENT, { detail: { canvasId, noteId } }));
          return result;
        };

        adapter.update = async (annotation: Record<string, unknown>) => {
          // Open the panel with existing body so the user can edit it.
          window.dispatchEvent(new CustomEvent(ANNOTATION_PENDING_EVENT, {
            detail: {
              id: annotation.id as string,
              canvasId,
              body: extractMarkdownBody(annotation),
              token,
              username,
              collectionId: collectionIdRef.current,
            } satisfies PendingAnnotation,
          }));
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

      // Subscribe to Redux state changes to detect when MAE opens the annotation-creation
      // companion window. store.subscribe() is reliable — unlike replacing store.dispatch,
      // it doesn't depend on whether React-Redux components have captured the dispatch ref.
      const store = (instanceRef.current as unknown as {
        store: {
          getState: () => Record<string, unknown>;
          subscribe: (cb: () => void) => () => void;
        };
      } | null)?.store;

      if (store) {
        let prevHadAnnotationCreation = false;
        let prevWindowCount = -1;

        unsubscribeStore = store.subscribe(() => {
          const state = store.getState();
          const windows = state.windows as Record<string, { canvasId?: string }> | undefined;

          // When the last Mirador window is closed, notify the parent.
          const windowCount = Object.keys(windows ?? {}).length;
          if (prevWindowCount > 0 && windowCount === 0) {
            onAllWindowsClosedRef.current?.();
          }
          prevWindowCount = windowCount;

          const companionWindows = state.companionWindows as
            | Record<string, { content?: string; windowId?: string } | null>
            | undefined;

          const cwEntry = Object.values(companionWindows ?? {}).find(
            (cw) => cw?.content === "annotationCreation",
          );
          const hasAnnotationCreation = cwEntry !== undefined;

          if (hasAnnotationCreation && !prevHadAnnotationCreation) {
            prevHadAnnotationCreation = true;
            const windowId = cwEntry?.windowId ?? "";
            const canvasId = windows?.[windowId]?.canvasId ?? "";

            window.dispatchEvent(
              new CustomEvent(ANNOTATION_PENDING_EVENT, {
                detail: {
                  id: undefined,
                  canvasId,
                  body: "",
                  token,
                  username,
                  collectionId: collectionIdRef.current,
                } satisfies PendingAnnotation,
              }),
            );
          } else if (!hasAnnotationCreation && prevHadAnnotationCreation) {
            prevHadAnnotationCreation = false;
          }
        });
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeStore?.();
      instanceRef.current?.unmount();
      instanceRef.current = null;
      restoreConsole();
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
