import type { Clip, ClipStatus } from '../types/clip';
import type { Project, ProjectStatus } from '../types/project';

export type ProjectSortOption = 'newest' | 'oldest' | 'name_asc' | 'most_clips';
export type ClipSortOption = 'highest_score' | 'shortest' | 'longest' | 'newest';
export type ClipFilterOption = 'all' | ClipStatus;

export function filterAndSortProjects(
  projects: Project[],
  options: {
    searchQuery: string;
    statusFilter: 'all' | ProjectStatus;
    sortBy: ProjectSortOption;
  }
): Project[] {
  const query = options.searchQuery.trim().toLowerCase();

  const filtered = projects.filter((project) => {
    const matchesStatus =
      options.statusFilter === 'all' || project.status === options.statusFilter;
    const matchesQuery =
      !query ||
      project.name.toLowerCase().includes(query) ||
      project.sourceFilename.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  return [...filtered].sort((a, b) => {
    switch (options.sortBy) {
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'most_clips':
        return b.clipCount - a.clipCount;
      case 'newest':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });
}

export function filterAndSortClips(
  clips: Clip[],
  options: {
    searchQuery?: string;
    statusFilter: ClipFilterOption;
    sortBy: ClipSortOption;
  }
): Clip[] {
  const query = (options.searchQuery ?? '').trim().toLowerCase();

  const filtered = clips.filter((clip) => {
    const matchesStatus =
      options.statusFilter === 'all' || clip.status === options.statusFilter;
    const matchesQuery =
      !query ||
      clip.title.toLowerCase().includes(query) ||
      clip.description.toLowerCase().includes(query) ||
      (clip.projectName ?? '').toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  return [...filtered].sort((a, b) => {
    switch (options.sortBy) {
      case 'shortest':
        return a.durationSec - b.durationSec;
      case 'longest':
        return b.durationSec - a.durationSec;
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'highest_score':
      default:
        return b.aiScore - a.aiScore;
    }
  });
}

export interface ClipCollectionSummary {
  totalClips: number;
  averageDurationSec: number;
  bestScoringClip: Clip | null;
}

export function calculateClipSummary(clips: Clip[]): ClipCollectionSummary {
  if (clips.length === 0) {
    return {
      totalClips: 0,
      averageDurationSec: 0,
      bestScoringClip: null,
    };
  }

  const totalDuration = clips.reduce((sum, clip) => sum + clip.durationSec, 0);
  const bestClip = clips.reduce((best, current) =>
    current.aiScore > best.aiScore ? current : best
  );

  return {
    totalClips: clips.length,
    averageDurationSec: totalDuration / clips.length,
    bestScoringClip: bestClip,
  };
}
