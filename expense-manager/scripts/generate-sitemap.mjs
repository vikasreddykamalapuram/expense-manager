#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define all public routes in the app
const ROUTES = [
  '/',
  '/analytics',
  '/portfolio',
  '/portfolio-analytics',
  '/budgets',
  '/reports',
  '/health',
  '/trades',
  '/trade-import',
  '/accounts',
  '/categories',
  '/import',
  '/recurring',
  '/reminders',
  '/transactions',
  '/settings',
];

// Site config
const SITE_URL = 'https://vikasreddykamalapuram.github.io/expense-manager';
const BASE_PATH = '/expense-manager';

/**
 * Generate XML sitemap
 */
function generateSitemap() {
  const entries = ROUTES.map(route => {
    const url = `${SITE_URL}${route === '/' ? '' : route}`;
    const priority = route === '/' ? '1.0' : route.includes('analytics') || route.includes('portfolio') ? '0.9' : '0.8';
    const changefreq = route === '/' ? 'weekly' : 'monthly';
    
    return `  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;

  return xml;
}

/**
 * Generate robots.txt
 */
function generateRobotsTxt() {
  return `# ExpenseIQ - Personal Finance Manager
# https://vikasreddykamalapuram.github.io/expense-manager

User-agent: *
Allow: /expense-manager/
Disallow: /expense-manager/login
Disallow: /expense-manager/add
Disallow: /expense-manager/settings

# Allow crawling of static assets
Allow: /expense-manager/assets/
Allow: /expense-manager/prices.json
Allow: /expense-manager/nse-symbol-map.json

# Crawl delay (optional, in seconds)
Crawl-delay: 1

# Sitemaps
Sitemap: https://vikasreddykamalapuram.github.io/expense-manager/sitemap.xml
`;
}

/**
 * Main generation function
 */
function main() {
  const publicDir = path.join(__dirname, '../public');
  const sitemapPath = path.join(publicDir, 'sitemap.xml');
  const robotsPath = path.join(publicDir, 'robots.txt');

  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Generate and write sitemap.xml
  const sitemap = generateSitemap();
  fs.writeFileSync(sitemapPath, sitemap, 'utf-8');
  console.log(`✅ Sitemap generated: ${sitemapPath}`);
  console.log(`   Total routes: ${ROUTES.length}`);
  console.log(`   Size: ${(sitemap.length / 1024).toFixed(2)} KB`);

  // Generate and write robots.txt
  const robotsTxt = generateRobotsTxt();
  fs.writeFileSync(robotsPath, robotsTxt, 'utf-8');
  console.log(`✅ robots.txt generated: ${robotsPath}`);
  console.log(`   Size: ${(robotsTxt.length / 1024).toFixed(2)} KB`);

  console.log(`\n✅ SEO files ready for deployment!`);
}

main();
