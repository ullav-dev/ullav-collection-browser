"use client";

import { useState } from "react";
import GettyAATSearch from "@/components/GettyAATSearch";
import EuropeanaSearch from "@/components/EuropeanaSearch";
import WikidataSearch from "@/components/WikidataSearch";
import type { CollectionObject } from "@/lib/collection-api";

type Source = "getty" | "europeana" | "wikidata";

interface Props {
  onSaveAsNote: (title: string, description: string, body: string) => void;
  contextObject?: CollectionObject | null;
}

const SOURCES: { id: Source; label: string; description: string }[] = [
  {
    id: "getty",
    label: "Getty AAT",
    description: "Controlled vocabulary for art & architecture terminology",
  },
  {
    id: "europeana",
    label: "Europeana",
    description: "50M+ digitised records from European museums & archives",
  },
  {
    id: "wikidata",
    label: "Wikidata",
    description: "Structured data — artists, makers, places, authority IDs",
  },
];

export default function ExplorePanel({ onSaveAsNote, contextObject }: Props) {
  const [source, setSource] = useState<Source>("getty");

  // Each source gets the most relevant initial query from the current object
  function initialQueryFor(src: Source): string | undefined {
    if (!contextObject) return undefined;
    if (src === "wikidata") return contextObject.maker ?? contextObject.title;
    if (src === "europeana") return contextObject.title;
    // Getty: prefer material or object type over title
    return contextObject.object_type ?? contextObject.materials?.[0] ?? undefined;
  }

  return (
    <div className="flex flex-col h-full px-4 py-4 gap-4">
      {/* Source selector */}
      <div className="shrink-0">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSource(s.id)}
              className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-lg transition-all ${
                source === s.id
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 px-1">
          {SOURCES.find((s) => s.id === source)?.description}
        </p>
      </div>

      {/* Active search component */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {source === "getty" && (
          <GettyAATSearch
            onSaveAsNote={onSaveAsNote}
            initialQuery={initialQueryFor("getty")}
          />
        )}
        {source === "europeana" && (
          <EuropeanaSearch
            onSaveAsNote={onSaveAsNote}
            initialQuery={initialQueryFor("europeana")}
          />
        )}
        {source === "wikidata" && (
          <WikidataSearch
            onSaveAsNote={onSaveAsNote}
            initialQuery={initialQueryFor("wikidata")}
          />
        )}
      </div>
    </div>
  );
}
