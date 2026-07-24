// Local-dev / traditional-host entry point. Not used on Vercel — there,
// api/index.js wraps the same app as a serverless function instead.
import { app } from './app.js';

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
