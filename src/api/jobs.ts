import type { ProcessingJob } from '../types/job';
import { apiRequest, buildApiUrl, isMockApiEnabled } from './client';
import { ApiClientError } from './errors';
import { mockApiState, simulateMockLatency } from './mockAdapter';

export async function getJob(jobId: string): Promise<ProcessingJob> {
  if (isMockApiEnabled()) {
    await simulateMockLatency(80);
    const job = mockApiState.jobs[jobId];
    if (!job) {
      throw new ApiClientError({
        message: `Processing job ${jobId} not found.`,
        code: 'NOT_FOUND',
        status: 404,
      });
    }
    return structuredClone(job);
  }
  return apiRequest<ProcessingJob>(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export async function cancelJob(jobId: string): Promise<ProcessingJob> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    const job = mockApiState.jobs[jobId];
    if (!job) {
      throw new ApiClientError({
        message: `Processing job ${jobId} not found.`,
        code: 'NOT_FOUND',
        status: 404,
      });
    }
    job.status = 'cancelled';
    job.currentTask = 'Processing cancelled by user.';
    job.stages = job.stages.map((s) =>
      s.status === 'running' || s.status === 'waiting'
        ? { ...s, status: 'cancelled' }
        : s
    );
    job.logs.push({
      id: `log-cancel-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'warning',
      message: '[Mock] Job cancelled by user.',
    });
    const project = mockApiState.projects.find((p) => p.id === job.projectId);
    if (project) {
      project.status = 'cancelled';
    }
    return structuredClone(job);
  }

  return apiRequest<ProcessingJob>(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
}

export function getJobEventsUrl(jobId: string): string {
  return buildApiUrl(`/api/jobs/${encodeURIComponent(jobId)}/events`);
}
