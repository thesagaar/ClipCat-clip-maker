import { Link } from 'react-router-dom';
import { FolderKanban, Home, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { BRAND } from '../config/brand';

export function NotFoundPage() {
  return (
    <section
      aria-labelledby="not-found-heading"
      className="min-h-[60vh] flex items-center justify-center py-8"
    >
      <div className="w-full max-w-lg rounded-2xl bg-ios-surface border border-ios-sep p-6 sm:p-10 text-center space-y-6">
        <div className="w-24 h-20 mx-auto rounded-2xl bg-[#30194E]/35 border border-[#7040DC]/40 flex items-center justify-center p-2 overflow-hidden">
          <OptimizedImage
            src={BRAND.assets.clipcatMascot}
            webpSrc={BRAND.assets.clipcatMascotWebp}
            alt="ClipCat mascot"
            width={88}
            height={63}
            loading="eager"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#C8B9F1]">
            Error 404
          </p>
          <h2
            id="not-found-heading"
            className="font-display text-2xl sm:text-3xl font-extrabold text-ios-label"
          >
            This clip cut wasn&apos;t found
          </h2>
          <p className="text-sm text-ios-secondary leading-relaxed">
            The page or workspace route you requested does not exist or may have moved. Use one of the verified studio destinations below.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
          <Link to="/" className="w-full sm:w-auto">
            <Button
              variant="accent-purple"
              size="lg"
              className="w-full"
              icon={<Home className="w-4 h-4" />}
            >
              Return to Dashboard
            </Button>
          </Link>
          <Link to="/projects" className="w-full sm:w-auto">
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              icon={<FolderKanban className="w-4 h-4" />}
            >
              View Projects
            </Button>
          </Link>
          <Link to="/projects/new" className="w-full sm:w-auto">
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              icon={<Plus className="w-4 h-4" />}
            >
              New Project
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-ios-tertiary-label pt-2 border-t border-ios-sep">
          {BRAND.productIdentity}
        </p>
      </div>
    </section>
  );
}
