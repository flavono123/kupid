// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

// https://astro.build/config
export default defineConfig({
  site: isGitHubPages ? 'https://flavono123.github.io' : 'https://kattle.vercel.app',
  base: isGitHubPages ? '/kupid/' : '/',
  integrations: [tailwind(), react()],
});
