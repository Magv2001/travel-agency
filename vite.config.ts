import { reactRouter } from "@react-router/dev/vite";
import { sentryReactRouter, type SentryReactRouterBuildOptions } from '@sentry/react-router/vite';
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const sentryConfig: SentryReactRouterBuildOptions = {
  org: "martindev-1i",
  project: "travel-agency",
  // An auth token is required for uploading source maps;
  // store it in an environment variable to keep it secure.
  authToken: process.env.VITE_SENTRY_AUTH_TOKEN,
  // ...
};

export default defineConfig(config => {
  return {
    plugins: [tailwindcss(), reactRouter(),sentryReactRouter(sentryConfig, config)],
    resolve: {
      tsconfigPaths: true,
    },
    ssr: {
      noExternal: [/@syncfusion/]
    }
  };
});
