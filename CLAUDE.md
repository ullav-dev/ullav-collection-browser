# CLAUDE.md — ullav-collection-browser

## Overview

Next.js 16 frontend for the Ullav collection management system (Spectrum 5-aligned). Named **Taisce** (Irish: treasury/archive). Serves both institutional users (museums, galleries, archaeology) and hobby collectors.

## Tech Stack

- **Next.js 16** (App Router, `[locale]/` prefix, standalone output)
- **React 19**, **TypeScript 5**
- **Tailwind CSS 4** (PostCSS plugin, no config file — all via `@import "tailwindcss"` in globals.css)
- **next-intl** (locales: `en`, `de`, `ga`)
- **Geist** font

## Brand

- Primary: `#0D9488` (teal-600)
- Accent: `#D97706` (amber-600)
- Background: `#F0FDFA` (teal-50)
- Neutral: `#64748B` (slate-500)

Use `text-teal-600`, `bg-teal-600`, `hover:bg-teal-700`, `focus:ring-teal-500` for interactive elements. Never use blue as primary.

## Backend Connections

| Service | Local port | Proxy path |
|---|---|---|
| `ullav-collection-server` | 8084 | `/api/*` |
| `ullav-user-management` | 8081 | `/auth-api/*` |

API rewrites configured in `src/proxy.ts` (Next.js 16's replacement for `middleware.ts`).

## Key Files

- `src/proxy.ts` — API proxy + i18n middleware (Next.js 16 convention: `proxy.ts` not `middleware.ts`)
- `src/i18n/routing.ts` — locale config
- `src/i18n/request.ts` — next-intl server config
- `src/lib/auth-api.ts` — auth service wrapper
- `src/lib/collection-api.ts` — collection server wrapper (all typed endpoints)
- `src/contexts/AuthContext.tsx` — auth state + idle timeout
- `src/components/Nav.tsx` — header with teal branding + Taisce logo SVG

## Commands

```bash
npm run dev    # start dev server (port 3000)
npm run build  # production build (TypeScript + lint)
npm run lint   # ESLint
```

## Architecture Notes

- All authenticated pages redirect to `/login` when `user` is null (via `useEffect` + `router.replace`)
- `AuthContext` stores session in `localStorage` under key `taisce_auth`
- Public portal at `/[locale]/browse` — uses `/api/public/objects` (no auth)
- Locale layout (`src/app/[locale]/layout.tsx`) wraps everything in `AuthProvider` + `NextIntlClientProvider`
- `src/app/layout.tsx` is minimal (no font/style) — locale layout handles all styling

## Planned Features

- Phase 2: Condition checking, conservation treatments, loans (requires backend extensions)
- Phase 3: Flexible accession numbering, public portal (requires `is_public` on objects in server)
- Phase 4: Label printing — browser-side PDF (bwip-js + jsPDF) for hobbyists; AWE thermal queue for institutions
- Phase 5: DAM asset linking
- Phase 6: Hobby mode — valuations, templates, quick-add barcode scanner
