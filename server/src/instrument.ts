import * as Sentry from '@sentry/node';
import servicesDB from './db/services.js';
import serverInfo from './serverInfo.json' with { type: 'json' };
import logger from './logger.js';



const inDevMode = process.env.MODE === 'dev' || process.env.ENV === 'local';

// Where error reports go. This fork ships with none: the original project's address would send
// reports about this fork's code to people who did not write it. Anyone running their own Sentry
// project can set SENTRY_DSN in the service's environment.
const SENTRY_DSN = process.env.SENTRY_DSN;

export const initSentry = () => {
  if (!SENTRY_DSN) {
    logger.debug('Error reporting has no destination (SENTRY_DSN is not set); nothing will be sent');
    return;
  }
  logger.debug('Initializing sentry...');
  Sentry.init({
    dsn: SENTRY_DSN,
    // Preserve the restrictive data collection used before Sentry 11.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
      frameContextLines: 7,
    },
    traceLifecycle: 'static',
    tracesSampleRate: 1.0,
    initialScope: {
      tags: {
        ...serverInfo,
        environment: inDevMode ? 'development' : 'production',
      }
    },
  });
};

await servicesDB.read();
// if (!inDevMode && servicesDB.data.sentryLogging.enabled) {
if (servicesDB.data.sentryLogging.enabled) {
  initSentry();
}
