import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const knowledge = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/knowledge' }),
  schema: z.object({
    title:             z.string(),
    description:       z.string(),
    publishDate:       z.coerce.date(),
    lastReviewed:      z.coerce.date(),
    author:            z.string().default('Lachlan De Santis'),
    authorCredentials: z.string().default('QBCC Lic 15384771'),
    category:          z.enum(['compliance', 'services', 'civil', 'costs', 'residential']),
    tags:              z.array(z.string()),
    featured:          z.boolean().default(false),
  }),
});

export const collections = { knowledge };
