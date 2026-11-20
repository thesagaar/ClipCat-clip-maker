import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { createActiveJobLock } from './activeJobLock.ts';
import {
  createChatSpikeRouter,
  type ChatSpikeRouterOptions,
} from './chatspikeRouter.ts';
import { createPublishingRouter } from './publishing/publishingRouter.ts';
import type { FetchLike, OAuthConfig } from './publishing/publishingOAuth.ts';

export interface ServerAppOptions extends ChatSpikeRouterOptions {
  publishingFetchFn?: FetchLike;
  publishingOAuthEnvOverrides?: Partial<OAuthConfig>;
}

export function createServerApp(options: ServerAppOptions = {}): {
  app: Express;
  security: ReturnType<typeof createChatSpikeRouter>['security'];
  dirs: ReturnType<typeof createChatSpikeRouter>['dirs'];
} {
  const app = express();
  app.disable('x-powered-by');

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  const activeJobLock = options.activeJobLock ?? createActiveJobLock();
  const { router, security, dirs } = createChatSpikeRouter({
    ...options,
    activeJobLock,
  });
  app.use('/api/chatspike', router);

  const { router: publishingRouter } = createPublishingRouter({
    baseDirs: dirs,
    security,
    activeJobLock,
    fetchFn: options.publishingFetchFn,
    oauthEnvOverrides: options.publishingOAuthEnvOverrides,
  });
  app.use('/api/publishing', publishingRouter);

  // Sanitized error handler preventing stack traces or host paths in API responses
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) {
      next(err);
      return;
    }
    const status =
      typeof (err as { status?: number })?.status === 'number'
        ? (err as { status: number }).status
        : 500;
    const detail =
      status < 500 && err instanceof Error
        ? err.message
        : 'Internal processing error. Check local server logs for details.';
    if (!res.headersSent) {
      res.status(status).json({ detail });
    }
  });

  return { app, security, dirs };
}
