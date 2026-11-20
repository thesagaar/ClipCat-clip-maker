export interface ActiveJobLock {
  tryAcquire(jobId: string, kind: 'chatspike' | 'publishing'): boolean;
  release(jobId: string): void;
  getActive(): { jobId: string; kind: 'chatspike' | 'publishing' } | null;
}

export function createActiveJobLock(): ActiveJobLock {
  let active: { jobId: string; kind: 'chatspike' | 'publishing' } | null = null;

  return {
    tryAcquire(jobId: string, kind: 'chatspike' | 'publishing'): boolean {
      if (active && active.jobId !== jobId) {
        return false;
      }
      active = { jobId, kind };
      return true;
    },
    release(jobId: string): void {
      if (active && active.jobId === jobId) {
        active = null;
      }
    },
    getActive() {
      return active;
    },
  };
}
