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

function lidoRecord(obj: CollectionObject, institutionName: string): string {
  const id = escapeXml(obj.id);
  const title = escapeXml(obj.title);
  const objectName = obj.object_name ? escapeXml(obj.object_name) : "";
  const objectType = obj.object_type ? escapeXml(obj.object_type) : "";
  const maker = obj.maker ? escapeXml(obj.maker) : "";
  const date = escapeXml(dateLabel(obj));
  const materials = escapeXml(obj.materials.join("; "));
  const description = obj.brief_description ? escapeXml(obj.brief_description) : "";
  const accession = obj.accession_number ? escapeXml(obj.accession_number) : "";
  const rightsHolder = obj.rights_holder ? escapeXml(obj.rights_holder) : "";
  const institution = escapeXml(institutionName);
  const condition = obj.current_condition ? escapeXml(obj.current_condition) : "";

  return `  <lido:lido>
    <lido:lidoRecID lido:type="local">${id}</lido:lidoRecID>
    <lido:descriptiveMetadata xml:lang="en">
      <lido:objectClassificationWrap>
        <lido:objectWorkTypeWrap>
          <lido:objectWorkType>
            <lido:term>${objectName || objectType || "Object"}</lido:term>
          </lido:objectWorkType>
        </lido:objectWorkTypeWrap>
        ${objectType ? `<lido:classificationWrap>
          <lido:classification>
            <lido:term>${objectType}</lido:term>
          </lido:classification>
        </lido:classificationWrap>` : ""}
      </lido:objectClassificationWrap>
      <lido:objectIdentificationWrap>
        <lido:titleWrap>
          <lido:titleSet>
            <lido:appellationValue xml:lang="en">${title}</lido:appellationValue>
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
        ${condition ? `<lido:objectMeasurementsWrap>
          <lido:objectMeasurementsSet>
            <lido:displayObjectMeasurements>Condition: ${condition}</lido:displayObjectMeasurements>
          </lido:objectMeasurementsSet>
        </lido:objectMeasurementsWrap>` : ""}
      </lido:objectIdentificationWrap>
      ${(maker || date || materials) ? `<lido:eventWrap>
        <lido:eventSet>
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
            ${date ? `<lido:eventDate>
              <lido:displayDate>${date}</lido:displayDate>
            </lido:eventDate>` : ""}
            ${materials ? `<lido:eventMaterialsTech>
              <lido:displayMaterialsTech>${materials}</lido:displayMaterialsTech>
            </lido:eventMaterialsTech>` : ""}
          </lido:event>
        </lido:eventSet>
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
            <lido:term>${obj.copyright_status ? escapeXml(obj.copyright_status) : "Unknown"}</lido:term>
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
