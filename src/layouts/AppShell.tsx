import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { setRuntimeMockMode } from '../api/client';
import {
  Activity,
  Bell,
  Captions,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  LayoutTemplate,
  Menu,
  PlusSquare,
  Settings,
  X,
} from 'lucide-react';
import { ClipCatLogo } from '../components/brand/ClipCatLogo';
import { SdpLogo } from '../components/brand/SdpLogo';
import { Footer } from '../components/layout/Footer';
import { MobileBottomNav } from '../components/navigation/MobileBottomNav';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { ToastContainer } from '../components/ui/ToastContainer';
import { BRAND } from '../config/brand';
import { getApiBaseUrl } from '../config/env';
import { useSystemHealthQuery, useSystemStorageQuery } from '../hooks/useClipCatQueries';
import { useSwipeNavigation } from '../hooks/useMobileGestures';
import { useUiStore } from '../stores/uiStore';
import { cn } from '../utils/cn';
import { getRuntimeEnvironmentLabel } from '../utils/desktop';
import { formatBytes } from '../utils/format';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

const workspaceNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, end: true },
  { to: '/projects/new', label: 'New Project', icon: <PlusSquare className="w-4 h-4" /> },
  { to: '/projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4" />, end: true },
  { to: '/clips', label: 'Clip Library', icon: <Film className="w-4 h-4" />, end: true },
  { to: '/exports', label: 'Exports', icon: <Download className="w-4 h-4" /> },
];

const creativeNav: NavItem[] = [
  { to: '/presets', label: 'Caption Presets', icon: <Captions className="w-4 h-4" /> },
  { to: '/templates', label: 'Templates', icon: <LayoutTemplate className="w-4 h-4" /> },
];

const systemNav: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  { to: '/system', label: 'System Status', icon: <Activity className="w-4 h-4" /> },
];

function getPageHeaderMeta(pathname: string): {
  title: string;
  breadcrumbs: Array<{ label: string; to?: string }>;
} {
  if (pathname === '/') {
    return { title: 'Dashboard', breadcrumbs: [{ label: 'Workspace' }, { label: 'Dashboard' }] };
  }
  if (pathname === '/projects/new') {
    return {
      title: 'New Project',
      breadcrumbs: [
        { label: 'Workspace', to: '/' },
        { label: 'Projects', to: '/projects' },
        { label: 'New Project' },
      ],
    };
  }
  if (pathname === '/projects') {
    return {
      title: 'Projects',
      breadcrumbs: [{ label: 'Workspace', to: '/' }, { label: 'Projects' }],
    };
  }
  if (pathname.includes('/processing')) {
    return {
      title: 'AI Processing',
      breadcrumbs: [
        { label: 'Workspace', to: '/' },
        { label: 'Projects', to: '/projects' },
        { label: 'Processing' },
      ],
    };
  }
  if (pathname.startsWith('/projects/') && pathname.endsWith('/clips')) {
    return {
      title: 'Clip Discovery',
      breadcrumbs: [
        { label: 'Workspace', to: '/' },
        { label: 'Projects', to: '/projects' },
        { label: 'Generated Clips' },
      ],
    };
  }
  if (pathname === '/clips') {
    return {
      title: 'Clip Library',
      breadcrumbs: [{ label: 'Workspace', to: '/' }, { label: 'Clip Library' }],
    };
  }
  if (pathname.startsWith('/clips/') && pathname.endsWith('/edit')) {
    return {
      title: 'Clip Editor',
      breadcrumbs: [
        { label: 'Workspace', to: '/' },
        { label: 'Clip Library', to: '/clips' },
        { label: 'Editor' },
      ],
    };
  }
  if (pathname === '/exports') {
    return {
      title: 'Export Manager',
      breadcrumbs: [{ label: 'Workspace', to: '/' }, { label: 'Exports' }],
    };
  }
  if (pathname === '/presets') {
    return {
      title: 'Caption Presets',
      breadcrumbs: [{ label: 'Creative' }, { label: 'Caption Presets' }],
    };
  }
  if (pathname === '/templates') {
    return {
      title: 'Workflow Templates',
      breadcrumbs: [{ label: 'Creative' }, { label: 'Templates' }],
    };
  }
  if (pathname === '/settings') {
    return {
      title: 'Settings',
      breadcrumbs: [{ label: 'System' }, { label: 'Settings' }],
    };
  }
  if (pathname === '/system') {
    return {
      title: 'System Status',
      breadcrumbs: [{ label: 'System' }, { label: 'System Status' }],
    };
  }
  return { title: 'ClipCat', breadcrumbs: [{ label: 'Studio' }] };
}

export function AppShell() {
  const location = useLocation();
  const {
    sidebarCollapsed,
    toggleSidebar,
    mobileNavOpen,
    setMobileNavOpen,
    mockModeEnabled,
    setMockModeEnabled,
    themeMode,
    notifications,
    markAllNotificationsRead,
    clearNotifications,
  } = useUiStore();

  const [notifOpen, setNotifOpen] = useState(false);
  const queryClient = useQueryClient();
  const prevMockRef = useRef(mockModeEnabled);
  const { bind: bindSwipe, dragOffsetX, isSwiping, canSwipe } = useSwipeNavigation();

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (isDark: boolean) => {
      root.classList.toggle('dark', isDark);
    };
    if (themeMode === 'dark') {
      applyTheme(true);
      return;
    }
    if (themeMode === 'light') {
      applyTheme(false);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(mq.matches);
    const onChange = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [themeMode]);

  useEffect(() => {
    setRuntimeMockMode(mockModeEnabled);
    if (prevMockRef.current !== mockModeEnabled) {
      prevMockRef.current = mockModeEnabled;
      queryClient.invalidateQueries();
    }
  }, [mockModeEnabled, queryClient]);

  const healthQuery = useSystemHealthQuery();
  const storageQuery = useSystemStorageQuery();

  useEffect(() => {
    setMobileNavOpen(false);
    setNotifOpen(false);
  }, [location.pathname, setMobileNavOpen]);

  const pageMeta = getPageHeaderMeta(location.pathname);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeJobsCount = healthQuery.data?.activeJobsCount ?? 0;

  useEffect(() => {
    document.title = `${pageMeta.title} — ClipCat`;
  }, [pageMeta.title]);

  const renderNavSection = (heading: string, items: NavItem[], inDrawer = false) => (
    <div className="space-y-1">
      {inDrawer ? (
        <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-ios-tertiary-label">
          {heading}
        </p>
      ) : (
        !sidebarCollapsed && (
          <p className="hidden lg:block px-3 pb-1 text-[11px] font-semibold tracking-wider text-ios-tertiary-label">
            {heading}
          </p>
        )
      )}
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          title={!inDrawer ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 whitespace-nowrap',
              !inDrawer && 'justify-center px-2 lg:justify-start lg:px-3',
              !inDrawer && sidebarCollapsed && 'lg:justify-center lg:px-2',
              isActive
                ? 'bg-[var(--ios-blue-tint)] text-ios-blue border border-[var(--ios-blue-border)]'
                : 'text-ios-secondary hover:text-ios-label hover:bg-ios-tertiary border border-transparent'
            )
          }
        >
          <span className="shrink-0" aria-hidden="true">
            {item.icon}
          </span>
          {inDrawer ? (
            <span className="truncate">{item.label}</span>
          ) : (
            !sidebarCollapsed && <span className="hidden lg:inline truncate">{item.label}</span>
          )}
        </NavLink>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-ios-bg text-ios-label flex overflow-x-hidden">
      {/* Responsive Desktop & Tablet Sidebar (hidden below 640px) */}
      <aside
        aria-label="Primary navigation"
        className={cn(
          'hidden sm:flex flex-col shrink-0 bg-ios-surface border-r border-ios-sep transition-all duration-200 sticky top-0 h-screen',
          sidebarCollapsed ? 'w-[72px]' : 'w-[72px] lg:w-[248px]'
        )}
      >
        <div
          className={cn(
            'h-16 flex items-center border-b border-ios-sep px-3 lg:px-4 justify-center',
            !sidebarCollapsed && 'lg:justify-between'
          )}
        >
          <Link to="/" aria-label="ClipCat Home" className="min-w-0 flex items-center">
            <span className="lg:hidden">
              <ClipCatLogo collapsed />
            </span>
            <span className="hidden lg:inline-flex">
              <ClipCatLogo
                collapsed={sidebarCollapsed}
                showSubtitle={!sidebarCollapsed}
                showSdpAttribution
              />
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          {renderNavSection('WORKSPACE', workspaceNav)}
          {renderNavSection('CREATIVE', creativeNav)}
          {renderNavSection('SYSTEM', systemNav)}
        </nav>

        <div className="border-t border-ios-sep p-3 space-y-2.5">
          {!sidebarCollapsed && (
            <div className="hidden lg:block px-2.5 py-2 rounded-lg bg-ios-bg border border-ios-sep text-xs space-y-1">
              <div className="flex items-center justify-between text-ios-secondary">
                <span>Local Engine</span>
                <span className="font-mono tabular-nums text-ios-label">
                  v{BRAND.version}
                </span>
              </div>
              <p className="text-[11px] text-ios-secondary truncate">
                {getRuntimeEnvironmentLabel()}
              </p>
            </div>
          )}

          {/* Subtle SDP Parent Brand Attribution in Sidebar Footer */}
          <Link
            to="/settings#about"
            title={BRAND.developedByStatement}
            className={cn(
              'flex items-center gap-2.5 px-1 lg:px-2 py-1.5 rounded-lg hover:bg-ios-tertiary/60 transition-colors justify-center',
              !sidebarCollapsed && 'lg:justify-start'
            )}
          >
            <SdpLogo size="xs" />
            {!sidebarCollapsed && (
              <div className="hidden lg:block min-w-0">
                <p className="text-[11px] font-medium text-ios-secondary">
                  {BRAND.shortAttribution}
                </p>
                <p className="text-[11px] text-ios-tertiary-label leading-snug">
                  {BRAND.parentBrandName}
                </p>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'hidden lg:flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ios-secondary hover:text-ios-label hover:bg-ios-tertiary transition-colors cursor-pointer',
              sidebarCollapsed && 'justify-center px-2'
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer (< 640px, for secondary pages) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 sm:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside
            aria-label="Mobile navigation"
            className="relative z-10 w-64 max-w-[85vw] bg-ios-surface border-r border-ios-sep flex flex-col h-full"
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-ios-sep">
              <Link to="/" aria-label="ClipCat Home" className="min-w-0 flex items-center">
                <ClipCatLogo showSubtitle showSdpAttribution />
              </Link>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-ios-secondary hover:text-ios-label hover:bg-ios-tertiary cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
              {renderNavSection('WORKSPACE', workspaceNav, true)}
              {renderNavSection('CREATIVE', creativeNav, true)}
              {renderNavSection('SYSTEM', systemNav, true)}
            </nav>
            <div className="border-t border-ios-sep p-4 flex items-center gap-2.5">
              <SdpLogo size="xs" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-ios-secondary">
                  {BRAND.shortAttribution}
                </p>
                <p className="text-[11px] text-ios-tertiary-label leading-snug">
                  {BRAND.parentBrandName}
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Column (global mobile bottom nav + safe-area inset clearance) */}
      <div className="flex-1 min-w-0 flex flex-col pb-mobile-nav-safe">
        {/* Explicit Mock Mode Notice (never silent) */}
        {mockModeEnabled && (
          <div
            role="status"
            className="bg-ios-surface border-b border-[var(--ios-orange-border)] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <span className="text-ios-label">
              <strong className="text-ios-orange">Mock Adapter Active:</strong> Displaying isolated sample data for frontend inspection. Not connected to live FastAPI processing.
            </span>
            <button
              type="button"
              onClick={() => setMockModeEnabled(false)}
              className="px-2.5 py-1.5 min-h-[36px] rounded-md bg-ios-tertiary text-ios-label border border-ios-sep hover:border-ios-blue transition-colors cursor-pointer whitespace-nowrap"
            >
              Use Live Backend ({getApiBaseUrl()})
            </button>
          </div>
        )}

        {/* Top Header */}
        <header className="h-16 bg-ios-surface/95 backdrop-blur-md border-b border-ios-sep px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="sm:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-ios-secondary hover:text-ios-label hover:bg-ios-tertiary cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              to="/"
              aria-label="ClipCat Home"
              className="sm:hidden flex items-center shrink-0"
            >
              <ClipCatLogo size="xs" variant="mascot" />
            </Link>
            <span
              className="sm:hidden h-5 w-px bg-ios-sep shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-ios-secondary">
                {pageMeta.breadcrumbs.map((crumb, idx) => (
                  <span key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5">
                    {idx > 0 && <span aria-hidden="true">/</span>}
                    {crumb.to ? (
                      <Link to={crumb.to} className="hover:text-ios-label transition-colors">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-ios-label">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
              <h1 className="font-display text-sm sm:text-lg font-bold text-ios-label truncate">
                {pageMeta.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-5 shrink-0">
            {/* Processing Status Indicator */}
            <Link
              to="/system"
              className="hidden md:flex items-center gap-2 text-xs text-ios-secondary hover:text-ios-label transition-colors whitespace-nowrap"
              title="View backend and processing status"
            >
              {healthQuery.isError ? (
                <StatusIndicator status="unavailable" customLabel="Backend Offline" />
              ) : activeJobsCount > 0 ? (
                <StatusIndicator
                  status="processing"
                  customLabel={`${activeJobsCount} Job${activeJobsCount > 1 ? 's' : ''} Running`}
                />
              ) : healthQuery.data ? (
                <StatusIndicator status="operational" customLabel="Backend Ready" />
              ) : (
                <StatusIndicator status="waiting" customLabel="Checking Backend" />
              )}
            </Link>

            {/* Storage Usage Indicator */}
            <Link
              to="/settings"
              className="hidden xl:flex items-center gap-1.5 text-xs text-ios-secondary hover:text-ios-label transition-colors whitespace-nowrap tabular-nums"
              title="Local studio storage usage"
            >
              <HardDrive className="w-3.5 h-3.5 text-ios-blue" aria-hidden="true" />
              <span>
                {storageQuery.data
                  ? `${formatBytes(storageQuery.data.totalUsedBytes)} used`
                  : 'Storage: —'}
              </span>
            </Link>

            {/* Notification Popover Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                className="relative min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 rounded-lg text-ios-secondary hover:text-ios-label hover:bg-ios-tertiary transition-colors cursor-pointer flex items-center justify-center"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 sm:top-1.5 sm:right-1.5 w-2 h-2 rounded-full bg-ios-orange-fill" />
                )}
              </button>

              {notifOpen && (
                <div
                  role="region"
                  aria-label="Notification center"
                  className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-ios-elevated border border-ios-sep shadow-2xl overflow-hidden z-50"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-ios-sep">
                    <span className="text-xs font-semibold text-ios-label">
                      Notifications ({notifications.length})
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      {notifications.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={markAllNotificationsRead}
                            className="text-ios-blue hover:underline cursor-pointer"
                          >
                            Mark read
                          </button>
                          <button
                            type="button"
                            onClick={clearNotifications}
                            className="text-ios-secondary hover:text-ios-label cursor-pointer"
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-ios-sep">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-xs text-center text-ios-secondary">
                        No notifications yet. Processing completions and backend alerts appear here.
                      </p>
                    ) : (
                      notifications.map((item) => (
                        <div key={item.id} className="px-4 py-3 text-xs space-y-1">
                          <p className="font-medium text-ios-label">{item.title}</p>
                          <p className="text-ios-secondary leading-relaxed">{item.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Settings Shortcut */}
            <Link
              to="/settings"
              aria-label="Open Settings"
              title="Settings"
              className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 rounded-lg text-ios-secondary hover:text-ios-label hover:bg-ios-tertiary transition-colors flex items-center justify-center"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <div
          {...bindSwipe()}
          className={cn('flex-1 flex flex-col min-w-0', canSwipe && 'touch-pan-y')}
        >
          <motion.main
            animate={dragOffsetX !== 0 ? { x: dragOffsetX } : { x: 0 }}
            transition={
              isSwiping
                ? { duration: 0 }
                : { type: 'spring', stiffness: 420, damping: 36, mass: 0.6 }
            }
            className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto min-w-0"
          >
            <Outlet />
          </motion.main>
        </div>

        <Footer />
      </div>

      {/* Fixed Mobile Bottom Navigation (< 640px) */}
      <MobileBottomNav />

      <ToastContainer />
    </div>
  );
}
