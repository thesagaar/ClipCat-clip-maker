import { ENV, type AnalyticsProviderType } from './env';

export interface BrandConfig {
  parentBrandName: string;
  parentBrandAbbreviation: string;
  productName: string;
  productCategory: string;
  productTagline: string;
  productIdentity: string;
  shortAttribution: string;
  developedByStatement: string;
  welcomeAttribution: string;
  footerAttribution: string;
  copyrightStatement: string;
  aboutCopyright: string;
  platforms: string;
  processingSummary: string;
  version: string;
  website: string;
  supportUrl: string;
  supportEmail: string | null;
  privacyRoute: string;
  termsRoute: string;
  publicSiteUrl: string | null;
  analyticsEnabled: boolean;
  analyticsProvider: AnalyticsProviderType;
  errorMonitoringEnabled: boolean;
  assets: {
    sdpLogo: string;
    sdpLogoPng: string;
    sdpLogoWebp: string;
    clipcatLogo: string;
    clipcatLogoWebp: string;
    clipcatLogoSmall: string;
    clipcatLogoSmallWebp: string;
    clipcatMascot: string;
    clipcatMascotWebp: string;
    clipcatIcon: string;
    clipcatIconWebp: string;
    clipcatFavicon: string;
    favicon32: string;
    appleTouchIcon: string;
    icon192: string;
    icon512: string;
    faviconIco: string;
    socialPreviewImage: string;
    socialPreviewWebp: string;
  };
}

export const BRAND: BrandConfig = {
  parentBrandName: 'Single Dimension Projects',
  parentBrandAbbreviation: 'SDP',
  productName: 'ClipCat',
  productCategory: 'AI Video Clipping Studio',
  productTagline: 'Long videos. Short attention. Perfect clips.',
  productIdentity: 'ClipCat — A product by Single Dimension Projects',
  shortAttribution: 'A product by SDP',
  developedByStatement: 'ClipCat is developed by Single Dimension Projects.',
  welcomeAttribution: 'An AI-powered creative tool by Single Dimension Projects.',
  footerAttribution: 'ClipCat is a product of Single Dimension Projects.',
  copyrightStatement: '© 2026 Single Dimension Projects. All rights reserved.',
  aboutCopyright: '© 2026 Single Dimension Projects.',
  platforms: 'Web and Windows Desktop',
  processingSummary: 'Local-first AI video processing',
  version: ENV.APP_VERSION,
  website: ENV.SDP_WEBSITE_URL,
  supportUrl: ENV.SDP_SUPPORT_URL,
  supportEmail: ENV.SDP_SUPPORT_EMAIL,
  privacyRoute: '/privacy',
  termsRoute: '/terms',
  publicSiteUrl: ENV.PUBLIC_SITE_URL,
  analyticsEnabled: ENV.ANALYTICS_ENABLED,
  analyticsProvider: ENV.ANALYTICS_PROVIDER,
  errorMonitoringEnabled: ENV.ERROR_REPORTING_ENABLED,
  assets: {
    sdpLogo: '/brand/sdp-logo.svg',
    sdpLogoPng: '/brand/sdp-logo.png',
    sdpLogoWebp: '/brand/sdp-logo.webp',
    clipcatLogo: '/brand/clipcat-logo.png',
    clipcatLogoWebp: '/brand/clipcat-logo.webp',
    clipcatLogoSmall: '/brand/clipcat-logo-small.png',
    clipcatLogoSmallWebp: '/brand/clipcat-logo-small.webp',
    clipcatMascot: '/brand/clipcat-mascot.png',
    clipcatMascotWebp: '/brand/clipcat-mascot.webp',
    clipcatIcon: '/brand/clipcat-icon.png',
    clipcatIconWebp: '/brand/clipcat-icon.webp',
    clipcatFavicon: '/brand/clipcat-favicon.png',
    favicon32: '/brand/favicon-32x32.png',
    appleTouchIcon: '/brand/apple-touch-icon.png',
    icon192: '/brand/icon-192.png',
    icon512: '/brand/icon-512.png',
    faviconIco: '/brand/favicon.ico',
    socialPreviewImage: '/brand/og-preview.png',
    socialPreviewWebp: '/brand/og-preview.webp',
  },
};
