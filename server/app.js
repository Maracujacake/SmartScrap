import express from 'express';
import { createVisualAnalysisService } from './visual-analysis.js';
import { createAuthService } from './services/auth.js';
import { configureRequests, configureErrors } from './middleware.js';
import { registerPublicAuthRoutes, registerPrivateAuthRoutes } from './routes/auth.js';
import { registerVisualAnalysisRoutes } from './routes/visual-analyses.js';
import { registerLotRoutes } from './routes/lots.js';
import { registerProposalRoutes } from './routes/proposals.js';
import { registerOrganizationRoutes } from './routes/organizations.js';
import { registerPickupRoutes } from './routes/pickups.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerProfileRoutes } from './routes/profile.js';
import { createEmailService } from './services/email.js';
import { registerEmailRoutes } from './routes/emails.js';
import { registerTransportRoutes } from './routes/transport.js';

export function createApp(db, options = {}) {
  const app = express();
  const visual = createVisualAnalysisService(db, options.visualAnalysis);
  const auth = createAuthService(db);
  const email = createEmailService(db, options.email);
  const notify = db.prepare(
    'INSERT INTO notifications (organization_id,title,message,lot_id) VALUES (?,?,?,?)',
  );
  const dependencies = {
    db,
    visual,
    auth,
    notify,
    email,
  };
  app.locals.visualAnalysis = visual;
  app.locals.email = email;
  app.disable('x-powered-by');
  configureRequests(app);
  app.get('/api/health', (req, res) =>
    res.json({
      status: 'ok',
    }),
  );
  registerPublicAuthRoutes(app, dependencies);

  // Every route registered below this point requires an authenticated session.
  app.use('/api', auth.authenticate);
  registerPrivateAuthRoutes(app, dependencies);
  registerVisualAnalysisRoutes(app, dependencies);
  registerLotRoutes(app, dependencies);
  registerProposalRoutes(app, dependencies);
  registerOrganizationRoutes(app, dependencies);
  registerPickupRoutes(app, dependencies);
  registerDashboardRoutes(app, dependencies);
  registerNotificationRoutes(app, dependencies);
  registerProfileRoutes(app, dependencies);
  registerTransportRoutes(app, dependencies);
  registerEmailRoutes(app, dependencies);
  configureErrors(app);
  return app;
}
