# Cartlann — Collection Management

**Cartlann** (Irish: *archive, record repository*) is the collection management frontend for the [Ullav](https://ullav.com) suite. It provides a Spectrum 5-aligned interface for museums, galleries, archaeology teams, and private collectors.

## Features

- **Collection cataloguing** — Full Spectrum 5 object records: title, maker, fuzzy date ranges, materials, dimensions, rights
- **Object entries & acquisitions** — Pre-acquisition entry log through to formal accession with automatic number generation
- **Flexible accession numbering** — Configurable schemes with templates (`{CODE}.{YEAR}.{SEQ}` etc.) and atomic sequence assignment
- **Location & movement tracking** — Hierarchical location tree; full movement audit trail
- **Condition checking** — Graded condition assessments with scheduling for next check
- **Conservation treatments** — Treatment log with dates, conservator, cost, outcome
- **Loans management** — Loans in and out with status tracking, insurance values, and courier details
- **Label printing** — Browser-side QR code and barcode (Code 128) label generation; downloads A4 PDF sheets (small/medium/large sizes)
- **Public portal** — Unauthenticated browse view for publicly designated objects
- **SSO** — Single sign-on via ullav-portal; session handoff via `?t=` token
- **RBAC** — Roles (`collection_admin`, `curator`, `registrar`) issued by ullav-user-management
- **i18n** — English, German, Irish (Gaeilge)

## Stack

| | |
|---|---|
| Framework | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 |
| i18n | next-intl (en / de / ga) |
| Auth | JWT via ullav-user-management |
| Label generation | bwip-js + jsPDF (browser-side) |

## Services required

| Service | Default port | Role |
|---|---|---|
| `ullav-collection-server` | 8084 | Collection API |
| `ullav-user-management` | 8081 | Auth, SSO, RBAC |

## Local development

```bash
# 1. Copy and configure environment
cp .env.local.example .env.local   # or create manually — see below

# 2. Install dependencies
npm install

# 3. Start dev server (port 3007)
npm run dev
```

Open **http://localhost:3007**.

### Environment variables (`.env.local`)

```env
API_URL=http://localhost:8084       # collection server (server-side only)
AUTH_URL=http://localhost:8081      # user-management (server-side only)
PORTAL_URL=https://portal.ullav.com http://localhost:3003  # CSP frame-ancestors
```

In the browser, API calls are proxied through the Next.js middleware:
- `/api/*` → `ullav-collection-server`
- `/auth-api/*` → `ullav-user-management`
- `/auth/login` → collection server login proxy → user-management

### Database migrations (collection server)

Migrations live in `ullav-collection-server/migrations/`. Apply them manually:

```bash
cd ../ullav-collection-server
psql $DATABASE_URL -f migrations/001_core.sql
psql $DATABASE_URL -f migrations/002_phase2.sql
psql $DATABASE_URL -f migrations/003_number_schemes.sql
```

### RBAC setup (user-management)

Collection roles are seeded by `migrations/004_collection_permissions.sql` in `ullav-user-management`. The roles and permissions are already present if that migration has been applied.

To assign a role to a user:
```sql
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'user@example.com' AND r.name = 'collection_admin';
```

Available roles:

| Role | Permissions |
|---|---|
| `collection_admin` | Full access — all objects, locations, entries, acquisitions |
| `curator` | Objects + acquisitions (rw), locations + entries (r) |
| `registrar` | Entries + locations (rw), objects (r) |

## SSO / portal integration

To launch Cartlann from ullav-portal, set the app's SSO URL to:
```
http://localhost:3007/en/auth/sso
```
The portal encodes `{ token, user, roles }` into the `?t=` query parameter. The SSO page decodes it, calls `setSession()`, and redirects to the dashboard.

## Production build

```bash
npm run build   # outputs to .next/standalone
```

Deploy via Docker Compose. The app writes no secrets to disk — JWT is stored in `localStorage` under the key `cartlann_auth`.

## Project structure

```
src/
  app/[locale]/         # App Router pages (en/de/ga prefix)
    objects/            # Collection browser, detail, new, edit
    locations/          # Location tree
    entries/            # Object entries
    acquisitions/       # Acquisitions
    parties/            # People & organisations
    settings/           # Accession number schemes
    browse/             # Public portal (no auth)
    login/              # Sign-in page
    auth/sso/           # Portal SSO handoff
    auth/confirm-email/ # Email confirmation
    auth/password-reset/
  components/
    Nav.tsx             # Header (teal brand, user avatar + full name)
    LabelPrintModal.tsx # QR/barcode label PDF generator
  contexts/
    AuthContext.tsx     # JWT session, idle timeout, RBAC permissions
  lib/
    collection-api.ts   # Typed wrappers for all collection server endpoints
    auth-api.ts         # Typed wrappers for user-management
    label-generator.ts  # PDF label generation (bwip-js + jsPDF)
  proxy.ts              # Next.js 16 middleware: API proxy + i18n routing
```
