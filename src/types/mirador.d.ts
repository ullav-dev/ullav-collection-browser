declare module "mirador-annotation-editor" {
  export interface AnnotationAdapter {
    all(): Promise<unknown>;
    create(annotation: unknown): Promise<unknown>;
    update(annotation: unknown): Promise<unknown>;
    delete(id: string): Promise<unknown>;
    get(id: string): Promise<unknown>;
  }

  export const annotationAdapters: {
    LocalStorageAdapter: new (annotationPageId: string, user?: string) => AnnotationAdapter;
    AiiinotateAdapter: new (...args: unknown[]) => AnnotationAdapter;
  };

  const plugins: unknown[];
  export default plugins;
}

declare module "mirador" {
  export interface MiradorInstance {
    unmount(): void;
    store: import("redux").Store;
  }

  export interface MiradorConfig {
    id: string;
    windows?: Array<{ manifestId?: string; [key: string]: unknown }>;
    annotation?: {
      adapter?: (canvasId: string) => unknown;
      allowTargetShapesStyling?: boolean;
      readonly?: boolean;
      [key: string]: unknown;
    };
    workspace?: Record<string, unknown>;
    workspaceControlPanel?: { enabled?: boolean };
    [key: string]: unknown;
  }

  export function viewer(
    config: MiradorConfig,
    plugins?: unknown[] | { plugins?: unknown[] },
  ): MiradorInstance;

  export function selectAnnotation(
    windowId: string,
    canvasId: string,
    annotationId: string,
  ): unknown;
}
