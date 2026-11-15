import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ExternalLink, ShieldCheck } from 'lucide-react';
import { SdpLogo } from '../brand/SdpLogo';
import { BRAND } from '../../config/brand';
import { getPlatformDisplayLabel } from '../../utils/desktop';
import { cn } from '../../utils/cn';

interface FooterLinkItem {
  label: string;
  to?: string;
  href?: string;
}

const WORKSPACE_LINKS: FooterLinkItem[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'Create New Project', to: '/projects/new' },
  { label: 'All Projects', to: '/projects' },
  { label: 'Clip Library', to: '/clips' },
  { label: 'Export Manager', to: '/exports' },
];

const STUDIO_LINKS: FooterLinkItem[] = [
  { label: 'Caption Presets', to: '/presets' },
  { label: 'Workflow Templates', to: '/templates' },
  { label: 'Application Settings', to: '/settings' },
  { label: 'System Status & Diagnostics', to: '/system' },
];

const SDP_LINKS: FooterLinkItem[] = [
  { label: 'Official Website', href: BRAND.website },
  { label: 'Contact & Support', href: BRAND.supportUrl },
  { label: 'About ClipCat', to: '/settings#about' },
  { label: 'Privacy & Data Handling', to: '/settings#privacy' },
];

function FooterNavLink({ item }: { item: FooterLinkItem }) {
  const linkClass =
    'inline-flex items-center gap-1.5 text-sm sm:text-xs text-ios-secondary hover:text-ios-label focus-visible:text-ios-label transition-colors rounded-md min-h-[44px] sm:min-h-[28px] py-1.5 sm:py-0.5';

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        <span className="truncate">{item.label}</span>
        <ExternalLink className="w-3.5 h-3.5 sm:w-3 sm:h-3 shrink-0 text-[#C8B9F1]" aria-hidden="true" />
      </a>
    );
  }

  return (
    <Link to={item.to ?? '/'} className={linkClass}>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Footer() {
  const [studioOpen, setStudioOpen] = useState(false);
  const [sdpOpen, setSdpOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const platformLabel = getPlatformDisplayLabel();

  return (
    <footer
      aria-label="ClipCat studio footer"
      className="border-t border-ios-sep bg-ios-surface/60 px-4 sm:px-6 lg:px-8 pt-7 sm:pt-9 pb-7 sm:pb-8 w-full"
    >
      <div className="max-w-[1280px] mx-auto space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
          {/* Brand Section */}
          <div className="lg:col-span-4 space-y-4">
            <div className="space-y-2">
              {/* Row 1: ClipCat logo + product name on left, SDP logo aligned right */}
              <div className="flex items-center justify-between gap-3">
                <Link
                  to="/"
                  aria-label="ClipCat Home"
                  className="flex items-center gap-3 min-w-0 group"
                >
                  {!logoError ? (
                    <img
                      src={BRAND.assets.clipcatLogoSmall}
                      alt="ClipCat mascot logo"
                      width={48}
                      height={48}
                      onError={() => setLogoError(true)}
                      className="w-12 h-12 object-contain shrink-0 rounded-xl transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#30194E] border border-[#7040DC]/50 flex items-center justify-center shrink-0 text-xs font-bold text-white">
                      CC
                    </div>
                  )}
                  <span className="font-display text-lg font-extrabold text-ios-label tracking-tight leading-none">
                    {BRAND.productName}
                  </span>
                </Link>

                <Link
                  to="/settings#about"
                  aria-label={BRAND.parentBrandName}
                  title={BRAND.developedByStatement}
                  className="shrink-0 rounded-xl p-1 hover:bg-ios-tertiary/60 transition-colors"
                >
                  <SdpLogo size="sm" />
                </Link>
              </div>

              {/* Row 2: Unobstructed full-width attribution (never truncated) */}
              <p className="text-[13.5px] sm:text-sm font-normal leading-[1.4] text-ios-secondary">
                A product by {BRAND.parentBrandName}
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-display text-lg sm:text-xl font-extrabold text-ios-label leading-snug text-balance">
                {BRAND.productTagline}
              </p>
              <p className="text-xs sm:text-sm text-ios-secondary leading-relaxed max-w-md">
                Local-first AI video clipping, transcription, smart framing, and caption rendering.
              </p>
            </div>
          </div>

          {/* Navigation Columns */}
          <nav
            aria-label="Footer navigation"
            className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 border-t border-ios-sep pt-6 lg:border-t-0 lg:pt-0"
          >
            {/* Primary Workspace Group: 2-col compact grid on mobile, vertical column on tablet/desktop */}
            <div className="space-y-2.5">
              <h3 className="font-display text-sm sm:text-xs font-bold sm:uppercase sm:tracking-wider text-ios-label sm:text-ios-tertiary-label">
                Workspace
              </h3>
              <ul className="grid grid-cols-2 sm:grid-cols-1 gap-x-4 gap-y-0.5 sm:space-y-1">
                {WORKSPACE_LINKS.map((item) => (
                  <li key={item.label} className="min-w-0">
                    <FooterNavLink item={item} />
                  </li>
                ))}
              </ul>
            </div>

            {/* Studio & System: Accessible accordion on mobile (< 640px), always expanded >= 640px */}
            <div className="border-t border-ios-sep pt-4 sm:border-t-0 sm:pt-0 sm:space-y-2.5">
              <button
                type="button"
                aria-expanded={studioOpen}
                aria-controls="footer-studio-links"
                onClick={() => setStudioOpen((prev) => !prev)}
                className="sm:hidden w-full min-h-[44px] flex items-center justify-between text-left font-display text-sm font-bold text-ios-label cursor-pointer"
              >
                <span>Studio &amp; System</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-ios-secondary transition-transform duration-200',
                    studioOpen && 'rotate-180 text-[#C8B9F1]'
                  )}
                  aria-hidden="true"
                />
              </button>
              <h3 className="hidden sm:block text-xs font-semibold uppercase tracking-wider text-ios-tertiary-label">
                Studio &amp; System
              </h3>
              <ul
                id="footer-studio-links"
                className={cn(
                  'space-y-0.5 sm:space-y-1 sm:block',
                  studioOpen ? 'block pt-1' : 'hidden'
                )}
              >
                {STUDIO_LINKS.map((item) => (
                  <li key={item.label} className="min-w-0">
                    <FooterNavLink item={item} />
                  </li>
                ))}
              </ul>
            </div>

            {/* Single Dimension Projects: Accessible accordion on mobile (< 640px), always expanded >= 640px */}
            <div className="border-t border-ios-sep pt-4 sm:border-t-0 sm:pt-0 sm:space-y-2.5">
              <button
                type="button"
                aria-expanded={sdpOpen}
                aria-controls="footer-sdp-links"
                onClick={() => setSdpOpen((prev) => !prev)}
                className="sm:hidden w-full min-h-[44px] flex items-center justify-between text-left font-display text-sm font-bold text-ios-label cursor-pointer"
              >
                <span>{BRAND.parentBrandName}</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-ios-secondary transition-transform duration-200',
                    sdpOpen && 'rotate-180 text-[#C8B9F1]'
                  )}
                  aria-hidden="true"
                />
              </button>
              <h3 className="hidden sm:block text-xs font-semibold uppercase tracking-wider text-ios-tertiary-label">
                {BRAND.parentBrandName}
              </h3>
              <ul
                id="footer-sdp-links"
                className={cn(
                  'space-y-0.5 sm:space-y-1 sm:block',
                  sdpOpen ? 'block pt-1' : 'hidden'
                )}
              >
                {SDP_LINKS.map((item) => (
                  <li key={item.label} className="min-w-0">
                    <FooterNavLink item={item} />
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        {/* Legal & Runtime Metadata Bottom Row */}
        <div className="pt-5 border-t border-ios-sep flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-ios-secondary">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-x-3 gap-y-1">
              <p className="text-ios-label font-medium">{BRAND.copyrightStatement}</p>
              <span className="sm:hidden font-mono tabular-nums text-[11px] text-ios-tertiary-label">
                v{BRAND.version} · {platformLabel}
              </span>
            </div>
            <p className="text-[11px] text-ios-tertiary-label">
              {BRAND.footerAttribution}
            </p>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-ios-green font-medium">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Local-first · Zero analytics or telemetry collected</span>
            </p>
          </div>

          <p className="hidden sm:block font-mono tabular-nums text-[11px] text-ios-tertiary-label shrink-0">
            ClipCat v{BRAND.version} · {platformLabel}
          </p>
        </div>
      </div>
    </footer>
  );
}
