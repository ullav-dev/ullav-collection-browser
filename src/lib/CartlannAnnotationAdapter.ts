export interface W3CAnnotation {
  id?: string;
  type?: string;
  [key: string]: unknown;
}

export interface AnnotationPage {
  "@context"?: string;
  id: string;
  type: "AnnotationPage";
  items: W3CAnnotation[];
}

function noteIdFromAnnotationUri(uri: string): string {
  // MAE sets id to "{canvasId}/annotation/{uuid}"; our server returns "{origin}/canvas-annotations/{uuid}"
  const last = uri.split("/").at(-1) ?? "";
  return last;
}

export class CartlannAnnotationAdapter {
  readonly annotationPageId: string;
  private readonly token: string;
  private readonly username: string;

  constructor(annotationPageId: string, username: string, token: string) {
    this.annotationPageId = annotationPageId;
    this.username = username;
    this.token = token;
  }

  getStorageAdapterUser(): string {
    return this.username;
  }

  async all(): Promise<AnnotationPage | null> {
    const res = await fetch(
      `/api/canvas-annotations?canvas_id=${encodeURIComponent(this.annotationPageId)}`,
      { headers: { Authorization: `Bearer ${this.token}` } },
    );
    if (!res.ok) return null;
    return res.json();
  }

  async create(annotation: W3CAnnotation): Promise<AnnotationPage> {
    const res = await fetch("/api/canvas-annotations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        canvas_id: this.annotationPageId,
        annotation,
      }),
    });
    // Return a full AnnotationPage so MAE can update its store
    const saved: W3CAnnotation = await res.json();
    const page = (await this.all()) ?? {
      id: this.annotationPageId,
      type: "AnnotationPage" as const,
      items: [saved],
    };
    return page;
  }

  async update(annotation: W3CAnnotation): Promise<AnnotationPage | null> {
    const id = noteIdFromAnnotationUri(annotation.id ?? "");
    if (!id) return null;
    const res = await fetch(`/api/canvas-annotations/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ annotation }),
    });
    if (!res.ok) return null;
    return this.all();
  }

  async delete(annotationId: string): Promise<AnnotationPage | null> {
    const id = noteIdFromAnnotationUri(annotationId);
    if (!id) return null;
    await fetch(`/api/canvas-annotations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return this.all();
  }

  async get(annotationId: string): Promise<W3CAnnotation | null> {
    const id = noteIdFromAnnotationUri(annotationId);
    if (!id) return null;
    const res = await fetch(`/api/canvas-annotations/${id}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }
}
