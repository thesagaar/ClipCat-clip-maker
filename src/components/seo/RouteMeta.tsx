import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackAnalyticsEvent } from '../../analytics/client';
import { BRAND } from '../../config/brand';
import { useUiStore } from '../../stores/uiStore';
import { resolveRouteMeta } from './routesMetaConfig';

function upsertMetaTag(
  attribute: 'name' | 'property',
  key: string,
  content: string
): void {
  const selector = `meta[${attribute}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function syncCanonicalTag(href: string | null): void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    existing.href = href;
    return;
  }
  const link = document.createElement('link');
  link.rel = 'canonical';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Synchronizes document title, SEO/OpenGraph/Twitter meta tags, conditional canonical URLs,
 * scroll-to-top navigation behavior, and optional sanitized page_viewed analytics.
 */
export function RouteMeta() {
  const { pathname, hash } = useLocation();
  const themeMode = useUiStore((s) => s.themeMode);

  useEffect(() => {
    const meta = resolveRouteMeta(pathname);
    document.title = meta.title;

    upsertMetaTag('name', 'description', meta.description);
    upsertMetaTag('name', 'robots', meta.robots);

    upsertMetaTag('property', 'og:title', meta.title);
    upsertMetaTag('property', 'og:description', meta.description);
    upsertMetaTag('property', 'og:site_name', BRAND.productName);
    upsertMetaTag('name', 'twitter:title', meta.title);
    upsertMetaTag('name', 'twitter:description', meta.description);

    const origin = BRAND.publicSiteUrl;
    const isIndexable = meta.robots.startsWith('index');
    const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const canonicalHref = origin && isIndexable ? `${origin}${cleanPath}` : null;
    syncCanonicalTag(canonicalHref);

    if (origin) {
      upsertMetaTag('property', 'og:url', `${origin}${cleanPath}`);
      upsertMetaTag('property', 'og:image', `${origin}${BRAND.assets.socialPreviewImage}`);
      upsertMetaTag('name', 'twitter:image', `${origin}${BRAND.assets.socialPreviewImage}`);
    } else {
      upsertMetaTag('property', 'og:image', BRAND.assets.socialPreviewImage);
      upsertMetaTag('name', 'twitter:image', BRAND.assets.socialPreviewImage);
    }

    trackAnalyticsEvent('page_viewed', {
      pageGroup: meta.pageGroup,
      themeMode,
    });
  }, [pathname, themeMode]);

  useEffect(() => {
    if (hash) {
      const targetId = hash.replace(/^#/, '');
      const timer = window.setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
      return () => window.clearTimeout(timer);
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return undefined;
  }, [pathname, hash]);

  return null;
}
