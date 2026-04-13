/**
 * All service area suburbs within ~30km of Loganholme, QLD 4129.
 * Organised by region for navigation grouping and SEO page generation.
 *
 * Each entry generates a page at /plumber-[slug]
 */

export interface Suburb {
  name: string;
  slug: string;
  postcode: string;
  region: RegionKey;
  distanceKm: number; // approx from Loganholme
}

export type RegionKey =
  | 'logan'
  | 'brisbane-south'
  | 'redland'
  | 'gold-coast-north'
  | 'ipswich';

export const REGION_LABELS: Record<RegionKey, string> = {
  'logan':            'Logan City',
  'brisbane-south':   'Brisbane South',
  'redland':          'Redland City',
  'gold-coast-north': 'Gold Coast North',
  'ipswich':          'Ipswich',
};

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING BROAD AREA pages (kept as-is, not generated from this list)
// /plumber-brisbane, /plumber-logan, /plumber-gold-coast, /plumber-ipswich
// ─────────────────────────────────────────────────────────────────────────────

export const suburbs: Suburb[] = [
  // ── LOGAN CITY ─────────────────────────────────────────────────────────────
  { name: 'Loganholme',       slug: 'loganholme',       postcode: '4129', region: 'logan', distanceKm: 0  },
  { name: 'Loganlea',         slug: 'loganlea',         postcode: '4131', region: 'logan', distanceKm: 3  },
  { name: 'Shailer Park',     slug: 'shailer-park',     postcode: '4128', region: 'logan', distanceKm: 3  },
  { name: 'Cornubia',         slug: 'cornubia',         postcode: '4130', region: 'logan', distanceKm: 4  },
  { name: 'Daisy Hill',       slug: 'daisy-hill',       postcode: '4127', region: 'logan', distanceKm: 4  },
  { name: 'Rochedale South',  slug: 'rochedale-south',  postcode: '4123', region: 'logan', distanceKm: 4  },
  { name: 'Tanah Merah',      slug: 'tanah-merah',      postcode: '4128', region: 'logan', distanceKm: 5  },
  { name: 'Carbrook',         slug: 'carbrook',         postcode: '4130', region: 'logan', distanceKm: 6  },
  { name: 'Springwood',       slug: 'springwood',       postcode: '4127', region: 'logan', distanceKm: 7  },
  { name: 'Underwood',        slug: 'underwood',        postcode: '4119', region: 'logan', distanceKm: 7  },
  { name: 'Slacks Creek',     slug: 'slacks-creek',     postcode: '4127', region: 'logan', distanceKm: 8  },
  { name: 'Kingston',         slug: 'kingston',         postcode: '4114', region: 'logan', distanceKm: 8  },
  { name: 'Woodridge',        slug: 'woodridge',        postcode: '4114', region: 'logan', distanceKm: 9  },
  { name: 'Logan Central',    slug: 'logan-central',    postcode: '4114', region: 'logan', distanceKm: 9  },
  { name: 'Meadowbrook',      slug: 'meadowbrook',      postcode: '4131', region: 'logan', distanceKm: 4  },
  { name: 'Regents Park',     slug: 'regents-park',     postcode: '4118', region: 'logan', distanceKm: 9  },
  { name: 'Heritage Park',    slug: 'heritage-park',    postcode: '4118', region: 'logan', distanceKm: 9  },
  { name: 'Hillcrest',        slug: 'hillcrest',        postcode: '4118', region: 'logan', distanceKm: 9  },
  { name: 'Forestdale',       slug: 'forestdale',       postcode: '4118', region: 'logan', distanceKm: 10 },
  { name: 'Holmview',         slug: 'holmview',         postcode: '4207', region: 'logan', distanceKm: 10 },
  { name: 'Eagleby',          slug: 'eagleby',          postcode: '4207', region: 'logan', distanceKm: 11 },
  { name: 'Beenleigh',        slug: 'beenleigh',        postcode: '4207', region: 'logan', distanceKm: 11 },
  { name: 'Edens Landing',    slug: 'edens-landing',    postcode: '4207', region: 'logan', distanceKm: 12 },
  { name: 'Mount Warren Park',slug: 'mount-warren-park',postcode: '4207', region: 'logan', distanceKm: 12 },
  { name: 'Windaroo',         slug: 'windaroo',         postcode: '4207', region: 'logan', distanceKm: 13 },
  { name: 'Stapylton',        slug: 'stapylton',        postcode: '4207', region: 'logan', distanceKm: 13 },
  { name: 'Buccan',           slug: 'buccan',           postcode: '4207', region: 'logan', distanceKm: 13 },
  { name: 'Kairabah',         slug: 'kairabah',         postcode: '4207', region: 'logan', distanceKm: 13 },
  { name: 'Crestmead',        slug: 'crestmead',        postcode: '4132', region: 'logan', distanceKm: 13 },
  { name: 'Marsden',          slug: 'marsden',          postcode: '4132', region: 'logan', distanceKm: 13 },
  { name: 'Berrinba',         slug: 'berrinba',         postcode: '4117', region: 'logan', distanceKm: 13 },
  { name: 'Karawatha',        slug: 'karawatha',        postcode: '4117', region: 'logan', distanceKm: 14 },
  { name: 'Drewvale',         slug: 'drewvale',         postcode: '4116', region: 'logan', distanceKm: 14 },
  { name: 'Calamvale',        slug: 'calamvale',        postcode: '4116', region: 'logan', distanceKm: 14 },
  { name: 'Stretton',         slug: 'stretton',         postcode: '4116', region: 'logan', distanceKm: 14 },
  { name: 'Algester',         slug: 'algester',         postcode: '4115', region: 'logan', distanceKm: 14 },
  { name: 'Parkinson',        slug: 'parkinson',        postcode: '4115', region: 'logan', distanceKm: 14 },
  { name: 'Waterford',        slug: 'waterford',        postcode: '4133', region: 'logan', distanceKm: 14 },
  { name: 'Waterford West',   slug: 'waterford-west',   postcode: '4133', region: 'logan', distanceKm: 14 },
  { name: 'Browns Plains',    slug: 'browns-plains',    postcode: '4118', region: 'logan', distanceKm: 15 },
  { name: 'Greenbank',        slug: 'greenbank',        postcode: '4124', region: 'logan', distanceKm: 15 },
  { name: 'Lyons',            slug: 'lyons',            postcode: '4124', region: 'logan', distanceKm: 15 },
  { name: 'Boronia Heights',  slug: 'boronia-heights',  postcode: '4124', region: 'logan', distanceKm: 16 },
  { name: 'New Beith',        slug: 'new-beith',        postcode: '4124', region: 'logan', distanceKm: 16 },
  { name: 'Priestdale',       slug: 'priestdale',       postcode: '4127', region: 'logan', distanceKm: 10 },
  { name: 'Logan Village',    slug: 'logan-village',    postcode: '4207', region: 'logan', distanceKm: 16 },
  { name: 'Bahrs Scrub',      slug: 'bahrs-scrub',      postcode: '4207', region: 'logan', distanceKm: 16 },
  { name: 'Wolffdene',        slug: 'wolffdene',        postcode: '4207', region: 'logan', distanceKm: 17 },
  { name: 'Alberton',         slug: 'alberton',         postcode: '4207', region: 'logan', distanceKm: 17 },
  { name: 'Heathwood',        slug: 'heathwood',        postcode: '4110', region: 'logan', distanceKm: 17 },
  { name: 'Willawong',        slug: 'willawong',        postcode: '4110', region: 'logan', distanceKm: 17 },
  { name: 'Park Ridge',       slug: 'park-ridge',       postcode: '4125', region: 'logan', distanceKm: 17 },
  { name: 'Park Ridge South', slug: 'park-ridge-south', postcode: '4125', region: 'logan', distanceKm: 18 },
  { name: 'Munruben',         slug: 'munruben',         postcode: '4125', region: 'logan', distanceKm: 18 },
  { name: 'Kuraby',           slug: 'kuraby',           postcode: '4112', region: 'logan', distanceKm: 16 },
  { name: 'Eight Mile Plains',slug: 'eight-mile-plains',postcode: '4113', region: 'logan', distanceKm: 16 },
  { name: 'Runcorn',          slug: 'runcorn',          postcode: '4113', region: 'logan', distanceKm: 17 },
  { name: 'Nathan',           slug: 'nathan',           postcode: '4111', region: 'logan', distanceKm: 18 },
  { name: 'Rocklea',          slug: 'rocklea',          postcode: '4106', region: 'logan', distanceKm: 19 },
  { name: 'Acacia Ridge',     slug: 'acacia-ridge',     postcode: '4110', region: 'logan', distanceKm: 18 },
  { name: 'Coopers Plains',   slug: 'coopers-plains',   postcode: '4108', region: 'logan', distanceKm: 18 },
  { name: 'Archerfield',      slug: 'archerfield',      postcode: '4108', region: 'logan', distanceKm: 18 },
  { name: 'Jimboomba',        slug: 'jimboomba',        postcode: '4280', region: 'logan', distanceKm: 19 },
  { name: 'North Maclean',    slug: 'north-maclean',    postcode: '4280', region: 'logan', distanceKm: 20 },
  { name: 'South Maclean',    slug: 'south-maclean',    postcode: '4280', region: 'logan', distanceKm: 21 },
  { name: 'Cedar Grove',      slug: 'cedar-grove',      postcode: '4285', region: 'logan', distanceKm: 22 },
  { name: 'Cedar Vale',       slug: 'cedar-vale',       postcode: '4285', region: 'logan', distanceKm: 22 },
  { name: 'Cedar Creek',      slug: 'cedar-creek',      postcode: '4285', region: 'logan', distanceKm: 23 },
  { name: 'Flagstone',        slug: 'flagstone',        postcode: '4280', region: 'logan', distanceKm: 22 },
  { name: 'Flinders Lakes',   slug: 'flinders-lakes',   postcode: '4280', region: 'logan', distanceKm: 23 },
  { name: 'Mundoolun',        slug: 'mundoolun',        postcode: '4285', region: 'logan', distanceKm: 24 },
  { name: 'Glenlogan',        slug: 'glenlogan',        postcode: '4285', region: 'logan', distanceKm: 24 },
  { name: 'Veresdale',        slug: 'veresdale',        postcode: '4285', region: 'logan', distanceKm: 23 },
  { name: 'Undullah',         slug: 'undullah',         postcode: '4285', region: 'logan', distanceKm: 26 },

  // ── BRISBANE SOUTHSIDE ──────────────────────────────────────────────────────
  { name: 'Rochedale',        slug: 'rochedale',        postcode: '4123', region: 'brisbane-south', distanceKm: 6  },
  { name: 'Sunnybank',        slug: 'sunnybank',        postcode: '4109', region: 'brisbane-south', distanceKm: 15 },
  { name: 'Sunnybank Hills',  slug: 'sunnybank-hills',  postcode: '4109', region: 'brisbane-south', distanceKm: 15 },
  { name: 'Macgregor',        slug: 'macgregor',        postcode: '4109', region: 'brisbane-south', distanceKm: 15 },
  { name: 'Robertson',        slug: 'robertson',        postcode: '4109', region: 'brisbane-south', distanceKm: 15 },
  { name: 'Salisbury',        slug: 'salisbury',        postcode: '4107', region: 'brisbane-south', distanceKm: 16 },
  { name: 'Moorooka',         slug: 'moorooka',         postcode: '4105', region: 'brisbane-south', distanceKm: 17 },
  { name: 'Yeerongpilly',     slug: 'yeerongpilly',     postcode: '4105', region: 'brisbane-south', distanceKm: 18 },
  { name: 'Annerley',         slug: 'annerley',         postcode: '4103', region: 'brisbane-south', distanceKm: 18 },
  { name: 'Fairfield',        slug: 'fairfield',        postcode: '4103', region: 'brisbane-south', distanceKm: 18 },
  { name: 'Yeronga',          slug: 'yeronga',          postcode: '4104', region: 'brisbane-south', distanceKm: 18 },
  { name: 'Upper Mount Gravatt', slug: 'upper-mount-gravatt', postcode: '4122', region: 'brisbane-south', distanceKm: 17 },
  { name: 'Mount Gravatt East',  slug: 'mount-gravatt-east',  postcode: '4122', region: 'brisbane-south', distanceKm: 17 },
  { name: 'Mount Gravatt',    slug: 'mount-gravatt',    postcode: '4122', region: 'brisbane-south', distanceKm: 17 },
  { name: 'Holland Park',     slug: 'holland-park',     postcode: '4121', region: 'brisbane-south', distanceKm: 18 },
  { name: 'Holland Park West',slug: 'holland-park-west',postcode: '4121', region: 'brisbane-south', distanceKm: 18 },
  { name: 'Carindale',        slug: 'carindale',        postcode: '4152', region: 'brisbane-south', distanceKm: 18 },
  { name: 'Chandler',         slug: 'chandler',         postcode: '4155', region: 'brisbane-south', distanceKm: 17 },
  { name: 'Ransome',          slug: 'ransome',          postcode: '4154', region: 'brisbane-south', distanceKm: 17 },
  { name: 'Tingalpa',         slug: 'tingalpa',         postcode: '4173', region: 'brisbane-south', distanceKm: 18 },
  { name: 'Cannon Hill',      slug: 'cannon-hill',      postcode: '4170', region: 'brisbane-south', distanceKm: 20 },
  { name: 'Murarrie',         slug: 'murarrie',         postcode: '4172', region: 'brisbane-south', distanceKm: 20 },
  { name: 'Wynnum',           slug: 'wynnum',           postcode: '4178', region: 'brisbane-south', distanceKm: 22 },
  { name: 'Wynnum West',      slug: 'wynnum-west',      postcode: '4178', region: 'brisbane-south', distanceKm: 21 },
  { name: 'Manly',            slug: 'manly',            postcode: '4179', region: 'brisbane-south', distanceKm: 23 },
  { name: 'Manly West',       slug: 'manly-west',       postcode: '4179', region: 'brisbane-south', distanceKm: 22 },
  { name: 'Lota',             slug: 'lota',             postcode: '4179', region: 'brisbane-south', distanceKm: 23 },
  { name: 'Hemmant',          slug: 'hemmant',          postcode: '4174', region: 'brisbane-south', distanceKm: 21 },
  { name: 'Dutton Park',      slug: 'dutton-park',      postcode: '4102', region: 'brisbane-south', distanceKm: 20 },
  { name: 'Woolloongabba',    slug: 'woolloongabba',    postcode: '4102', region: 'brisbane-south', distanceKm: 20 },
  { name: 'Coorparoo',        slug: 'coorparoo',        postcode: '4151', region: 'brisbane-south', distanceKm: 19 },
  { name: 'Greenslopes',      slug: 'greenslopes',      postcode: '4120', region: 'brisbane-south', distanceKm: 19 },
  { name: 'Tarragindi',       slug: 'tarragindi',       postcode: '4121', region: 'brisbane-south', distanceKm: 19 },
  { name: 'Wellers Hill',     slug: 'wellers-hill',     postcode: '4121', region: 'brisbane-south', distanceKm: 19 },
  { name: 'Wishart',          slug: 'wishart',          postcode: '4122', region: 'brisbane-south', distanceKm: 17 },
  { name: 'Mansfield',        slug: 'mansfield',        postcode: '4122', region: 'brisbane-south', distanceKm: 17 },
  { name: 'Mackenzie',        slug: 'mackenzie',        postcode: '4156', region: 'brisbane-south', distanceKm: 14 },
  { name: 'Belmont',          slug: 'belmont',          postcode: '4153', region: 'brisbane-south', distanceKm: 17 },
  { name: 'Gumdale',          slug: 'gumdale',          postcode: '4154', region: 'brisbane-south', distanceKm: 16 },
  { name: 'Burbank',          slug: 'burbank',          postcode: '4156', region: 'brisbane-south', distanceKm: 14 },

  // ── REDLAND CITY ────────────────────────────────────────────────────────────
  { name: 'Capalaba',         slug: 'capalaba',         postcode: '4157', region: 'redland', distanceKm: 12 },
  { name: 'Sheldon',          slug: 'sheldon',          postcode: '4157', region: 'redland', distanceKm: 12 },
  { name: 'Mount Cotton',     slug: 'mount-cotton',     postcode: '4165', region: 'redland', distanceKm: 12 },
  { name: 'Thornlands',       slug: 'thornlands',       postcode: '4164', region: 'redland', distanceKm: 14 },
  { name: 'Alexandra Hills',  slug: 'alexandra-hills',  postcode: '4161', region: 'redland', distanceKm: 15 },
  { name: 'Ormiston',         slug: 'ormiston',         postcode: '4160', region: 'redland', distanceKm: 17 },
  { name: 'Wellington Point', slug: 'wellington-point', postcode: '4160', region: 'redland', distanceKm: 17 },
  { name: 'Birkdale',         slug: 'birkdale',         postcode: '4159', region: 'redland', distanceKm: 17 },
  { name: 'Thorneside',       slug: 'thorneside',       postcode: '4158', region: 'redland', distanceKm: 16 },
  { name: 'Victoria Point',   slug: 'victoria-point',   postcode: '4165', region: 'redland', distanceKm: 17 },
  { name: 'Redland Bay',      slug: 'redland-bay',      postcode: '4165', region: 'redland', distanceKm: 18 },
  { name: 'Cleveland',        slug: 'cleveland',        postcode: '4163', region: 'redland', distanceKm: 20 },
  { name: 'Raby Bay',         slug: 'raby-bay',         postcode: '4163', region: 'redland', distanceKm: 20 },

  // ── GOLD COAST NORTH ────────────────────────────────────────────────────────
  { name: 'Yatala',           slug: 'yatala',           postcode: '4207', region: 'gold-coast-north', distanceKm: 19 },
  { name: 'Ormeau',           slug: 'ormeau',           postcode: '4208', region: 'gold-coast-north', distanceKm: 21 },
  { name: 'Ormeau Hills',     slug: 'ormeau-hills',     postcode: '4208', region: 'gold-coast-north', distanceKm: 22 },
  { name: 'Norwell',          slug: 'norwell',          postcode: '4208', region: 'gold-coast-north', distanceKm: 23 },
  { name: 'Kingsholme',       slug: 'kingsholme',       postcode: '4208', region: 'gold-coast-north', distanceKm: 23 },
  { name: 'Jacobs Well',      slug: 'jacobs-well',      postcode: '4208', region: 'gold-coast-north', distanceKm: 22 },
  { name: 'Pimpama',          slug: 'pimpama',          postcode: '4209', region: 'gold-coast-north', distanceKm: 24 },
  { name: 'Coomera',          slug: 'coomera',          postcode: '4209', region: 'gold-coast-north', distanceKm: 26 },
  { name: 'Upper Coomera',    slug: 'upper-coomera',    postcode: '4209', region: 'gold-coast-north', distanceKm: 27 },
  { name: 'Oxenford',         slug: 'oxenford',         postcode: '4210', region: 'gold-coast-north', distanceKm: 28 },
  { name: 'Willow Vale',      slug: 'willow-vale',      postcode: '4209', region: 'gold-coast-north', distanceKm: 27 },

  // ── IPSWICH ─────────────────────────────────────────────────────────────────
  { name: 'Goodna',           slug: 'goodna',           postcode: '4300', region: 'ipswich', distanceKm: 23 },
  { name: 'Redbank',          slug: 'redbank',          postcode: '4301', region: 'ipswich', distanceKm: 25 },
  { name: 'Redbank Plains',   slug: 'redbank-plains',   postcode: '4301', region: 'ipswich', distanceKm: 25 },
  { name: 'Springfield',      slug: 'springfield',      postcode: '4300', region: 'ipswich', distanceKm: 26 },
  { name: 'Springfield Lakes',slug: 'springfield-lakes',postcode: '4300', region: 'ipswich', distanceKm: 26 },
  { name: 'Augustine Heights',slug: 'augustine-heights',postcode: '4300', region: 'ipswich', distanceKm: 27 },
  { name: 'Camira',           slug: 'camira',           postcode: '4300', region: 'ipswich', distanceKm: 27 },
  { name: 'Ripley',           slug: 'ripley',           postcode: '4306', region: 'ipswich', distanceKm: 28 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All suburbs grouped by region, sorted by distance */
export const suburbsByRegion = Object.entries(REGION_LABELS).map(([key, label]) => ({
  key: key as RegionKey,
  label,
  suburbs: suburbs
    .filter((s) => s.region === key)
    .sort((a, b) => a.distanceKm - b.distanceKm),
}));

/** Quick lookup by slug */
export const suburbBySlug = new Map(suburbs.map((s) => [s.slug, s]));

/** Suburbs close enough to feature in nav dropdowns (≤20km) */
export const nearbySuburbs = suburbs.filter((s) => s.distanceKm <= 20);
