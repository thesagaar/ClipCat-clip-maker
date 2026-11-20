import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import {
  createChatSpikeRouter,
  type ChatSpikeRouterOptions,
} from './chatspikeRouter.ts';

export function createServerApp(options: ChatSpikeRouterOptions = {}): {
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

  const { router, security, dirs } = createChatSpikeRouter(options);
  app.use('/api/chatspike', router);

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
