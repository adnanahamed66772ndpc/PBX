# @pbx/web

Next.js 14 (App Router, React 18, TypeScript) frontend for the multi-tenant
PBX/UC platform. It consumes the shared workspace packages `@pbx/common` and
`@pbx/db` and talks to the REST API at `NEXT_PUBLIC_API_URL`.

## Getting started

```bash
# from monorepo root — build the shared packages first (their package.json
# `exports` resolve to dist/*), then start the web dev server:
pnpm --filter @pbx/common build
pnpm --filter @pbx/db build
pnpm dev:web            # next dev -p 3000  →  http://localhost:3000
```

Other scripts (run from `apps/web`):

| script       | purpose                       |
| ------------ | ----------------------------- |
| `dev`        | `next dev -p 3000`            |
| `build`      | `next build`                  |
| `start`      | `next start -p 3000`          |
| `lint`       | `next lint`                   |
| `typecheck`  | `tsc --noEmit`                |

### Environment

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

`NEXT_PUBLIC_API_URL` is read by `src/lib/api.ts`; it defaults to
`http://localhost:4000` when unset.

## Architecture

```
src/
├── app/                      # App Router pages
│   ├── layout.tsx            # root layout: Sidebar + Topbar + theme bootstrap
│   ├── page.tsx              # redirects to /dashboard
│   ├── login/                # email/password login → POST /auth/login
│   ├── dashboard/            # metric cards + recent calls  → GET /dashboard/summary
│   ├── dialer/               # softphone keypad + call controls (WebRTC TODO)
│   ├── contacts/             # directory table + add modal   → GET/POST /contacts
│   ├── call-history/         # CDR table + direction/status  → GET /calls
│   └── voicemail/            # list + play/unread            → GET /voicemail
├── components/
│   ├── ui/                   # Button, Input, Table, Badge, Card, Modal (+ index barrel)
│   └── layout/               # Sidebar, Topbar, ThemeToggle
├── lib/
│   ├── api.ts                # typed fetch wrapper + Bearer token + ApiError
│   └── types.ts              # re-exports domain types from @pbx/db / @pbx/common + UI types
└── styles/globals.css        # design tokens (see below)
```

## Design tokens

All colors are expressed as CSS custom properties in
`src/styles/globals.css`; Tailwind's `tailwind.config.ts` extends the theme
to read those variables, and **components reference semantic tokens, never
hard-coded hex**, so dark mode swaps every surface at once via the `.dark`
class on `<html>`.

### Raw brand palette (Atlassian-inspired)

| token                  | value     | meaning                    |
| ---------------------- | --------- | -------------------------- |
| `--color-brand`        | `#0052CC` | primary actions            |
| `--color-accent`       | `#36B37E` | success                    |
| `--color-danger`       | `#DE350B` | destructive                |
| `--color-warning`      | `#FF8B00` | caution                    |
| `--color-neutral-bg`   | `#F4F5F7` | page background            |
| `--color-text-primary` | `#172B4D` | headings/body              |
| `--color-border`       | `#DFE1E6` | default border             |
| `--color-text-muted`   | `#6B778C` | secondary text             |

Plus `--color-brand-700`, `--color-accent-700`, `--color-danger-700`,
`--color-border-subtle`, `--color-surface`, `--color-surface-subtle`,
`--color-surface-hover`, `--color-text-inverted`.

### Semantic token aliases (swap in `.dark`)

`--token-bg`, `--token-bg-subtle`, `--token-surface`,
`--token-surface-subtle`, `--token-surface-hover`, `--token-border`,
`--token-border-subtle`, `--token-text-primary`, `--token-text-muted`,
`--token-text-inverted`, `--token-primary`, `--token-primary-hover`,
`--token-success`, `--token-success-hover`, `--token-danger`,
`--token-danger-hover`, `--token-warning`.

### Spacing / radius / type

- Spacing scale (4px base): `--space-1` … `--space-8`.
- Radius: `--radius-sm` (2px), `--radius-md` (6px), `--radius-lg` (8px).
- Font: `--font-family-base: 'Inter', ui-sans-serif, system-ui, …`.

### Dark mode

Toggled by the `.dark` class on `<html>`. `ThemeToggle` flips it and persists
the choice to `localStorage('pbx.theme')`; `layout.tsx` injects an inline
script in `<head>` that applies the stored theme **before paint** to avoid a
flash. Tailwind `darkMode: 'class'`.

## Component library

| component   | path                        | notes                                                            |
| ----------- | --------------------------- | ---------------------------------------------------------------- |
| `Button`    | `components/ui/Button.tsx`  | variants primary/secondary/danger/ghost, sizes sm/md, loading, forwardRef, aria-busy |
| `Input`     | `components/ui/Input.tsx`   | labeled, error text, hint, left icon, forwardRef, aria-invalid   |
| `Table`     | `components/ui/Table.tsx`   | generic `<T>`, `columns` (key/header/render), `data`, zebra, hover, empty state |
| `Badge`     | `components/ui/Badge.tsx`   | success/warning/danger/neutral/info, optional status dot         |
| `Card`      | `components/ui/Card.tsx`    | metric card (title, value, icon, delta)                          |
| `Modal`     | `components/ui/Modal.tsx`   | backdrop, ESC to close, focus trap, body scroll lock, forwardRef initial focus |
| `Sidebar`   | `components/layout/Sidebar.tsx` | collapsible nav, active-link highlight, presence avatar, mobile hamburger |
| `Topbar`    | `components/layout/Topbar.tsx`  | tenant name, search, theme toggle, user menu (ESC/outside-click) |
| `ThemeToggle` | `components/layout/ThemeToggle.tsx` | light/dark toggle persisted to localStorage              |

All interactive elements carry `aria-label`s, a visible keyboard focus ring
(`focus-visible:ring-2`), and meet WCAG AA contrast (≥ 4.5:1) on the brand
palette. Tables use a neutral header row, optional zebra striping, and hover
highlight.

## Page → API endpoint map

| page            | route            | method | endpoint                | purpose                          |
| --------------- | ---------------- | ------ | ----------------------- | -------------------------------- |
| Login           | `/login`         | POST   | `/auth/login`           | email/password → token + user    |
| Dashboard       | `/dashboard`     | GET    | `/dashboard/summary`    | metrics + recent calls           |
| Dialer          | `/dialer`        | —      | (WebRTC/JSSIP TODO)     | softphone keypad + presence      |
| Contacts        | `/contacts`      | GET    | `/contacts`             | directory list                   |
| Contacts (add)  | `/contacts`      | POST   | `/contacts`             | create contact                   |
| Call History    | `/call-history`  | GET    | `/calls`                | CDR list (filter direction/status) |
| Voicemail       | `/voicemail`     | GET    | `/voicemail`            | voicemail list + play/unread     |

All requests are issued through `src/lib/api.ts`, which prepends
`NEXT_PUBLIC_API_URL`, attaches `Authorization: Bearer <token>` from
`localStorage('pbx.token')`, and throws an `ApiError` carrying the parsed
JSON error body on non-2xx responses.

## Softphone / WebRTC

`src/app/dialer/page.tsx` implements the full keypad, call-state machine
(idle → ringing → connected → held), mute/hold/hangup controls, and a
presence selector. A `TODO` marks where the WebRTC/JSSIP user agent should
register against the PBX SIP registrar and wire `onTrack`/session description
to an `<audio>` element; no SIP library is bundled in this starter.

## Notes

- `next.config.js` sets `transpilePackages: ['@pbx/common', '@pbx/db']` and
  `reactStrictMode: true`.
- Domain types (`User`, `Extension`, `CallRecord`, `Presence`, `Role`,
  `Tenant`, …) are re-exported from `@pbx/db` in `src/lib/types.ts` via
  **type-only** imports, so the Node-only `pg` client is never bundled into
  the browser.
