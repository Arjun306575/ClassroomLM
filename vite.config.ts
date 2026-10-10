import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'dynamic-firebase-config',
        transform(_code, id) {
          if (id.replace(/\\/g, '/').endsWith('firebase-applet-config.json')) {
            const getVal = (viteKey: string, nodeKey: string) => {
              return (
                env[viteKey] ||
                env[nodeKey] ||
                process.env[nodeKey] ||
                process.env[viteKey] ||
                ''
              );
            };

            return {
              code: `
const metaEnv = (typeof import.meta !== 'undefined' && import.meta && import.meta.env) ? import.meta.env : {};
const procEnv = (typeof process !== 'undefined' && process && process.env) ? process.env : {};

export default {
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || procEnv.FIREBASE_PROJECT_ID || ${JSON.stringify(getVal('VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'))},
  appId: metaEnv.VITE_FIREBASE_APP_ID || procEnv.FIREBASE_APP_ID || ${JSON.stringify(getVal('VITE_FIREBASE_APP_ID', 'FIREBASE_APP_ID'))},
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || procEnv.FIREBASE_API_KEY || ${JSON.stringify(getVal('VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY'))},
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || procEnv.FIREBASE_AUTH_DOMAIN || ${JSON.stringify(getVal('VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN'))},
  firestoreDatabaseId: metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || procEnv.FIREBASE_FIRESTORE_DATABASE_ID || ${JSON.stringify(getVal('VITE_FIREBASE_FIRESTORE_DATABASE_ID', 'FIREBASE_FIRESTORE_DATABASE_ID'))},
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || procEnv.FIREBASE_STORAGE_BUCKET || ${JSON.stringify(getVal('VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET'))},
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || procEnv.FIREBASE_MESSAGING_SENDER_ID || ${JSON.stringify(getVal('VITE_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID'))},
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || procEnv.FIREBASE_MEASUREMENT_ID || ${JSON.stringify(getVal('VITE_FIREBASE_MEASUREMENT_ID', 'FIREBASE_MEASUREMENT_ID'))},
  oAuthClientId: metaEnv.VITE_FIREBASE_OAUTH_CLIENT_ID || procEnv.FIREBASE_OAUTH_CLIENT_ID || ${JSON.stringify(getVal('VITE_FIREBASE_OAUTH_CLIENT_ID', 'FIREBASE_OAUTH_CLIENT_ID'))},
  recaptchaSiteKey: metaEnv.VITE_RECAPTCHA_SITE_KEY || procEnv.RECAPTCHA_SITE_KEY || metaEnv.VITE_FIREBASE_RECAPTCHA_SITE_KEY || procEnv.FIREBASE_RECAPTCHA_SITE_KEY || ${JSON.stringify(getVal('VITE_RECAPTCHA_SITE_KEY', 'RECAPTCHA_SITE_KEY') || getVal('VITE_FIREBASE_RECAPTCHA_SITE_KEY', 'FIREBASE_RECAPTCHA_SITE_KEY'))},
};
`,
              map: null,
            };
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
