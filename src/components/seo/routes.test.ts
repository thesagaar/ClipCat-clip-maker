import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SDP_LINKS, STUDIO_LINKS, WORKSPACE_LINKS } from '../layout/footerConfig';
import { resolveRouteMeta, ROUTE_META_DEFINITIONS } from './routesMetaConfig';

describe('ClipCat route SEO metadata and footer link integrity', () => {
  it('assigns unique titles and descriptions across all defined routes', () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const def of ROUTE_META_DEFINITIONS) {
      assert.ok(def.title.includes('ClipCat'), `Missing ClipCat branding in title: ${def.title}`);
      assert.ok(def.description.length >= 30, `Description too short for ${def.pattern}`);
      assert.equal(titles.has(def.title), false, `Duplicate title: ${def.title}`);
      assert.equal(descriptions.has(def.description), false, `Duplicate description: ${def.description}`);
      titles.add(def.title);
      descriptions.add(def.description);
    }
  });

  it('marks public pages as indexable and workspace/private/404 routes as noindex', () => {
    assert.equal(resolveRouteMeta('/').robots, 'index, follow');
    assert.equal(resolveRouteMeta('/privacy').robots, 'index, follow');
    assert.equal(resolveRouteMeta('/terms').robots, 'index, follow');

    const privatePaths = [
      '/projects',
      '/projects/new',
      '/chatspike',
      '/projects/proj-1/processing',
      '/projects/proj-1/clips',
      '/clips',
      '/clips/clip-1/edit',
      '/exports',
      '/presets',
      '/templates',
      '/settings',
      '/system',
      '/definitely-nonexistent-page',
    ];

    for (const path of privatePaths) {
      assert.equal(resolveRouteMeta(path).robots, 'noindex, nofollow', `Expected noindex on ${path}`);
    }
  });

  it('verifies every footer link resolves to a known internal route or valid external HTTPS URL with no # placeholder', () => {
    const allLinks = [...WORKSPACE_LINKS, ...STUDIO_LINKS, ...SDP_LINKS];
    for (const link of allLinks) {
      if (link.href) {
        assert.notEqual(link.href, '#');
        assert.ok(link.href.startsWith('https://'), `Expected HTTPS external footer link for ${link.label}`);
      } else if (link.to) {
        const cleanPath = link.to.split('#')[0];
        const resolved = resolveRouteMeta(cleanPath);
        assert.notEqual(resolved.pageGroup, 'not_found', `Broken internal footer link: ${link.to}`);
      } else {
        assert.fail(`Footer link "${link.label}" missing both to and href`);
      }
    }
  });
});
