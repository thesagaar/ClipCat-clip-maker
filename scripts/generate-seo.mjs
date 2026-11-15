import fs from 'fs';
import path from 'path';

const publicDir = path.resolve(process.cwd(), 'public');
const robotsPath = path.join(publicDir, 'robots.txt');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

const rawSiteUrl = (process.env.VITE_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');

let validOrigin = null;
if (rawSiteUrl) {
  try {
    const parsed = new URL(rawSiteUrl);
    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password) {
      validOrigin = parsed.origin;
    }
  } catch {
    validOrigin = null;
  }
}

const baseRobots = [
  'User-agent: *',
  'Allow: /',
  'Allow: /privacy',
  'Allow: /terms',
  '',
  'Disallow: /projects',
  'Disallow: /projects/',
  'Disallow: /clips',
  'Disallow: /clips/',
  'Disallow: /exports',
  'Disallow: /presets',
  'Disallow: /templates',
  'Disallow: /settings',
  'Disallow: /system',
  'Disallow: /api/',
  'Disallow: /assets/aistudio/',
];

if (validOrigin) {
  const publicRoutes = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/privacy', priority: '0.4', changefreq: 'monthly' },
    { path: '/terms', priority: '0.4', changefreq: 'monthly' },
  ];
  const lastmod = new Date().toISOString().split('T')[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes
  .map(
    (route) => `  <url>
    <loc>${validOrigin}${route.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  fs.writeFileSync(robotsPath, `${baseRobots.join('\n')}\n\nSitemap: ${validOrigin}/sitemap.xml\n`, 'utf8');
  console.log(`[seo] Generated public/sitemap.xml and Sitemap directive for ${validOrigin}`);
} else {
  if (fs.existsSync(sitemapPath)) {
    fs.unlinkSync(sitemapPath);
  }
  fs.writeFileSync(robotsPath, `${baseRobots.join('\n')}\n`, 'utf8');
  console.log('[seo] VITE_PUBLIC_SITE_URL not set; skipped sitemap.xml generation to avoid inventing a domain.');
}
