# Pulse Plumbing & Gas — Claude Code Project Context

## Business
- **Company:** Pulse Plumbing & Gas
- **Domain:** pulseqld.com.au
- **Mobile (24/7):** 0452 188 420
- **Office Phone:** 07 2150 4175
- **Email:** admin@pulseqld.com.au
- **ABN:** [INSERT ABN]
- **QLD Licence:** [INSERT QBCC LICENCE NUMBER]
- **Specialisation:** Maintenance plumbing — residential and commercial
- **Service areas:** 130+ suburbs within 30km of Loganholme, SE Queensland
- **Primary LGAs:** Logan City, Brisbane (south), Redland City, Gold Coast (north), Ipswich
- **Available:** 24/7 including afterhours and weekends

---

## Tech Stack
- **Framework:** Astro 6 (static output + SSR for form API routes)
- **Styling:** Tailwind CSS 4 via `@tailwindcss/postcss` (PostCSS — NOT the Vite plugin)
- **JS:** React islands for interactive components only (`client:load` / `client:idle`)
- **Deployment:** Cloudflare Pages (adapter: `@astrojs/cloudflare`)
- **CMS:** Markdown files in `/src/content/` (no external CMS)
- **Images:** Astro `<Image>` component with Cloudflare image service

> **Important:** This project is nested inside `tradewise-client-portal/` which has its own
> Tailwind v3 in its `node_modules`. Tailwind is configured via `postcss.config.mjs`
> (using `@tailwindcss/postcss`) to pin to the local v4 install. NEVER add
> `@tailwindcss/vite` back to `astro.config.mjs` — it causes double-processing.

---

## Architecture Rules (NEVER change these)
- ALL pages use layouts from `/src/layouts/`
- ALL schema markup lives in `/src/components/seo/Schema.astro`
- Industry pages use `/src/layouts/IndustryLayout.astro`
- Location pages use `/src/layouts/LocationLayout.astro`
- Service pages use `/src/layouts/ServiceLayout.astro`
- Blog posts use `/src/layouts/BlogLayout.astro`
- NEVER inline styles — Tailwind classes only
- ALWAYS include LocalBusiness + Service schema on every page (injected via `Schema.astro`)
- ALWAYS include FAQ schema on industry and service pages (min 5 questions)
- Forms POST to `/api/contact.ts` (SSR edge function) and sync to HubSpot

---

## File Structure
```
src/
├── components/
│   ├── seo/
│   │   └── Schema.astro          ← ALL structured data lives here
│   ├── Header.astro
│   └── Footer.astro
├── data/
│   └── locations.ts              ← All 130+ service suburbs (edit here to add/remove)
├── layouts/
│   ├── MainLayout.astro          ← Base layout (GTM, HubSpot, meta, schema)
│   ├── ServiceLayout.astro       ← Service pages + Service + FAQ schema
│   ├── IndustryLayout.astro      ← Industry pages + FAQ schema
│   ├── LocationLayout.astro      ← Suburb pages + LocalBusiness + Plumber schema
│   └── BlogLayout.astro          ← Blog posts + Article schema
├── lib/
│   └── aroflo.ts                 ← AroFlo REST API client (HMAC-SHA256 auth)
├── pages/
│   ├── api/
│   │   └── contact.ts            ← SSR: validates form → HubSpot
│   ├── plumber-[suburb].astro    ← Dynamic: generates 1 page per suburb in locations.ts
│   ├── service-areas.astro       ← Hub page listing all 130+ suburbs
│   └── index.astro
└── styles/
    └── global.css                ← Tailwind import + @theme brand tokens
```

---

## Design System (updated for Pulse Plumbing, Gas & Civil logo)

### Colours
| Token | Hex | Use |
|---|---|---|
| `#0172ae` | Deep Electric Blue | Primary — buttons, links, accents, borders |
| `#015d8e` | Blue hover | Button hover states |
| `#10a2d5` | Cyan Accent | Links, dividers, icon tints |
| `#19619d` | Heartbeat Blue | Secondary accents, underlines |
| `#000000` | Black | Primary dark background — headings, dark sections, footer bg |
| `#f19329` | Orange | Emergency CTAs |
| `#bcc0c4` | Silver Highlight | Metallic accents |
| `#1a1a1a` | Near-black | Body text on light backgrounds |
| `#F0F5FA` | Light Blue-Grey | Page backgrounds, cards, hero sections |
| `#D1D5DB` | Light Grey | Borders, dividers |
| `#FFFFFF` | White | Header bg, card bg |

### Typography
- **Font:** `Montserrat` (Google Fonts, weights 400/500/600/700/800)
- **Fallback:** `system-ui, sans-serif`
- **Body weight:** 400
- **Heading weight:** 600–700

### Contact
- **Mobile (24/7):** 0452 188 420
- **Office Phone:** 07 2150 4175

### Component patterns
- **Primary button:** `bg-[#0172ae] hover:bg-[#015d8e] text-white font-semibold px-5 py-2.5 rounded`
- **Emergency CTA:** `bg-[#f19329] hover:bg-[#d97d1a] text-white font-bold` — label: "Call Now — Emergency Response"
- **Cards:** `bg-white border border-[#D1D5DB] rounded-lg hover:border-[#0172ae]`
- **Hero bg:** `bg-[#F0F5FA]`
- **Section alt bg:** `bg-[#F0F5FA]`
- **Dark section:** `bg-[#000000] text-white`
- **Border radius:** `rounded` (4px) for buttons, `rounded-lg` for cards, `rounded-xl` for large panels
- **Box shadow:** `shadow-sm` standard, `shadow-lg` for dropdowns

### Logo paths
- **Light backgrounds:** `/images/logo-light.jpeg`
- **Dark backgrounds:** `/images/logo-dark.jpeg`

---

## SEO Rules
- **Title format:** `[Service/Suburb] | Pulse Plumbing & Gas`  
  Examples: `Plumber Beenleigh 4207 | Pulse Plumbing & Gas`
- Every page needs: `title`, `description`, `canonical`, `og:image`, `schema`
- **Location keywords:** Brisbane, Logan, Gold Coast, Ipswich, QLD, South-East Queensland
- **Primary keywords:** maintenance plumber, commercial plumber, residential plumber, 24/7 plumber
- FAQ sections on every industry/service/location page (min 5 questions)
- Internal linking: service pages → industry pages → location pages (and back)
- Suburb pages link to nearby suburbs via `nearbyInRegion` from `locations.ts`

---

## Suburb/Location System
- All suburbs live in `/src/data/locations.ts`
- Each suburb has: `name`, `slug`, `postcode`, `region`, `distanceKm`
- Regions: `logan` | `brisbane-south` | `redland` | `gold-coast-north` | `ipswich`
- Dynamic pages generated at `/plumber-[slug]` via `getStaticPaths()`
- To add a suburb: add an entry to the `suburbs` array in `locations.ts` — the page auto-generates on next build
- Hub page: `/service-areas` (lists all suburbs grouped by region)
- Broad area pages (separate, not generated): `/plumber-brisbane`, `/plumber-logan`, `/plumber-gold-coast`, `/plumber-ipswich`

---

## Integrations
- **HubSpot Portal ID:** [INSERT] → set in `.env.local` as `HUBSPOT_PORTAL_ID`
- **HubSpot Form IDs:** [INSERT after HubSpot setup] → `HUBSPOT_CONTACT_FORM_ID`, etc.
- **AroFlo:** Direct REST API with HMAC-SHA256 auth — see `src/lib/aroflo.ts`
  - Set: `AROFLO_ORG_HASH`, `AROFLO_USERNAME`, `AROFLO_PASSWORD`, `AROFLO_ZONE`
- **Xero:** via AroFlo native integration (no frontend connection needed)
- **Google Tag Manager:** [INSERT GTM ID] → `PUBLIC_GTM_ID` in `.env.local`
- **Google Analytics 4:** [INSERT GA4 ID] → `PUBLIC_GA4_ID` in `.env.local`
- Copy `.env.example` to `.env.local` and fill in all values before going live

---

## Industry Verticals
Pages to build at `/industries/[slug]`:
`retail`, `childcare`, `education`, `aged-care`, `student-accommodation`,
`commercial-real-estate`, `property-management`, `new-builds`, `civil`

Each uses `IndustryLayout.astro` and must include:
- Industry-specific intro copy
- Relevant services list with internal links
- Min 5 FAQs (rendered as `<details>` accordions with FAQ schema)
- "Related Services" links (auto-rendered by `IndustryLayout.astro`)

---

## Service Pages
Pages to build at `/services/[slug]`:
`blocked-drains`, `burst-pipes`, `hot-water-systems`, `gas-fitting`,
`leak-detection`, `drain-camera`, `backflow-prevention`, `preventative-maintenance`

Each uses `ServiceLayout.astro` and must include:
- Service description and process steps
- Industries served (with links to industry pages)
- Min 5 FAQs
- Location coverage

---

## Assets
| File | Description |
|---|---|
| `public/images/logo.png` | Main logo (downloaded from pulseqld.com.au) |
| `public/favicon.svg` | Flame mark SVG favicon |
| `public/images/flame-mark.svg` | Standalone flame icon |
| `public/images/logo-full-dark.svg` | Full SVG logo for dark backgrounds |
| `public/images/logo-full-light.svg` | Full SVG logo for light backgrounds |
| `public/images/truck-hero.jpg` | Hero truck image |
| `public/site.webmanifest` | PWA manifest |
| `public/og-default.jpg` | TODO: create default OG image (1200×630) |
| `public/apple-touch-icon.png` | TODO: export flame-mark.svg at 180×180px |
| `public/favicon-192.png` | TODO: export flame-mark.svg at 192×192px |
| `public/favicon-512.png` | TODO: export flame-mark.svg at 512×512px |

---

## Commands
```bash
npm run dev      # Start local dev server (Cloudflare Workers emulation)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

## TODO before launch
- [ ] Insert ABN in `Footer.astro` and `Schema.astro`
- [ ] Insert QBCC licence number in `Footer.astro` and `Schema.astro`
- [ ] Set up HubSpot account → get Portal ID + Form GUIDs → add to `.env.local`
- [ ] Set up Google Tag Manager → get GTM-XXXXXXX → add to `.env.local`
- [ ] Set up GA4 → get G-XXXXXXXXXX → add to `.env.local`
- [ ] Set up AroFlo API credentials → add to `.env.local`
- [ ] Export PNG favicons from `public/images/flame-mark.svg` (180, 192, 512px)
- [ ] Create OG default image at `public/og-default.jpg` (1200×630px)
- [ ] Build all 9 industry pages (`/industries/[slug]`)
- [ ] Build all 8 service pages (`/services/[slug]`)
- [ ] Build broad area pages (`/plumber-brisbane`, `/plumber-logan`, etc.)
- [ ] Build contact, about, blog pages
- [ ] Connect domain `pulseqld.com.au` to Cloudflare Pages
- [ ] Add `sameAs` social links to `Schema.astro` once socials confirmed
