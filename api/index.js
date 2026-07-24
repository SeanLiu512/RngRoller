// Vercel serverless entry point. Every request to /api/* is routed here
// (see vercel.json) and handled by the same Express app used for local
// dev. Express apps are valid standalone (req, res) handlers, so no
// adapter package is needed — just export it directly.
//
// bodyParser must stay disabled here: Vercel would otherwise consume the
// request stream itself before Express's own express.json() middleware
// (in server/app.js) gets a chance to read it.
import { app } from '../server/app.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
