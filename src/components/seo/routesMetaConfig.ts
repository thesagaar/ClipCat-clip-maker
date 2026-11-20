export interface RouteMetaDefinition {
  pattern: string;
  title: string;
  description: string;
  robots: 'index, follow' | 'noindex, nofollow';
  pageGroup: string;
  breadcrumbs: Array<{ label: string; to?: string }>;
  headerTitle: string;
}

export const ROUTE_META_DEFINITIONS: readonly RouteMetaDefinition[] = [
  {
    pattern: '/',
    title: 'ClipCat — AI Video Clipping Studio',
    description:
      'Long videos. Short attention. Perfect clips. Local-first AI video clipping, transcription, smart framing, and caption rendering by Single Dimension Projects.',
    robots: 'index, follow',
    pageGroup: 'dashboard',
    headerTitle: 'Dashboard',
    breadcrumbs: [{ label: 'Workspace' }, { label: 'Dashboard' }],
  },
  {
    pattern: '/privacy',
    title: 'Privacy Policy — ClipCat',
    description:
      'How ClipCat handles local video processing, browser storage, optional product analytics, sanitized error diagnostics, and user privacy controls.',
    robots: 'index, follow',
    pageGroup: 'legal_privacy',
    headerTitle: 'Privacy Policy',
    breadcrumbs: [{ label: 'Legal', to: '/' }, { label: 'Privacy Policy' }],
  },
  {
    pattern: '/terms',
    title: 'Terms and Conditions — ClipCat',
    description:
      'Usage terms, content ownership responsibilities, local processing disclaimers, and technical limitations for ClipCat by Single Dimension Projects.',
    robots: 'index, follow',
    pageGroup: 'legal_terms',
    headerTitle: 'Terms & Conditions',
    breadcrumbs: [{ label: 'Legal', to: '/' }, { label: 'Terms & Conditions' }],
  },
  {
    pattern: '/projects/new',
    title: 'New Project — ClipCat',
    description:
      'Upload a local video or validate a direct media URL to configure AI clipping, smart framing, and captions in ClipCat.',
    robots: 'noindex, nofollow',
    pageGroup: 'project_create',
    headerTitle: 'New Project',
    breadcrumbs: [
      { label: 'Workspace', to: '/' },
      { label: 'Projects', to: '/projects' },
      { label: 'New Project' },
    ],
  },
  {
    pattern: '/chatspike',
    title: 'ChatSpike Intelligence — ClipCat',
    description: 'Detect audience reaction spikes from chat logs and automatically cut highlight video clips locally with FFmpeg.',
    robots: 'noindex, nofollow',
    pageGroup: 'chatspike',
    headerTitle: 'ChatSpike Intelligence',
    breadcrumbs: [
      { label: 'Workspace', to: '/' },
      { label: 'ChatSpike Intelligence' },
    ],
  },
  {
    pattern: '/projects',
    title: 'Projects — ClipCat',
    description: 'Manage your ClipCat video clipping projects, processing status, and generated clips.',
    robots: 'noindex, nofollow',
    pageGroup: 'projects',
    headerTitle: 'Projects',
    breadcrumbs: [{ label: 'Workspace', to: '/' }, { label: 'Projects' }],
  },
  {
    pattern: '/projects/:id/processing',
    title: 'AI Processing — ClipCat',
    description: 'Monitor real-time local AI video transcription, highlight scoring, and rendering pipeline progress.',
    robots: 'noindex, nofollow',
    pageGroup: 'processing',
    headerTitle: 'AI Processing',
    breadcrumbs: [
      { label: 'Workspace', to: '/' },
      { label: 'Projects', to: '/projects' },
      { label: 'Processing' },
    ],
  },
  {
    pattern: '/projects/:id/clips',
    title: 'Clip Discovery — ClipCat',
    description: 'Review AI-scored short video clip candidates discovered for your project.',
    robots: 'noindex, nofollow',
    pageGroup: 'clip_discovery',
    headerTitle: 'Clip Discovery',
    breadcrumbs: [
      { label: 'Workspace', to: '/' },
      { label: 'Projects', to: '/projects' },
      { label: 'Generated Clips' },
    ],
  },
  {
    pattern: '/clips',
    title: 'Clip Library — ClipCat',
    description: 'Browse, filter, preview, edit, and export generated video clips.',
    robots: 'noindex, nofollow',
    pageGroup: 'clips',
    headerTitle: 'Clip Library',
    breadcrumbs: [{ label: 'Workspace', to: '/' }, { label: 'Clip Library' }],
  },
  {
    pattern: '/clips/:id/edit',
    title: 'Clip Editor — ClipCat',
    description: 'Fine-tune clip trim timing, smart layout aspect ratio, and caption styling before export.',
    robots: 'noindex, nofollow',
    pageGroup: 'clip_editor',
    headerTitle: 'Clip Editor',
    breadcrumbs: [
      { label: 'Workspace', to: '/' },
      { label: 'Clip Library', to: '/clips' },
      { label: 'Editor' },
    ],
  },
  {
    pattern: '/exports',
    title: 'Export Manager — ClipCat',
    description: 'Download rendered MP4 videos, SRT and VTT subtitles, metadata JSON, and clip thumbnails.',
    robots: 'noindex, nofollow',
    pageGroup: 'exports',
    headerTitle: 'Export Manager',
    breadcrumbs: [{ label: 'Workspace', to: '/' }, { label: 'Exports' }],
  },
  {
    pattern: '/publish',
    title: 'Publish Clip — ClipCat',
    description: 'Publish finished ClipCat clips with auto-generated captions, metadata, and creator attribution.',
    robots: 'noindex, nofollow',
    pageGroup: 'publish',
    headerTitle: 'Direct Publishing',
    breadcrumbs: [{ label: 'Workspace', to: '/' }, { label: 'Publish' }],
  },
  {
    pattern: '/publish/:id',
    title: 'Publish Clip Studio — ClipCat',
    description: 'Review destination formatting, creator attribution, and metadata before publishing a clip.',
    robots: 'noindex, nofollow',
    pageGroup: 'publish_clip',
    headerTitle: 'Publish Clip',
    breadcrumbs: [
      { label: 'Workspace', to: '/' },
      { label: 'Clip Library', to: '/clips' },
      { label: 'Publish' },
    ],
  },
  {
    pattern: '/presets',
    title: 'Caption Presets — ClipCat',
    description: 'Customize typography, highlight colors, and caption placement presets for exported clips.',
    robots: 'noindex, nofollow',
    pageGroup: 'presets',
    headerTitle: 'Caption Presets',
    breadcrumbs: [{ label: 'Creative' }, { label: 'Caption Presets' }],
  },
  {
    pattern: '/templates',
    title: 'Workflow Templates — ClipCat',
    description: 'Manage reusable AI clipping duration, framing, and caption templates.',
    robots: 'noindex, nofollow',
    pageGroup: 'templates',
    headerTitle: 'Workflow Templates',
    breadcrumbs: [{ label: 'Creative' }, { label: 'Templates' }],
  },
  {
    pattern: '/settings',
    title: 'Settings — ClipCat',
    description: 'Configure local Whisper models, CPU thread budgets, storage paths, theme, and privacy preferences.',
    robots: 'noindex, nofollow',
    pageGroup: 'settings',
    headerTitle: 'Settings',
    breadcrumbs: [{ label: 'System' }, { label: 'Settings' }],
  },
  {
    pattern: '/system',
    title: 'System Status — ClipCat',
    description: 'Inspect FastAPI connectivity, FFmpeg, FFprobe, Whisper dependencies, and studio storage usage.',
    robots: 'noindex, nofollow',
    pageGroup: 'system',
    headerTitle: 'System Status',
    breadcrumbs: [{ label: 'System' }, { label: 'System Status' }],
  },
];

export const NOT_FOUND_ROUTE_META: RouteMetaDefinition = {
  pattern: '*',
  title: 'Page Not Found — ClipCat',
  description: 'The requested ClipCat studio page could not be found.',
  robots: 'noindex, nofollow',
  pageGroup: 'not_found',
  headerTitle: 'Page Not Found',
  breadcrumbs: [{ label: 'ClipCat', to: '/' }, { label: '404' }],
};

export function resolveRouteMeta(pathname: string): RouteMetaDefinition {
  const cleanPath = (pathname.split('?')[0] ?? '/').replace(/\/+$/, '') || '/';
  if (cleanPath === '/') return ROUTE_META_DEFINITIONS[0];

  for (const def of ROUTE_META_DEFINITIONS) {
    if (def.pattern === cleanPath) return def;
  }

  if (/^\/projects\/[^/]+\/processing$/.test(cleanPath)) {
    return ROUTE_META_DEFINITIONS.find((r) => r.pattern === '/projects/:id/processing')!;
  }
  if (/^\/projects\/[^/]+\/clips$/.test(cleanPath)) {
    return ROUTE_META_DEFINITIONS.find((r) => r.pattern === '/projects/:id/clips')!;
  }
  if (/^\/clips\/[^/]+\/edit$/.test(cleanPath)) {
    return ROUTE_META_DEFINITIONS.find((r) => r.pattern === '/clips/:id/edit')!;
  }
  if (/^\/publish\/[^/]+$/.test(cleanPath)) {
    return ROUTE_META_DEFINITIONS.find((r) => r.pattern === '/publish/:id')!;
  }

  return NOT_FOUND_ROUTE_META;
}
