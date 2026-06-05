"use client";

import { useState, useMemo } from "react";
import type { CollectionObject } from "@/lib/collection-api";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAS_BASE = "https://finds.org.uk/database/search/results";

// Sutton Hoo helmet reconstruction — British Museum, public domain, Wikimedia Commons
const HERO_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/e/ee/Sutton_Hoo_helmet_2016.png";

// Common object types in the PAS database (value = PAS objectType path segment)
const OBJECT_TYPES = [
  { label: "All types", value: "" },
  { label: "Brooch / Fibula", value: "BROOCH" },
  { label: "Coin", value: "COIN" },
  { label: "Finger ring", value: "FINGER+RING" },
  { label: "Strap fitting", value: "STRAP+FITTING" },
  { label: "Buckle", value: "BUCKLE" },
  { label: "Pin", value: "PIN" },
  { label: "Pendant", value: "PENDANT" },
  { label: "Fitting / Mount", value: "FITTING" },
  { label: "Weight", value: "WEIGHT" },
  { label: "Seal / Seal matrix", value: "SEAL" },
  { label: "Vessel / Bowl", value: "VESSEL" },
  { label: "Arrowhead / Projectile", value: "ARROWHEAD" },
  { label: "Sword / Dagger", value: "SWORD" },
  { label: "Axe", value: "AXE" },
  { label: "Key", value: "KEY" },
  { label: "Token / Jetton", value: "TOKEN" },
];

const PERIODS = [
  { label: "All periods", value: "" },
  { label: "Prehistoric", value: "PREHISTORIC" },
  { label: "Bronze Age", value: "BRONZE+AGE" },
  { label: "Iron Age", value: "IRON+AGE" },
  { label: "Roman", value: "ROMAN" },
  { label: "Early Medieval", value: "EARLY+MEDIEVAL" },
  { label: "Medieval", value: "MEDIEVAL" },
  { label: "Post Medieval", value: "POST+MEDIEVAL" },
  { label: "Modern", value: "MODERN" },
  { label: "Unknown", value: "UNKNOWN" },
];

const MATERIALS = [
  { label: "All materials", value: "" },
  { label: "Copper alloy", value: "COPPER+ALLOY" },
  { label: "Silver", value: "SILVER" },
  { label: "Gold", value: "GOLD" },
  { label: "Lead / Lead alloy", value: "LEAD" },
  { label: "Iron", value: "IRON" },
  { label: "Bone / Antler / Ivory", value: "BONE" },
  { label: "Jet / Shale", value: "JET" },
  { label: "Stone", value: "STONE" },
  { label: "Pottery", value: "POTTERY" },
  { label: "Glass", value: "GLASS" },
];

const COUNTIES = [
  { label: "All counties", value: "" },
  "Bedfordshire", "Berkshire", "Bristol", "Buckinghamshire",
  "Cambridgeshire", "Cheshire", "Cornwall", "Cumbria",
  "Derbyshire", "Devon", "Dorset", "Durham",
  "East Riding of Yorkshire", "East Sussex", "Essex",
  "Gloucestershire", "Greater London", "Greater Manchester",
  "Hampshire", "Herefordshire", "Hertfordshire",
  "Isle of Wight", "Kent",
  "Lancashire", "Leicestershire", "Lincolnshire",
  "Merseyside", "Norfolk", "North Yorkshire", "Northamptonshire",
  "Northumberland", "Nottinghamshire", "Oxfordshire",
  "Shropshire", "Somerset", "South Yorkshire", "Staffordshire",
  "Suffolk", "Surrey", "Tyne and Wear",
  "Warwickshire", "West Midlands", "West Sussex", "West Yorkshire",
  "Wiltshire", "Worcestershire",
  // Wales
  "Clwyd", "Dyfed", "Gwent", "Gwynedd", "Mid Glamorgan",
  "Powys", "South Glamorgan", "West Glamorgan",
].map((c) => typeof c === "string" ? { label: c, value: c } : c);

// ── URL builder ───────────────────────────────────────────────────────────────

function buildUrl(q: string, objectType: string, period: string, material: string, county: string): string {
  const segments: string[] = [PAS_BASE];

  if (q.trim()) {
    segments.push("q", encodeURIComponent(q.trim()).replace(/%20/g, "+"));
  }
  if (objectType) segments.push("objectType", objectType);
  if (period) segments.push("broadperiod", period);
  if (material) segments.push("material", material);
  if (county) segments.push("county", encodeURIComponent(county).replace(/%20/g, "+"));

  return segments.join("/");
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  contextObject?: CollectionObject | null;
}

export default function PASSearch({ contextObject }: Props) {
  const [q, setQ] = useState(contextObject?.title ?? "");
  const [objectType, setObjectType] = useState("");
  const [period, setPeriod] = useState("");
  const [material, setMaterial] = useState(
    contextObject?.materials?.[0]?.toUpperCase().replace(/\s+/g, "+") ?? ""
  );
  const [county, setCounty] = useState("");

  const searchUrl = useMemo(
    () => buildUrl(q, objectType, period, material, county),
    [q, objectType, period, material, county]
  );

  const hasQuery = q.trim() || objectType || period || material || county;

  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm " +
    "focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-800 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt="Sutton Hoo helmet replica — British Museum"
          className="w-full object-cover max-h-48 opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-white font-semibold text-base leading-snug drop-shadow">
              Portable Antiquities Scheme
            </p>
            <p className="text-slate-200 text-xs mt-0.5 drop-shadow">
              British Museum — 1.7 million recorded archaeological finds from England & Wales
            </p>
          </div>
          <img
            src="https://finds.org.uk/favicon.ico"
            alt=""
            className="w-8 h-8 rounded bg-white/10 p-1 shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      </div>

      {/* What the database contains */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 shrink-0">
        {[
          "Object type & description",
          "Historical period",
          "Primary material",
          "County & find spot",
          "Photographs & drawings",
          "Parallels & comparanda",
        ].map((item) => (
          <div
            key={item}
            className="flex items-center gap-1.5 text-xs text-slate-600 bg-teal-50 border border-teal-100 rounded-lg px-3 py-1.5"
          >
            <span className="text-teal-500">•</span> {item}
          </div>
        ))}
      </div>

      {/* Search form */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 shrink-0">
        <p className="text-xs font-medium text-slate-600">
          Build a search — opens the PAS database in a new tab with your filters pre-filled.
        </p>

        {/* Free text */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Description / keywords</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. enamelled brooch, Colchester derivative…"
            className={inputCls}
          />
        </div>

        {/* Grid of dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Object type</label>
            <select value={objectType} onChange={(e) => setObjectType(e.target.value)} className={inputCls}>
              {OBJECT_TYPES.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls}>
              {PERIODS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Material</label>
            <select value={material} onChange={(e) => setMaterial(e.target.value)} className={inputCls}>
              {MATERIALS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">County (England & Wales)</label>
            <select value={county} onChange={(e) => setCounty(e.target.value)} className={inputCls}>
              {COUNTIES.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search button */}
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 w-full justify-center bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          {hasQuery ? "Search PAS database" : "Browse all PAS records"}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
        <p className="text-xs text-slate-400 text-center">Opens in a new tab on finds.org.uk</p>
      </div>

      {/* Attribution */}
      <p className="text-xs text-slate-400 text-center shrink-0">
        Data from the{" "}
        <a
          href="https://finds.org.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          Portable Antiquities Scheme
        </a>
        {" "}— © The Trustees of the British Museum, CC BY licence
      </p>
    </div>
  );
}
