import { ENV } from './env';

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
  assets: {
    sdpLogo: string;
    sdpLogoPng: string;
    clipcatLogo: string;
    clipcatLogoSmall: string;
    clipcatMascot: string;
    clipcatIcon: string;
    clipcatFavicon: string;
    faviconIco: string;
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
  assets: {
    sdpLogo: '/assets/aistudio/sdp-logo-mark_5f38d36d.svg',
    sdpLogoPng: '/brand/sdp-logo.png',
    clipcatLogo: '/brand/clipcat-logo.png',
    clipcatLogoSmall: '/brand/clipcat-logo-small.png',
    clipcatMascot: '/brand/clipcat-mascot.png',
    clipcatIcon: '/brand/clipcat-icon.png',
    clipcatFavicon: '/brand/clipcat-favicon.png',
    faviconIco: '/brand/favicon.ico',
  },
};
