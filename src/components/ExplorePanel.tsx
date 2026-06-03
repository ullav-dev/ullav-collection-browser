"use client";

import GettyAATSearch from "@/components/GettyAATSearch";
import EuropeanaSearch from "@/components/EuropeanaSearch";
import WikidataSearch from "@/components/WikidataSearch";
import PASSearch from "@/components/PASSearch";
import type { CollectionObject } from "@/lib/collection-api";

export type ExploreSource = "getty" | "europeana" | "wikidata" | "pas";

interface Props {
  source: ExploreSource;
  onSaveAsNote: (title: string, description: string, body: string) => void;
  contextObject?: CollectionObject | null;
}

// Each source gets the most contextually relevant initial query from the current object
function initialQueryFor(source: ExploreSource, obj: CollectionObject | null | undefined): string | undefined {
  if (!obj) return undefined;
  if (source === "wikidata") return obj.maker ?? obj.title;
  if (source === "europeana") return obj.title;
  return obj.object_type ?? obj.materials?.[0] ?? undefined; // getty: type/material terms
}

export default function ExplorePanel({ source, onSaveAsNote, contextObject }: Props) {
  const q = initialQueryFor(source, contextObject);

  return (
    <div className="flex flex-col h-full px-4 py-4 overflow-y-auto">
      {source === "getty" && (
        <GettyAATSearch onSaveAsNote={onSaveAsNote} initialQuery={q} />
      )}
      {source === "europeana" && (
        <EuropeanaSearch onSaveAsNote={onSaveAsNote} initialQuery={q} />
      )}
      {source === "wikidata" && (
        <WikidataSearch onSaveAsNote={onSaveAsNote} initialQuery={q} />
      )}
      {source === "pas" && (
        <PASSearch contextObject={contextObject} />
      )}
    </div>
  );
}
