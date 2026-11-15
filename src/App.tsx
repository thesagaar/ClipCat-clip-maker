import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Skeleton } from './components/ui/Skeleton';
import { AppShell } from './layouts/AppShell';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const NewProjectPage = lazy(() =>
  import('./pages/NewProjectPage').then((m) => ({ default: m.NewProjectPage }))
);
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage }))
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
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects/new" element={<NewProjectPage />} />
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
