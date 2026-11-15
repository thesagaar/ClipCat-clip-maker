import { BRAND } from '../../config/brand';

export interface FooterLinkItem {
  label: string;
  to?: string;
  href?: string;
}

export const WORKSPACE_LINKS: FooterLinkItem[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'Create New Project', to: '/projects/new' },
  { label: 'All Projects', to: '/projects' },
  { label: 'Clip Library', to: '/clips' },
  { label: 'Export Manager', to: '/exports' },
];

export const STUDIO_LINKS: FooterLinkItem[] = [
  { label: 'Caption Presets', to: '/presets' },
  { label: 'Workflow Templates', to: '/templates' },
  { label: 'Application Settings', to: '/settings' },
  { label: 'System Status & Diagnostics', to: '/system' },
];

export const SDP_LINKS: FooterLinkItem[] = [
  { label: 'Official Website', href: BRAND.website },
  { label: 'Contact & Support', href: BRAND.supportUrl },
  { label: 'About ClipCat', to: '/settings#about' },
  { label: 'Privacy Policy', to: BRAND.privacyRoute },
  { label: 'Terms & Conditions', to: BRAND.termsRoute },
];
