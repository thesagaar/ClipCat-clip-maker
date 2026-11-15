import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Edit2,
  Film,
  FolderKanban,
  Grid,
  List,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { batchExportClips, getProjectClips } from '../api';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import {
  useDeleteProjectMutation,
  useProjectsQuery,
  useRenameProjectMutation,
} from '../hooks/useClipCatQueries';
import { useUiStore } from '../stores/uiStore';
import type { Project, ProjectStatus } from '../types/project';
import { triggerVerifiedDownload } from '../utils/desktop';
import { filterAndSortProjects, type ProjectSortOption } from '../utils/filters';
import { formatDateShort, formatDuration } from '../utils/format';

export function ProjectsPage() {
  const projectsQuery = useProjectsQuery();
  const renameMutation = useRenameProjectMutation();
  const deleteMutation = useDeleteProjectMutation();
  const { projectViewMode, setProjectViewMode, addToast } = useUiStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [sortBy, setSortBy] = useState<ProjectSortOption>('newest');

  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const projects = projectsQuery.data ?? [];
  const filteredProjects = useMemo(
    () =>
      filterAndSortProjects(projects, {
        searchQuery,
        statusFilter,
        sortBy,
      }),
    [projects, searchQuery, statusFilter, sortBy]
  );

  const handleOpenRename = (project: Project) => {
    setProjectToRename(project);
    setRenameValue(project.name);
  };

  const handleSaveRename = async () => {
    if (!projectToRename || !renameValue.trim()) return;
    try {
      await renameMutation.mutateAsync({
        projectId: projectToRename.id,
        name: renameValue.trim(),
      });
      addToast({
        variant: 'success',
        title: 'Project Renamed',
        description: `Updated project name to "${renameValue.trim()}".`,
      });
      setProjectToRename(null);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Rename Failed',
        description: err instanceof Error ? err.message : 'Unable to rename project.',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteMutation.mutateAsync(projectToDelete.id);
      addToast({
        variant: 'info',
        title: 'Project Deleted',
        description: `"${projectToDelete.name}" removed.`,
      });
      setProjectToDelete(null);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Unable to delete project.',
      });
    }
  };

  const handleExportAllForProject = async (project: Project) => {
    try {
      const projectClips = await getProjectClips(project.id);
      if (projectClips.length === 0) {
        addToast({
          variant: 'info',
          title: 'No Clips Yet',
          description: `"${project.name}" does not have any rendered clips to export yet.`,
        });
        return;
      }
      const resp = await batchExportClips({
        clipIds: projectClips.map((c) => c.id),
        formats: ['mp4', 'srt'],
      });
      if (resp.archiveUrl) {
        await triggerVerifiedDownload(resp.archiveUrl, `${project.name}.zip`);
      } else {
        addToast({
          variant: 'info',
          title: 'Export All',
          description: resp.message,
        });
      }
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Could not export project clips.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-ios-label">
            Project Library
          </h2>
          <p className="text-sm text-ios-secondary mt-1">
            Manage long-form video projects, processing runs, and generated clips.
          </p>
        </div>
        <Link to="/projects/new" className="shrink-0">
          <Button icon={<Plus className="w-4 h-4" />}>New Project</Button>
        </Link>
      </div>

      {projectsQuery.isError && (
        <ErrorState error={projectsQuery.error} onRetry={() => projectsQuery.refetch()} />
      )}

      {/* Search, Filter, Sort & View Mode Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative w-full min-w-0 lg:flex-1 lg:max-w-md">
          <Search
            className="w-4 h-4 text-ios-tertiary-label absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search projects"
            placeholder="Search projects"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg bg-ios-surface border border-ios-sep pl-9 pr-3 text-sm text-ios-label placeholder:text-ios-tertiary-label focus:border-ios-blue focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter projects by status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | ProjectStatus)
              }
              options={[
                { value: 'all', label: 'Status: All' },
                { value: 'completed', label: 'Completed' },
                { value: 'processing', label: 'Processing' },
                { value: 'queued', label: 'Queued' },
                { value: 'failed', label: 'Failed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              aria-label="Sort projects"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ProjectSortOption)}
              options={[
                { value: 'newest', label: 'Sort: Newest' },
                { value: 'oldest', label: 'Sort: Oldest' },
                { value: 'name_asc', label: 'Sort: Name A–Z' },
                { value: 'most_clips', label: 'Sort: Most Clips' },
              ]}
            />
          </div>

          <div
            role="group"
            aria-label="Project layout view"
            className="inline-flex items-center p-1 rounded-lg bg-ios-surface border border-ios-sep shrink-0"
          >
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={projectViewMode === 'grid'}
              onClick={() => setProjectViewMode('grid')}
              className={`p-1.5 rounded-md cursor-pointer ${
                projectViewMode === 'grid'
                  ? 'bg-ios-blue-fill text-white'
                  : 'text-ios-secondary hover:text-ios-label'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              aria-pressed={projectViewMode === 'list'}
              onClick={() => setProjectViewMode('list')}
              className={`p-1.5 rounded-md cursor-pointer ${
                projectViewMode === 'list'
                  ? 'bg-ios-blue-fill text-white'
                  : 'text-ios-secondary hover:text-ios-label'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {projectsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-6 h-6" />}
          title="No projects found"
          description="Create a new project or adjust your search and status filters."
          action={
            <Link to="/projects/new">
              <Button icon={<Plus className="w-4 h-4" />}>Create Project</Button>
            </Link>
          }
        />
      ) : projectViewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <article
              key={project.id}
              className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep overflow-hidden flex flex-col justify-between"
            >
              <div className="aspect-video bg-ios-bg border-b border-ios-sep relative flex items-center justify-center overflow-hidden">
                {project.thumbnailUrl ? (
                  <img
                    src={project.thumbnailUrl}
                    alt={project.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-ios-secondary px-4 max-w-full">
                    <Film className="w-8 h-8" />
                    <span className="text-xs font-mono truncate max-w-full">
                      {project.sourceFilename}
                    </span>
                  </div>
                )}
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[11px] font-mono tabular-nums text-white">
                  {formatDuration(project.durationSec)}
                </span>
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between min-w-0">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusIndicator status={project.status} />
                    <span className="text-xs text-ios-secondary tabular-nums">
                      {formatDateShort(project.createdAt)}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-ios-label line-clamp-1">
                    {project.name}
                  </h3>
                  <p className="text-xs text-ios-secondary truncate">
                    {project.sourceFilename} · {project.clipCount} clips
                  </p>
                </div>

                <div className="pt-3 border-t border-ios-sep flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={
                      project.status === 'processing' || project.status === 'queued'
                        ? `/projects/${project.id}/processing`
                        : `/projects/${project.id}/clips`
                    }
                  >
                    <Button variant="secondary" size="sm">
                      Open
                    </Button>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Rename ${project.name}`}
                      icon={<Edit2 className="w-3.5 h-3.5" />}
                      onClick={() => handleOpenRename(project)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Export all clips for ${project.name}`}
                      icon={<Download className="w-3.5 h-3.5" />}
                      onClick={() => handleExportAllForProject(project)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${project.name}`}
                      icon={<Trash2 className="w-3.5 h-3.5 text-ios-red" />}
                      onClick={() => setProjectToDelete(project)}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="w-full min-w-0 rounded-xl bg-ios-surface border border-ios-sep overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ios-sep text-xs text-ios-secondary">
              <tr>
                <th className="py-3 px-4 font-medium">Project</th>
                <th className="hidden md:table-cell py-3 px-4 font-medium">Source Video</th>
                <th className="hidden sm:table-cell py-3 px-4 font-medium">Duration</th>
                <th className="hidden lg:table-cell py-3 px-4 font-medium">Clips</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="hidden md:table-cell py-3 px-4 font-medium">Created</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ios-sep">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-ios-tertiary/50">
                  <td className="py-3 px-4 font-medium text-ios-label max-w-[160px] sm:max-w-none truncate">
                    {project.name}
                  </td>
                  <td className="hidden md:table-cell py-3 px-4 text-xs font-mono text-ios-secondary max-w-[200px] truncate">
                    {project.sourceFilename}
                  </td>
                  <td className="hidden sm:table-cell py-3 px-4 text-xs font-mono tabular-nums text-ios-label">
                    {formatDuration(project.durationSec)}
                  </td>
                  <td className="hidden lg:table-cell py-3 px-4 text-xs font-mono tabular-nums text-ios-label">
                    {project.clipCount}
                  </td>
                  <td className="py-3 px-4">
                    <StatusIndicator status={project.status} />
                  </td>
                  <td className="hidden md:table-cell py-3 px-4 text-xs text-ios-secondary tabular-nums">
                    {formatDateShort(project.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        to={
                          project.status === 'processing' || project.status === 'queued'
                            ? `/projects/${project.id}/processing`
                            : `/projects/${project.id}/clips`
                        }
                      >
                        <Button variant="secondary" size="sm">
                          Open
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Rename ${project.name}`}
                        icon={<Edit2 className="w-3.5 h-3.5" />}
                        onClick={() => handleOpenRename(project)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${project.name}`}
                        icon={<Trash2 className="w-3.5 h-3.5 text-ios-red" />}
                        onClick={() => setProjectToDelete(project)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rename Modal */}
      <Modal
        open={Boolean(projectToRename)}
        onClose={() => setProjectToRename(null)}
        title="Rename Project"
        footer={
          <>
            <Button variant="secondary" onClick={() => setProjectToRename(null)}>
              Cancel
            </Button>
            <Button
              loading={renameMutation.isPending}
              disabled={!renameValue.trim()}
              onClick={handleSaveRename}
            >
              Save Name
            </Button>
          </>
        }
      >
        <Input
          label="Project Name"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${projectToDelete?.name}" and all of its generated clips? This action cannot be undone.`}
        confirmLabel="Delete Project"
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
