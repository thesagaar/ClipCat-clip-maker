/**
 * Tauri 2 Desktop Compatibility Adapter
 *
 * Provides safe runtime detection and graceful fallbacks when running inside
 * a standard web browser vs. a future Tauri 2 desktop shell.
 * Never invokes unrestricted browser or filesystem APIs directly.
 */

interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: {
    invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  };
}

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as TauriWindow).__TAURI_INTERNALS__?.invoke);
}

export function getRuntimeEnvironmentLabel(): 'Tauri Desktop' | 'Web Browser (Local API)' {
  return isTauriEnvironment() ? 'Tauri Desktop' : 'Web Browser (Local API)';
}

export function getPlatformDisplayLabel(): 'Windows Desktop' | 'Web Browser' {
  return isTauriEnvironment() ? 'Windows Desktop' : 'Web Browser';
}

export async function openOutputFolder(directoryPath: string): Promise<{
  supported: boolean;
  message: string;
}> {
  const win = typeof window !== 'undefined' ? (window as TauriWindow) : null;
  if (win?.__TAURI_INTERNALS__?.invoke) {
    try {
      await win.__TAURI_INTERNALS__.invoke('open_output_folder', { path: directoryPath });
      return { supported: true, message: `Opened folder: ${directoryPath}` };
    } catch (err) {
      return {
        supported: true,
        message: err instanceof Error ? err.message : 'Failed to open output folder.',
      };
    }
  }

  return {
    supported: false,
    message:
      'Opening local folders directly is available in the Tauri 2 desktop app. In the browser, use Download to save exported files.',
  };
}

export async function triggerVerifiedDownload(
  downloadUrl: string,
  filename: string
): Promise<{ started: boolean; error?: string }> {
  try {
    // Verify file exists and is reachable before claiming download started
    const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
    if (!headResponse.ok) {
      return {
        started: false,
        error: `Export file is unavailable on backend (HTTP ${headResponse.status}).`,
      };
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { started: true };
  } catch {
    return {
      started: false,
      error: 'Unable to reach backend download endpoint. Verify FastAPI is running.',
    };
  }
}
