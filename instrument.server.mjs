import * as Sentry from "@sentry/react-router";
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
    dsn: "https://ac2a7defe8da325f72a1004e7bf306fe@o4512323302916096.ingest.us.sentry.io/4512323326443520",
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 1.0, // Capture 100% of the transactions
    profileSessionSampleRate: 1.0, // profile every transaction
});