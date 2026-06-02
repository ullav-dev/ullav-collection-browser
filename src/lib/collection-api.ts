// Typed wrappers for the ullav-collection-server at http://localhost:8082.
// In the browser requests go via the Next.js /api/* rewrite to avoid CORS.

const BASE =
  typeof window === "undefined"
    ? (process.env.API_URL ?? "http://localhost:8082")
    : "/api";

async function apiRequest<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const contentType = res.headers.get("content-type") ?? "";
  if (res.status === 204 || !contentType.includes("application/json")) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return undefined as T;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? data.message ?? data.detail ?? `HTTP ${res.status}`);
  return data as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CollectionObject {
  id: string;
  title: string;
  accession_number: string | null;
  object_name: string | null;
  brief_description: string | null;
  object_type: string | null;
  maker: string | null;
  date_from: number | null;
  date_to: number | null;
  date_precision: string | null;
  materials: string[];
  dimensions: Record<string, unknown> | null;
  current_location_id: string | null;
  current_condition: string | null;
  rights_holder: string | null;
  copyright_status: string | null;
  status: string;
  is_accessioned: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConditionCheck {
  id: string;
  object_id: string;
  check_date: string;
  checked_by: string;
  condition_grade: string;
  notes: string | null;
  next_check_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConservationTreatment {
  id: string;
  object_id: string;
  treatment_type: string;
  start_date: string;
  end_date: string | null;
  conservator_id: string | null;
  description: string | null;
  cost: number | null;
  currency: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  object_id: string;
  loan_type: string;
  counterpart_id: string | null;
  purpose: string | null;
  start_date: string;
  expected_end_date: string | null;
  actual_end_date: string | null;
  status: string;
  venue: string | null;
  insurance_value: number | null;
  insurance_currency: string | null;
  courier_details: string | null;
  conditions_text: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectPart {
  id: string;
  object_id: string;
  part_number: string;
  description: string | null;
  current_location_id: string | null;
  created_at: string;
}

export interface ObjectMovement {
  id: string;
  object_id: string;
  from_location_id: string | null;
  to_location_id: string;
  moved_at: string;
  moved_by_user_id: string;
  reason: string | null;
  notes: string | null;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  location_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Party {
  id: string;
  name: string;
  party_type: string;
  email: string | null;
  phone: string | null;
  address: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  reason: string;
  depositor_id: string | null;
  brief_description: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Acquisition {
  id: string;
  object_id: string;
  entry_id: string | null;
  accession_number: string;
  acquisition_date: string;
  method: string;
  source_id: string | null;
  price: number | null;
  currency: string | null;
  authorisation_reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateObjectRequest {
  title: string;
  object_name?: string;
  brief_description?: string;
  object_type?: string;
  maker?: string;
  date_from?: number;
  date_to?: number;
  date_precision?: string;
  materials?: string[];
  dimensions?: Record<string, unknown>;
  current_condition?: string;
  rights_holder?: string;
  copyright_status?: string;
  is_public?: boolean;
}

export interface UpdateObjectRequest extends CreateObjectRequest {
  status: string;
}

export interface ObjectListQuery {
  search?: string;
  status?: string;
  is_accessioned?: boolean;
  limit?: number;
  offset?: number;
}

// ── Objects ───────────────────────────────────────────────────────────────────

export const listObjects = (token: string, query?: ObjectListQuery): Promise<CollectionObject[]> => {
  const params = new URLSearchParams();
  if (query?.search) params.set("search", query.search);
  if (query?.status) params.set("status", query.status);
  if (query?.is_accessioned !== undefined) params.set("is_accessioned", String(query.is_accessioned));
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  if (query?.offset !== undefined) params.set("offset", String(query.offset));
  const qs = params.toString();
  return apiRequest(`/objects${qs ? `?${qs}` : ""}`, token);
};

export const getObject = (token: string, id: string): Promise<CollectionObject> =>
  apiRequest(`/objects/${id}`, token);

export const createObject = (token: string, body: CreateObjectRequest): Promise<CollectionObject> =>
  apiRequest("/objects", token, { method: "POST", body: JSON.stringify(body) });

export const updateObject = (token: string, id: string, body: UpdateObjectRequest): Promise<CollectionObject> =>
  apiRequest(`/objects/${id}`, token, { method: "PUT", body: JSON.stringify(body) });

export const getObjectParts = (token: string, id: string): Promise<ObjectPart[]> =>
  apiRequest(`/objects/${id}/parts`, token);

export const getObjectMovements = (token: string, id: string): Promise<ObjectMovement[]> =>
  apiRequest(`/objects/${id}/movements`, token);

export const moveObject = (token: string, id: string, body: { to_location_id: string; reason?: string; notes?: string }): Promise<void> =>
  apiRequest(`/objects/${id}/move`, token, { method: "POST", body: JSON.stringify(body) });

// ── Public portal (no auth required) ─────────────────────────────────────────

export const listPublicObjects = (query?: { search?: string; limit?: number; offset?: number }): Promise<CollectionObject[]> => {
  const params = new URLSearchParams();
  if (query?.search) params.set("search", query.search);
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  if (query?.offset !== undefined) params.set("offset", String(query.offset));
  const qs = params.toString();
  return apiRequest(`/public/objects${qs ? `?${qs}` : ""}`, null);
};

export const getPublicObject = (id: string): Promise<CollectionObject> =>
  apiRequest(`/public/objects/${id}`, null);

// ── Locations ─────────────────────────────────────────────────────────────────

export const listLocations = (token: string): Promise<Location[]> =>
  apiRequest("/locations", token);

export const getLocation = (token: string, id: string): Promise<Location> =>
  apiRequest(`/locations/${id}`, token);

export const createLocation = (token: string, body: Partial<Location>): Promise<Location> =>
  apiRequest("/locations", token, { method: "POST", body: JSON.stringify(body) });

export const updateLocation = (token: string, id: string, body: Partial<Location>): Promise<Location> =>
  apiRequest(`/locations/${id}`, token, { method: "PUT", body: JSON.stringify(body) });

// ── Parties ───────────────────────────────────────────────────────────────────

export const listParties = (token: string, search?: string): Promise<Party[]> => {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiRequest(`/parties${qs}`, token);
};

export const getParty = (token: string, id: string): Promise<Party> =>
  apiRequest(`/parties/${id}`, token);

export const createParty = (token: string, body: Partial<Party>): Promise<Party> =>
  apiRequest("/parties", token, { method: "POST", body: JSON.stringify(body) });

export const updateParty = (token: string, id: string, body: Partial<Party>): Promise<Party> =>
  apiRequest(`/parties/${id}`, token, { method: "PUT", body: JSON.stringify(body) });

// ── Entries ───────────────────────────────────────────────────────────────────

export const listEntries = (token: string): Promise<ObjectEntry[]> =>
  apiRequest("/entries", token);

export const getEntry = (token: string, id: string): Promise<ObjectEntry> =>
  apiRequest(`/entries/${id}`, token);

export const createEntry = (token: string, body: Partial<ObjectEntry>): Promise<ObjectEntry> =>
  apiRequest("/entries", token, { method: "POST", body: JSON.stringify(body) });

export const updateEntry = (token: string, id: string, body: Partial<ObjectEntry>): Promise<ObjectEntry> =>
  apiRequest(`/entries/${id}`, token, { method: "PUT", body: JSON.stringify(body) });

// ── Acquisitions ──────────────────────────────────────────────────────────────

export const listAcquisitions = (token: string): Promise<Acquisition[]> =>
  apiRequest("/acquisitions", token);

export const getAcquisition = (token: string, id: string): Promise<Acquisition> =>
  apiRequest(`/acquisitions/${id}`, token);

export const createAcquisition = (token: string, body: Partial<Acquisition>): Promise<Acquisition> =>
  apiRequest("/acquisitions", token, { method: "POST", body: JSON.stringify(body) });

// ── Condition checks ──────────────────────────────────────────────────────────

export const listConditionChecks = (token: string, objectId: string): Promise<ConditionCheck[]> =>
  apiRequest(`/objects/${objectId}/condition-checks`, token);

export const getLatestConditionCheck = (token: string, objectId: string): Promise<ConditionCheck | null> =>
  apiRequest(`/objects/${objectId}/condition-checks/latest`, token);

export const createConditionCheck = (
  token: string,
  objectId: string,
  body: { check_date: string; condition_grade: string; notes?: string; next_check_date?: string }
): Promise<ConditionCheck> =>
  apiRequest(`/objects/${objectId}/condition-checks`, token, { method: "POST", body: JSON.stringify(body) });

// ── Conservation treatments ───────────────────────────────────────────────────

export const listTreatments = (token: string, objectId: string): Promise<ConservationTreatment[]> =>
  apiRequest(`/objects/${objectId}/treatments`, token);

export const createTreatment = (
  token: string,
  objectId: string,
  body: Partial<ConservationTreatment>
): Promise<ConservationTreatment> =>
  apiRequest(`/objects/${objectId}/treatments`, token, { method: "POST", body: JSON.stringify(body) });

export const updateTreatment = (token: string, id: string, body: Partial<ConservationTreatment>): Promise<ConservationTreatment> =>
  apiRequest(`/treatments/${id}`, token, { method: "PUT", body: JSON.stringify(body) });

// ── Loans ─────────────────────────────────────────────────────────────────────

export const listLoans = (token: string, query?: { loan_type?: string; status?: string }): Promise<Loan[]> => {
  const params = new URLSearchParams();
  if (query?.loan_type) params.set("loan_type", query.loan_type);
  if (query?.status) params.set("status", query.status);
  const qs = params.toString();
  return apiRequest(`/loans${qs ? `?${qs}` : ""}`, token);
};

export const getLoan = (token: string, id: string): Promise<Loan> =>
  apiRequest(`/loans/${id}`, token);

export const listObjectLoans = (token: string, objectId: string): Promise<Loan[]> =>
  apiRequest(`/objects/${objectId}/loans`, token);

export const createObjectLoan = (token: string, objectId: string, body: Partial<Loan>): Promise<Loan> =>
  apiRequest(`/objects/${objectId}/loans`, token, { method: "POST", body: JSON.stringify(body) });

export const updateLoan = (token: string, id: string, body: Partial<Loan>): Promise<Loan> =>
  apiRequest(`/loans/${id}`, token, { method: "PUT", body: JSON.stringify(body) });

// ── Number schemes ────────────────────────────────────────────────────────────

export interface NumberScheme {
  id: string;
  name: string;
  institution_code: string | null;
  format_template: string;
  prefix: string | null;
  seq_padding: number;
  last_sequence: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface NumberSchemePreview {
  next_number: string;
  next_sequence: number;
}

export const listNumberSchemes = (token: string): Promise<NumberScheme[]> =>
  apiRequest("/settings/number-schemes", token);

export const getNumberScheme = (token: string, id: string): Promise<NumberScheme> =>
  apiRequest(`/settings/number-schemes/${id}`, token);

export const createNumberScheme = (token: string, body: Partial<NumberScheme>): Promise<NumberScheme> =>
  apiRequest("/settings/number-schemes", token, { method: "POST", body: JSON.stringify(body) });

export const updateNumberScheme = (token: string, id: string, body: Partial<NumberScheme>): Promise<NumberScheme> =>
  apiRequest(`/settings/number-schemes/${id}`, token, { method: "PUT", body: JSON.stringify(body) });

export const previewNumberScheme = (token: string, id: string): Promise<NumberSchemePreview> =>
  apiRequest(`/settings/number-schemes/${id}/preview`, token);

export const assignAccession = (token: string, objectId: string, schemeId?: string): Promise<{ accession_number: string }> =>
  apiRequest(`/objects/${objectId}/assign-accession`, token, {
    method: "POST",
    body: JSON.stringify({ scheme_id: schemeId ?? null }),
  });
