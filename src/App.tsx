import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trackAnalyticsEvent } from './analytics/client';
import { registerGlobalErrorHandlers } from './analytics/errorAdapter';
import { ConsentBanner } from './components/legal/ConsentBanner';
import { RouteMeta } from './components/seo/RouteMeta';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Skeleton } from './components/ui/Skeleton';
import { AppShell } from './layouts/AppShell';
import { useUiStore } from './stores/uiStore';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const NewProjectPage = lazy(() =>
  import('./pages/NewProjectPage').then((m) => ({ default: m.NewProjectPage }))
);
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage }))
);
const ChatSpikePage = lazy(() =>
  import('./pages/ChatSpikePage').then((m) => ({ default: m.ChatSpikePage }))
);
const ProcessingPage = lazy(() =>
  import('./pages/ProcessingPage').then((m) => ({ default: m.ProcessingPage }))
);
const ClipDiscoveryPage = lazy(() =>
  import('./pages/ClipDiscoveryPage').then((m) => ({ default: m.ClipDiscoveryPage }))
);
const ClipLibraryPage = lazy(() =>
  import('./pages/ClipLibraryPage').then((m) => ({ default: m.ClipLibraryPage }))
);
const ClipEditorPage = lazy(() =>
  import('./pages/ClipEditorPage').then((m) => ({ default: m.ClipEditorPage }))
);
const ExportManagerPage = lazy(() =>
  import('./pages/ExportManagerPage').then((m) => ({ default: m.ExportManagerPage }))
);
const CaptionPresetsPage = lazy(() =>
  import('./pages/CaptionPresetsPage').then((m) => ({ default: m.CaptionPresetsPage }))
);
const TemplatesPage = lazy(() =>
  import('./pages/TemplatesPage').then((m) => ({ default: m.TemplatesPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const SystemStatusPage = lazy(() =>
  import('./pages/SystemStatusPage').then((m) => ({ default: m.SystemStatusPage }))
);
const PrivacyPolicyPage = lazy(() =>
  import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage }))
);
const TermsPage = lazy(() =>
  import('./pages/TermsPage').then((m) => ({ default: m.TermsPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoadingFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const unregister = registerGlobalErrorHandlers();
    trackAnalyticsEvent('app_opened', {
      themeMode: useUiStore.getState().themeMode,
    });
    return unregister;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <RouteMeta />
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/projects/new" element={<NewProjectPage />} />
                <Route path="/chatspike" element={<ChatSpikePage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id/processing" element={<ProcessingPage />} />
                <Route path="/projects/:id/clips" element={<ClipDiscoveryPage />} />
                <Route path="/clips" element={<ClipLibraryPage />} />
                <Route path="/clips/:id/edit" element={<ClipEditorPage />} />
                <Route path="/exports" element={<ExportManagerPage />} />
                <Route path="/presets" element={<CaptionPresetsPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/system" element={<SystemStatusPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/404" element={<NotFoundPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
          <ConsentBanner />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
