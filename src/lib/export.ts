// Browser-side export functions — JSON, CSV, and LIDO XML.
// All produce a Blob that can be downloaded via a URL.createObjectURL link.

import type { CollectionObject } from "./collection-api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeCsv(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function dateLabel(obj: CollectionObject): string {
  if (obj.date_from == null) return "";
  const precision = obj.date_precision ? `${obj.date_precision} ` : "";
  if (obj.date_to && obj.date_to !== obj.date_from) {
    return `${precision}${obj.date_from}–${obj.date_to}`;
  }
  return `${precision}${obj.date_from}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── JSON export ───────────────────────────────────────────────────────────────

export function exportJson(objects: CollectionObject[], filename?: string) {
  const blob = new Blob([JSON.stringify(objects, null, 2)], { type: "application/json" });
  triggerDownload(blob, filename ?? `cartlann-export-${today()}.json`);
}

// ── CSV export (Spectrum-aligned columns) ─────────────────────────────────────

export const CSV_COLUMNS = [
  "id", "accession_number", "title", "object_name", "object_type", "maker",
  "date_from", "date_to", "date_precision", "materials",
  "brief_description", "current_condition",
  "rights_holder", "copyright_status",
  "status", "is_accessioned", "is_public",
  "created_at", "updated_at",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

function objectToCsvRow(obj: CollectionObject): string {
  return CSV_COLUMNS.map(col => {
    if (col === "materials") return escapeCsv(obj.materials.join(";"));
    return escapeCsv(obj[col as keyof CollectionObject]);
  }).join(",");
}

export function exportCsv(objects: CollectionObject[], filename?: string) {
  const header = CSV_COLUMNS.join(",");
  const rows = objects.map(objectToCsvRow);
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  triggerDownload(blob, filename ?? `cartlann-export-${today()}.csv`);
}

// ── LIDO XML export (LIDO 1.0, Spectrum-aligned) ──────────────────────────────
//
// Field mapping — the LIDO importer must invert this exactly:
//   title             → titleWrap/titleSet/appellationValue[pref=preferred]
//   object_name       → objectWorkTypeWrap/objectWorkType/term  (Spectrum "object name" = type-of-thing)
//   object_type       → classificationWrap/classification/term  (broader category; only when ≠ object_name)
//   maker             → Production event / eventActor / appellationValue
//   date_from/to      → Production event / eventDate / date / earliestDate + latestDate
//   date_precision    → affects displayDate qualifier and omission of earliest/latest bounds
//   materials[]       → Production event / eventMaterialsTech: displayMaterialsTech + termMaterialsTech per item
//   brief_description → objectDescriptionWrap / descriptiveNoteValue
//   dimensions        → objectMeasurementsWrap / objectMeasurementsSet (display + structured)
//   current_condition → Condition Assessment event / eventDescriptionSet / descriptiveNoteValue
//   accession_number  → repositoryWrap/workID[type=accession number] + recordWrap/recordID
//   rights_holder     → rightsWorkWrap / rightsHolder / legalBodyName
//   copyright_status  → recordWrap / recordRights / rightsType / term
//
// lido:category (CIDOC-CRM class) is intentionally omitted — Cartlann is domain-agnostic
// (archives, manuscripts, natural history, art) so no single CRM class applies uniformly.

function buildLidoDate(obj: CollectionObject): string {
  const display = dateLabel(obj);
  if (!display && obj.date_from == null) return "";
  const prec = obj.date_precision;
  let earliest = "";
  let latest = "";
  if (obj.date_from != null) {
    if (prec !== "before") earliest = String(obj.date_from);
    if (prec !== "after") latest = String(obj.date_to ?? obj.date_from);
  }
  const structuredPart =
    earliest || latest
      ? [
          "              <lido:date>",
          earliest ? `                <lido:earliestDate>${earliest}</lido:earliestDate>` : "",
          latest ? `                <lido:latestDate>${latest}</lido:latestDate>` : "",
          "              </lido:date>",
        ]
          .filter(Boolean)
          .join("\n")
      : "";
  return [
    "<lido:eventDate>",
    display ? `              <lido:displayDate>${escapeXml(display)}</lido:displayDate>` : "",
    structuredPart,
    "            </lido:eventDate>",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildLidoDimensions(dims: Record<string, unknown>): string {
  let display = "";
  let structuredSets = "";

  if (typeof dims.raw === "string") {
    display = escapeXml(dims.raw);
  } else {
    const parts: string[] = [];
    const sets: string[] = [];
    for (const [key, val] of Object.entries(dims)) {
      if (typeof val === "object" && val !== null) {
        const d = val as { value?: unknown; unit?: unknown };
        if (typeof d.value === "number") {
          parts.push(`${key}: ${d.value}${typeof d.unit === "string" ? " " + d.unit : ""}`);
          sets.push(
            [
              "              <lido:measurementsSet>",
              `                <lido:measurementType>${escapeXml(key)}</lido:measurementType>`,
              typeof d.unit === "string"
                ? `                <lido:measurementUnit>${escapeXml(d.unit)}</lido:measurementUnit>`
                : "",
              `                <lido:measurementValue>${d.value}</lido:measurementValue>`,
              "              </lido:measurementsSet>",
            ]
              .filter(Boolean)
              .join("\n")
          );
        }
      }
    }
    if (parts.length > 0) {
      display = escapeXml(parts.join(", "));
      structuredSets = sets.join("\n");
    }
  }

  if (!display) return "";
  return [
    "<lido:objectMeasurementsWrap>",
    "          <lido:objectMeasurementsSet>",
    `            <lido:displayObjectMeasurements>${display}</lido:displayObjectMeasurements>`,
    structuredSets
      ? `            <lido:objectMeasurements>\n${structuredSets}\n            </lido:objectMeasurements>`
      : "",
    "          </lido:objectMeasurementsSet>",
    "        </lido:objectMeasurementsWrap>",
  ]
    .filter(Boolean)
    .join("\n");
}

function lidoRecord(obj: CollectionObject, institutionName: string): string {
  const x = escapeXml;
  const id = x(obj.id);
  const institution = x(institutionName);
  const accession = obj.accession_number ? x(obj.accession_number) : "";
  const description = obj.brief_description ? x(obj.brief_description) : "";
  const rightsHolder = obj.rights_holder ? x(obj.rights_holder) : "";
  const copyrightStatus = x(obj.copyright_status ?? "Unknown");
  const maker = obj.maker ? x(obj.maker) : "";
  const condition = obj.current_condition ? x(obj.current_condition) : "";

  // objectWorkType = Spectrum "object name" (specific type, e.g. "vase")
  // classificationWrap = broader category (e.g. "ceramics") only when distinct
  const workTypeTerm = obj.object_name
    ? x(obj.object_name)
    : obj.object_type
    ? x(obj.object_type)
    : "Object";
  const classificationTerm =
    obj.object_type && obj.object_name && obj.object_type !== obj.object_name
      ? x(obj.object_type)
      : "";

  const dateXml = buildLidoDate(obj);
  const hasMaterials = obj.materials.length > 0;
  const materialsXml = hasMaterials
    ? [
        "<lido:eventMaterialsTech>",
        `              <lido:displayMaterialsTech>${x(obj.materials.join("; "))}</lido:displayMaterialsTech>`,
        "              <lido:materialsTech>",
        ...obj.materials.map(
          m =>
            `                <lido:termMaterialsTech>\n                  <lido:term>${x(m)}</lido:term>\n                </lido:termMaterialsTech>`
        ),
        "              </lido:materialsTech>",
        "            </lido:eventMaterialsTech>",
      ].join("\n")
    : "";

  const hasProductionEvent = !!(maker || dateXml || hasMaterials);
  const hasEventWrap = hasProductionEvent || !!condition;
  const dimensionsXml = obj.dimensions ? buildLidoDimensions(obj.dimensions) : "";

  return `  <lido:lido>
    <lido:lidoRecID lido:type="local">${id}</lido:lidoRecID>
    <lido:descriptiveMetadata xml:lang="en">
      <lido:objectClassificationWrap>
        <lido:objectWorkTypeWrap>
          <lido:objectWorkType>
            <lido:term>${workTypeTerm}</lido:term>
          </lido:objectWorkType>
        </lido:objectWorkTypeWrap>
        ${classificationTerm ? `<lido:classificationWrap>
          <lido:classification>
            <lido:term>${classificationTerm}</lido:term>
          </lido:classification>
        </lido:classificationWrap>` : ""}
      </lido:objectClassificationWrap>
      <lido:objectIdentificationWrap>
        <lido:titleWrap>
          <lido:titleSet>
            <lido:appellationValue xml:lang="en" lido:pref="preferred">${x(obj.title)}</lido:appellationValue>
          </lido:titleSet>
        </lido:titleWrap>
        <lido:repositoryWrap>
          <lido:repositorySet lido:type="current">
            <lido:repositoryName>
              <lido:legalBodyName>
                <lido:appellationValue>${institution}</lido:appellationValue>
              </lido:legalBodyName>
            </lido:repositoryName>
            ${accession ? `<lido:workID lido:type="accession number">${accession}</lido:workID>` : ""}
            <lido:workID lido:type="local">${id}</lido:workID>
          </lido:repositorySet>
        </lido:repositoryWrap>
        ${description ? `<lido:objectDescriptionWrap>
          <lido:objectDescriptionSet>
            <lido:descriptiveNoteValue>${description}</lido:descriptiveNoteValue>
          </lido:objectDescriptionSet>
        </lido:objectDescriptionWrap>` : ""}
        ${dimensionsXml}
      </lido:objectIdentificationWrap>
      ${hasEventWrap ? `<lido:eventWrap>
        ${hasProductionEvent ? `<lido:eventSet>
          <lido:event>
            <lido:eventType>
              <lido:term lido:pref="preferred">Production</lido:term>
            </lido:eventType>
            ${maker ? `<lido:eventActor>
              <lido:actorInRole>
                <lido:actor>
                  <lido:nameActorSet>
                    <lido:appellationValue xml:lang="en">${maker}</lido:appellationValue>
                  </lido:nameActorSet>
                </lido:actor>
                <lido:roleActor>
                  <lido:term>maker</lido:term>
                </lido:roleActor>
              </lido:actorInRole>
            </lido:eventActor>` : ""}
            ${dateXml}
            ${materialsXml}
          </lido:event>
        </lido:eventSet>` : ""}
        ${condition ? `<lido:eventSet>
          <lido:event>
            <lido:eventType>
              <lido:term lido:pref="preferred">Condition Assessment</lido:term>
            </lido:eventType>
            <lido:eventDescriptionSet>
              <lido:descriptiveNoteValue>${condition}</lido:descriptiveNoteValue>
            </lido:eventDescriptionSet>
          </lido:event>
        </lido:eventSet>` : ""}
      </lido:eventWrap>` : ""}
    </lido:descriptiveMetadata>
    <lido:administrativeMetadata xml:lang="en">
      ${rightsHolder ? `<lido:rightsWorkWrap>
        <lido:rightsWorkSet>
          <lido:rightsHolder>
            <lido:legalBodyName>
              <lido:appellationValue>${rightsHolder}</lido:appellationValue>
            </lido:legalBodyName>
          </lido:rightsHolder>
        </lido:rightsWorkSet>
      </lido:rightsWorkWrap>` : ""}
      <lido:recordWrap>
        <lido:recordID lido:type="local">${id}</lido:recordID>
        ${accession ? `<lido:recordID lido:type="accession number">${accession}</lido:recordID>` : ""}
        <lido:recordType>
          <lido:term>item</lido:term>
        </lido:recordType>
        <lido:recordSource>
          <lido:legalBodyName>
            <lido:appellationValue>${institution}</lido:appellationValue>
          </lido:legalBodyName>
        </lido:recordSource>
        <lido:recordRights>
          <lido:rightsType>
            <lido:term>${copyrightStatus}</lido:term>
          </lido:rightsType>
        </lido:recordRights>
        <lido:recordInfoSet>
          <lido:recordMetadataDate>${obj.updated_at.slice(0, 10)}</lido:recordMetadataDate>
        </lido:recordInfoSet>
      </lido:recordWrap>
    </lido:administrativeMetadata>
  </lido:lido>`;
}

export function exportLido(objects: CollectionObject[], institutionName: string, filename?: string) {
  const records = objects.map(o => lidoRecord(o, institutionName)).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<lido:lidoWrap
  xmlns:lido="http://www.lido-schema.org"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.lido-schema.org http://www.lido-schema.org/schema/v1.0/lido-v1.0.xsd">
${records}
</lido:lidoWrap>`;
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
  triggerDownload(blob, filename ?? `cartlann-lido-${today()}.xml`);
}

// ── CSV import parsing ────────────────────────────────────────────────────────

export interface ParsedImportRow {
  title: string;
  accession_number?: string;
  object_name?: string;
  object_type?: string;
  maker?: string;
  date_from?: number;
  date_to?: number;
  date_precision?: string;
  materials?: string[];
  brief_description?: string;
  current_condition?: string;
  rights_holder?: string;
  copyright_status?: string;
  status?: string;
  is_public?: boolean;
}

export interface ImportPreview {
  rows: ParsedImportRow[];
  errors: string[];
  columnMap: Record<string, number>; // header name → column index
}

/**
 * Parse a CSV string. Returns a preview with parsed rows and any errors.
 * Accepts both Cartlann's own export format (by column name) and arbitrary
 * CSVs (user must confirm mapping).
 */
export function parseCsv(csvText: string): ImportPreview {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], errors: ["File has no data rows."], columnMap: {} };

  // Parse header
  const headers = splitCsvRow(lines[0]).map(h => h.trim().toLowerCase());
  const columnMap: Record<string, number> = {};
  headers.forEach((h, i) => { columnMap[h] = i; });

  const col = (row: string[], name: string): string | undefined => {
    const idx = columnMap[name];
    return idx !== undefined ? row[idx]?.trim() || undefined : undefined;
  };

  const rows: ParsedImportRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitCsvRow(lines[i]);
    const title = col(cells, "title");
    if (!title) {
      errors.push(`Row ${i + 1}: missing required field "title" — skipped`);
      continue;
    }
    const materialsStr = col(cells, "materials");
    const row: ParsedImportRow = {
      title,
      accession_number: col(cells, "accession_number"),
      object_name: col(cells, "object_name"),
      object_type: col(cells, "object_type"),
      maker: col(cells, "maker"),
      date_from: col(cells, "date_from") ? parseInt(col(cells, "date_from")!) : undefined,
      date_to: col(cells, "date_to") ? parseInt(col(cells, "date_to")!) : undefined,
      date_precision: col(cells, "date_precision"),
      materials: materialsStr ? materialsStr.split(/[;|,]/).map(m => m.trim()).filter(Boolean) : undefined,
      brief_description: col(cells, "brief_description") ?? col(cells, "description"),
      current_condition: col(cells, "current_condition"),
      rights_holder: col(cells, "rights_holder"),
      copyright_status: col(cells, "copyright_status"),
      status: col(cells, "status"),
      is_public: col(cells, "is_public") === "true",
    };
    rows.push(row);
  }

  return { rows, errors, columnMap };
}

function splitCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
