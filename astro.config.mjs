import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import robotsTxt from "astro-robots-txt";
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  markdown: {
    rehypePlugins: [rehypeAccessibleEmojis]
  },
  site: 'https://astro-portfolio-template.pages.dev',
  integrations: [
    tailwind(),
    react(),
    robotsTxt(),
    // /vote and /vote/admin are unlisted party pages — keep them out of the
    // sitemap (they also carry noindex in VoteLayout.astro).
    sitemap({ filter: (page) => !page.includes("/vote") }),
  ],
  output: "server",
  adapter: cloudflare()
});