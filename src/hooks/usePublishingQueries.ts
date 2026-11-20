import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelPublishingJob,
  disconnectPublishingAccount,
  getPublishingAccounts,
  getPublishingHistory,
  getPublishingJob,
  retryPublishingJob,
  startPublishingJob,
} from '../api/publishing';
import type { PublishPlatform, PublishStartRequest } from '../publishing/types';

export const publishingQueryKeys = {
  accounts: ['publishing', 'accounts'] as const,
  history: ['publishing', 'history'] as const,
  job: (jobId: string) => ['publishing', 'job', jobId] as const,
};

export function usePublishingAccountsQuery() {
  return useQuery({
    queryKey: publishingQueryKeys.accounts,
    queryFn: getPublishingAccounts,
    retry: 1,
  });
}

export function usePublishingHistoryQuery() {
  return useQuery({
    queryKey: publishingQueryKeys.history,
    queryFn: getPublishingHistory,
    retry: 1,
  });
}

export function usePublishingJobPollingQuery(jobId: string | null) {
  return useQuery({
    queryKey: publishingQueryKeys.job(jobId ?? ''),
    queryFn: () => getPublishingJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const st = query.state.data?.status;
      if (
        st === 'published' ||
        st === 'failed' ||
        st === 'cancelled' ||
        st === 'requires_attention'
      ) {
        return false;
      }
      return 1200;
    },
    retry: 1,
  });
}

export function useDisconnectPublishingAccountMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platform: PublishPlatform) => disconnectPublishingAccount(platform),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: publishingQueryKeys.accounts });
    },
  });
}

export function useStartPublishingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PublishStartRequest) => startPublishingJob(payload),
    onSuccess: (job) => {
      qc.setQueryData(publishingQueryKeys.job(job.id), job);
      qc.invalidateQueries({ queryKey: publishingQueryKeys.accounts });
      qc.invalidateQueries({ queryKey: publishingQueryKeys.history });
    },
  });
}

export function useRetryPublishingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => retryPublishingJob(jobId),
    onSuccess: (job) => {
      qc.setQueryData(publishingQueryKeys.job(job.id), job);
      qc.invalidateQueries({ queryKey: publishingQueryKeys.accounts });
      qc.invalidateQueries({ queryKey: publishingQueryKeys.history });
    },
  });
}

export function useCancelPublishingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => cancelPublishingJob(jobId),
    onSuccess: (job) => {
      qc.setQueryData(publishingQueryKeys.job(job.id), job);
      qc.invalidateQueries({ queryKey: publishingQueryKeys.accounts });
      qc.invalidateQueries({ queryKey: publishingQueryKeys.history });
    },
  });
}
