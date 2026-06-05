# Data Exchange Formats in Collection Management

Research into standard import/export formats used across the museum, gallery, and archaeology (GLAM) sector, and their relevance to Cartlann.

---

## Summary verdict

| Format | Status | Cartlann priority |
|---|---|---|
| **LIDO XML** | De facto harvesting standard | High — marketplace expects it |
| **CSV (Spectrum-aligned)** | Universal migration format | High — immediate user need |
| **JSON** | REST API / developer integrations | High — near-term |
| **OAI-PMH endpoint** | Harvesting protocol wrapping LIDO | Medium |
| **EODEM** | LIDO profile for loans | Medium (Phase 2 loans data) |
| **Europeana EDM** | Required for Europeana contribution | Medium (European context) |
| **Linked Art (JSON-LD)** | CIDOC-CRM as JSON, growing adoption | Low–Medium (emerging) |
| **CIDOC-CRM directly** | Conceptual framework; nobody implements natively | Low |
| **Dublin Core** | Too thin alone; baseline for OAI-PMH | Baseline only |
| **EAD** | Archives/manuscripts only | Not applicable |
| **Spectrum-XML DTD** | Historically documented; superseded by LIDO | Avoid |

---

## 1. LIDO XML — Priority target

**LIDO (Lightweight Information Describing Objects)** is an XML schema designed as a CIDOC-CRM application profile specifically for harvesting museum collection metadata to resource discovery portals.

### Who uses it
- **Aggregators**: Europeana, German Digital Library, Culture Grid (UK Museum Data Service)
- **Systems**: TMS Collections (Gallery Systems), MuseumPlus/Axiell, CollectiveAccess (via LIBIS profile)
- **Latest**: LIDO Primer published September 2024 — actively maintained by CIDOC LIDO Working Group

### Spectrum mapping
Collections Trust published an official **Mapping of LIDO to Spectrum 5.0** document. Our data model maps cleanly:

| Spectrum field | LIDO element |
|---|---|
| Object title | `lido:titleSet/appellationValue` |
| Object name/type | `lido:objectWorkType/term` |
| Accession number | `lido:repositorySet/workID[@type="accession number"]` |
| Maker | `lido:eventActor` (in Production event) |
| Date | `lido:eventDate/displayDate` |
| Materials | `lido:eventMaterialsTech/displayMaterialsTech` |
| Description | `lido:objectDescriptionSet/descriptiveNoteValue` |
| Rights holder | `lido:rightsWorkSet/rightsHolder` |
| Record ID | `lido:recordID[@type="local"]` |

### Harvesting workflow
```
Cartlann → LIDO XML export → OAI-PMH endpoint → Europeana / Culture Grid / aggregators
```

### EODEM (loans)
EODEM (Exhibition Object Data Exchange Model) is a LIDO profile specifically for **loan object data exchange** — standardising exactly what we built in Phase 2 (loans in/out with insurance, courier, condition). MuseumPlus already supports it. Reference it when designing the loans export.

---

## 2. CSV — Universal migration format

No standard column layout exists. Every system requires its own field mapping. However:

- **Museum-Digital** publishes a community CSV standard with validated column headings: https://csvxml.imports.museum-digital.org/
- **PastPerfect** accepts CSV with field names matching its internal schema; requires minimum: Object ID, Object Name
- **CollectiveAccess** uses configurable import mapping spreadsheets (column → destination field)
- **Culture Grid / Museum Data Service** accepts any format but maps internally to Spectrum — confirming Spectrum-aligned column names as the right target

### Cartlann CSV column spec (Spectrum-aligned)

```
id, accession_number, title, object_name, object_type, maker,
date_from, date_to, date_precision, materials (semicolon-separated),
brief_description, current_condition,
rights_holder, copyright_status,
status, is_accessioned, is_public,
created_at, updated_at
```

Import minimum required fields: `title` (all others optional).

---

## 3. JSON — Developer/API integrations

No museum-specific standard; use the native object structure from the collection API. Useful for:
- Developer integrations
- Data migrations between Cartlann instances
- Feeding downstream applications (portals, websites)

The Linked Art profile (JSON-LD with CIDOC-CRM context) is the longer-term direction for semantic interoperability, but plain JSON is the immediate practical need.

---

## 4. OAI-PMH — Harvestable endpoint

The **Open Archives Initiative Protocol for Metadata Harvesting** is the standard transport layer for LIDO. Aggregators harvest via OAI-PMH, receiving LIDO records in response to standard verbs (`ListRecords`, `GetRecord`, `Identify`, etc.).

Implementing OAI-PMH requires:
1. A `/oai` endpoint on the collection server
2. A resumption token mechanism for large collections
3. Selective harvesting by `datestamp` and `set`

This is a backend feature (Rust handler) and should be built when LIDO export is in place.

---

## 5. Getty Vocabularies — Authority layer

Not a transfer format but an authority reference layer. For controlled vocabulary on object fields:
- **AAT** (Art & Architecture Thesaurus) — materials, techniques, object types (~350k terms)
- **TGN** (Getty Thesaurus of Geographic Names) — provenance locations
- **ULAN** (Union List of Artist Names) — makers and organisations

All available as Linked Open Data (RDF, JSON-LD). Integration path: lookup API on `materials`, `object_type`, and `maker` fields; store Getty URI alongside free-text value.

---

## 6. What to ignore

**CIDOC-CRM direct** — Conceptual framework, not an interchange format. LIDO and EDM are the practical profiles built on it. Adoption in production systems remains slow; use a profile instead.

**Spectrum-XML DTD (2001)** — Historically documented but superseded by LIDO for harvesting. Not worth implementing.

**Dublin Core alone** — 15-element set is too thin for object description. Use only as the minimum baseline metadata format in OAI-PMH feeds (required by the protocol).

**EAD** — Encoded Archival Description is for document archives/finding aids. Not applicable to object collections.

---

## Recommended Cartlann roadmap

### Near-term (now)
- JSON bulk export (all objects, filtered subset)
- CSV export with Spectrum-aligned columns
- CSV import with column mapping UI

### Medium-term
- LIDO XML export (per-object and bulk)
- OAI-PMH endpoint wrapping LIDO export
- EODEM profile for loan data exchange

### Long-term
- Getty AAT/ULAN/TGN authority lookups on object fields
- Linked Art (JSON-LD) API endpoint
- Europeana EDM contribution pipeline

---

## References

- [LIDO Overview — ICOM Documentation](https://icom-documentation.mini.icom.museum/working-groups/lido/lido-overview/about-lido/what-is-lido/)
- [LIDO Primer 2024](https://lido-schema.org/documents/primer/latest/lido-primer.html)
- [Mapping of LIDO to Spectrum 5.0 — Collections Trust](https://collectionstrust.org.uk/resource/mapping-of-lido-to-spectrum-5-0/)
- [EODEM — Exhibition Object Data Exchange Model](https://blog.museum-digital.org/2023/02/15/eodem-efficiently-exchange-object-information-during-loans/)
- [Europeana Data Model v5.2.8](https://pro.europeana.eu/files/Europeana_Professional/Share_your_data/Technical_requirements/EDM_Documentation/EDM_Definition_v5.2.8_102017.pdf)
- [Museum-Digital CSVXML standard](https://csvxml.imports.museum-digital.org/)
- [CIDOC-CRM](https://cidoc-crm.org/)
- [Linked Art](https://linked.art/)
- [Getty Vocabularies](https://www.getty.edu/research/tools/vocabularies/)
- [Culture Grid / Museum Data Service](https://museumdata.uk/)
- [OAI-PMH](https://www.openarchives.org/pmh/)
