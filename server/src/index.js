import { hydrateSecrets } from './lib/secrets.js';
import { initialiseDocumentKey } from './lib/kms.js';

/**
 * Resolve secrets and the document key before configuration is evaluated.
 * `config.js` reads process.env at import time, so the app module is imported
 * dynamically after this bootstrap has completed.
 */
const secrets = await hydrateSecrets();
await initialiseDocumentKey();

if (secrets.provider !== 'env') {
  console.log(
    `Secrets: ${secrets.provider} (${secrets.loaded.length} value${secrets.loaded.length === 1 ? '' : 's'} loaded)`
  );
}

const { createApp } = await import('./app.js');
const { config } = await import('./config.js');
const { one } = await import('./db.js');
const { rateLimitMultiplier } = await import('./lib/http.js');

if (rateLimitMultiplier > 1) {
  console.log(
    `Rate limits: scaled x${rateLimitMultiplier} for demonstration. Never set RATE_LIMIT_MULTIPLIER on a real deployment.`
  );
}

const app = createApp();

if (config.isProduction && !config.demoMode) {
  const demoUsers = one('SELECT COUNT(*) AS count FROM users WHERE is_demo = 1')?.count || 0;
  if (demoUsers > 0) {
    throw new Error(
      `Refusing to start: ${demoUsers} seeded demo account(s) remain in the production database. Remove demo data before launch or set DEMO_MODE=true with ALLOW_DEMO_IN_PRODUCTION=true for a labelled demonstration.`
    );
  }
}

app.listen(config.port, () => {
  console.log(`FLAMINGO API listening on http://localhost:${config.port}`);
  console.log(
    `Environment: ${config.env} · demo mode: ${config.demoMode} · upload scanning: ${config.malwareScan.mode}`
  );
  if (config.env !== 'production') {
    console.log('Demo logins are documented in docs/DEMO_ACCOUNTS.md');
  }
});
