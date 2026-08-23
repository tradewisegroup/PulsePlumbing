/**
 * Builds /llms.txt from the real page tree so the file cannot drift
 * from routes that actually exist.
 *
 * Services / industries / civil / resources come from import.meta.glob
 * of src/pages. Coverage suburbs come from src/data/locations.ts.
 * Knowledge articles come from the knowledge content collection files.
 */

import { suburbs } from '../data/locations';
import {
  ABN,
  ACN,
  BASE_POSTCODE,
  BASE_SUBURB,
  EMAIL,
  EMERGENCY_PHONE,
  LEGAL_NAME,
  NSW_LICENCE,
  OFFICE_PHONE,
  QBCC_LICENCE,
  SITE_URL,
  TRADING_NAME,
} from './site';

interface Link {
  title: string;
  href: string;
}

const SITE = SITE_URL;

const servicePages = import.meta.glob('../pages/services/*.astro', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const industryPages = import.meta.glob('../pages/industries/*.astro', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const civilPages = import.meta.glob('../pages/civil/*.{astro,md}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const rootPages = import.meta.glob('../pages/*.astro', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const knowledgePages = import.meta.glob('../content/knowledge/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function fileSlug(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.(astro|md|mdx)$/, '');
}

function attr(source: string, name: string): string | undefined {
  const match = source.match(new RegExp(`${name}="([^"]+)"`));
  return match?.[1];
}

function frontmatterTitle(source: string): string | undefined {
  const match = source.match(/^---[\s\S]*?^title:\s*["']?(.+?)["']?\s*$/m);
  return match?.[1]?.replace(/^["']|["']$/g, '');
}

function titleFromHeading(source: string): string | undefined {
  const h1 = source.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/);
  return h1?.[1]?.replace(/&amp;/g, '&').trim();
}

const SERVICE_FALLBACK: Record<string, string> = {
  index: 'All Services',
  'blocked-drains': 'Blocked Drains',
  'hot-water-systems': 'Hot Water Systems',
  'gas-fitting': 'Gas Fitting',
  'drain-camera': 'CCTV Drain Camera',
  'backflow-prevention': 'Backflow Prevention',
  'maintenance-plumbing': 'Maintenance Plumbing',
  'preventative-maintenance': 'Preventative Maintenance',
  residential: 'Residential Plumbing',
  commercial: 'Commercial Plumbing',
  insinkerator: 'Insinkerator Installation & Repair',
};

const INDUSTRY_FALLBACK: Record<string, string> = {
  index: 'All Industries',
  childcare: 'Childcare',
  'aged-care': 'Aged Care',
  education: 'Education',
  hospitality: 'Hospitality — Restaurants, Cafes & Pubs',
  retail: 'Retail',
  'student-accommodation': 'Student Accommodation',
  'commercial-real-estate': 'Commercial Real Estate',
  'property-management': 'Property Management',
  'new-builds': 'New Builds',
  civil: 'Civil',
};

const CIVIL_FALLBACK: Record<string, string> = {
  index: 'Civil Services Overview',
  'water-mains': 'Water Main Installation',
  stormwater: 'Stormwater Drainage',
  'sewer-construction': 'Sewer Construction',
  'infrastructure-maintenance': 'Infrastructure Maintenance',
  contact: 'Civil Enquiry / RFQ',
};

const RESOURCE_TITLES: Record<string, string> = {
  about: 'About Pulse Plumbing, Gas & Civil',
  contact: 'Contact — Get a Free Quote',
  testimonials: 'Testimonials',
  careers: 'Careers — Join the Team',
  'strata-scorecard': 'Strata Compliance Scorecard',
  'privacy-policy': 'Privacy Policy',
  terms: 'Terms of Use',
  disclaimer: 'Disclaimer',
};

function linksFromGlob(
  files: Record<string, string>,
  hrefFor: (slug: string) => string | null,
  titleFor: (slug: string, source: string) => string,
): Link[] {
  return Object.entries(files)
    .map(([path, source]) => {
      const slug = fileSlug(path);
      const href = hrefFor(slug);
      if (!href) return null;
      return { title: titleFor(slug, source), href };
    })
    .filter((link): link is Link => link !== null)
    .sort((a, b) => {
      const hubs = new Set(['/services', '/industries', '/civil']);
      const aHub = hubs.has(a.href);
      const bHub = hubs.has(b.href);
      if (aHub !== bHub) return aHub ? 1 : -1;
      return a.title.localeCompare(b.title);
    });
}

function mdLink({ title, href }: Link): string {
  return `- [${title}](${SITE}${href})`;
}

export function generateLlmsTxt(): string {
  const services = linksFromGlob(
    servicePages,
    (slug) => (slug === 'index' ? '/services' : `/services/${slug}`),
    (slug, source) =>
      SERVICE_FALLBACK[slug] ?? attr(source, 'serviceName') ?? titleFromHeading(source) ?? slug,
  );

  const industries = linksFromGlob(
    industryPages,
    (slug) => (slug === 'index' ? '/industries' : `/industries/${slug}`),
    (slug, source) =>
      INDUSTRY_FALLBACK[slug] ?? attr(source, 'industryName') ?? titleFromHeading(source) ?? slug,
  );

  const civil = linksFromGlob(
    civilPages,
    (slug) => (slug === 'index' ? '/civil' : `/civil/${slug}`),
    (slug, source) =>
      CIVIL_FALLBACK[slug] ?? attr(source, 'pageTitle') ?? titleFromHeading(source) ?? slug,
  );

  const coverage: Link[] = [
    { title: `Service Areas — all ${suburbs.length} suburbs`, href: '/service-areas' },
    ...Object.entries(rootPages)
      .map(([path]) => fileSlug(path))
      .filter((slug) => slug.startsWith('plumber-') && !slug.includes('['))
      .map((slug) => ({
        title: slug
          .replace('plumber-', 'Plumber ')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        href: `/${slug}`,
      })),
    ...suburbs.map((s) => ({
      title: `Plumber ${s.name} ${s.postcode}`,
      href: `/plumber-${s.slug}`,
    })),
  ];

  const knowledge: Link[] = [
    { title: 'Knowledge Base', href: '/knowledge-base' },
    ...Object.entries(knowledgePages).map(([path, source]) => ({
      title: frontmatterTitle(source) ?? fileSlug(path),
      href: `/knowledge-base/${fileSlug(path)}`,
    })),
  ];

  const skipRoot = new Set([
    'index',
    '404',
    'plumber-[suburb]',
    'service-areas',
  ]);

  const resources: Link[] = [
    ...Object.entries(rootPages)
      .map(([path, source]) => {
        const slug = fileSlug(path);
        if (skipRoot.has(slug) || slug.startsWith('plumber-')) return null;
        return {
          title: RESOURCE_TITLES[slug] ?? titleFromHeading(source) ?? slug,
          href: `/${slug}`,
        };
      })
      .filter((link): link is Link => link !== null),
    { title: 'Blog / News', href: '/blog' },
    ...knowledge,
  ].sort((a, b) => a.title.localeCompare(b.title));

  // Prefer a stable resource order: about, contact, testimonials, careers, scorecard, then the rest.
  const resourcePriority = [
    '/about',
    '/contact',
    '/testimonials',
    '/careers',
    '/strata-scorecard',
    '/knowledge-base',
    '/blog',
  ];
  resources.sort((a, b) => {
    const ai = resourcePriority.indexOf(a.href);
    const bi = resourcePriority.indexOf(b.href);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.title.localeCompare(b.title);
  });

  const lines = [
    `# ${TRADING_NAME}`,
    '',
    `> ${TRADING_NAME} is a QBCC-licensed trade business providing residential maintenance plumbing, commercial plumbing, gas fitting, and civil infrastructure works across South-East Queensland and Northern NSW. The business is family-run, based in ${BASE_SUBURB} (Logan City), and available 24 hours a day, 7 days a week including afterhours and weekends.`,
    '',
    `- **Trading name:** ${TRADING_NAME}`,
    `- **Legal entity:** ${LEGAL_NAME}`,
    `- **ABN:** ${ABN}`,
    `- **ACN:** ${ACN}`,
    `- **QBCC Contractor Licence (QLD):** ${QBCC_LICENCE} — Plumbing and Drainage`,
    `- **NSW Plumbing Licence:** ${NSW_LICENCE}`,
    `- **Office phone:** ${OFFICE_PHONE} (business hours)`,
    `- **Emergency mobile:** ${EMERGENCY_PHONE} (24/7 afterhours and emergency)`,
    `- **Email:** ${EMAIL}`,
    `- **Base suburb:** ${BASE_SUBURB}, QLD ${BASE_POSTCODE}`,
    `- **Service radius:** ${suburbs.length} suburbs within 30 km of Loganholme, South-East Queensland; civil works across SEQ and Northern NSW`,
    '- **Hours:** 24 / 7 including public holidays; afterhours line staffed by a licensed plumber',
    '',
    '## Services',
    '',
    ...services.map(mdLink),
    '',
    '## Industries',
    '',
    ...industries.map(mdLink),
    '',
    '## Civil',
    '',
    ...civil.map(mdLink),
    '',
    '## Coverage',
    '',
    ...coverage.map(mdLink),
    '',
    '## Resources',
    '',
    ...resources.map(mdLink),
    '',
    '## Compliance',
    '',
    `All plumbing and drainage work carried out by ${TRADING_NAME} complies with:`,
    '',
    '- **AS/NZS 3500** — Plumbing and Drainage (the national standard for all plumbing installations in Australia)',
    '- **Queensland Plumbing and Drainage Act 2018** — the principal legislation governing licensed plumbing work in Queensland',
    '- **Standard Plumbing and Drainage Regulation 2019 (Qld)** — the associated regulation specifying notifiable work and Form 9 compliance certificates',
    `- **QBCC Contractor Licence ${QBCC_LICENCE}** — issued by the Queensland Building and Construction Commission, covering Plumbing and Drainage`,
    `- **NSW Plumbing Licence ${NSW_LICENCE}** — for plumbing work in Northern NSW`,
    '',
  ];

  return lines.join('\n');
}
