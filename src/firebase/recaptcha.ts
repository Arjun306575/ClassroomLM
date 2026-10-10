import { RecaptchaVerifier, type Auth } from 'firebase/auth';
import { firebaseConfig, auth } from './config';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (container: string | HTMLElement, parameters: Record<string, any>) => number;
      reset: (optWidgetId?: number) => void;
      getResponse: (optWidgetId?: number) => string;
    };
  }
}

/**
 * Dynamically resolves the reCAPTCHA site key from environment variables (import.meta.env or process.env)
 */
export const getRecaptchaSiteKey = (): string => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  const procEnv = typeof process !== 'undefined' && process.env ? process.env : undefined;

  const key =
    metaEnv?.VITE_RECAPTCHA_SITE_KEY ||
    procEnv?.RECAPTCHA_SITE_KEY ||
    metaEnv?.VITE_FIREBASE_RECAPTCHA_SITE_KEY ||
    procEnv?.FIREBASE_RECAPTCHA_SITE_KEY ||
    firebaseConfig.recaptchaSiteKey ||
    '';

  return typeof key === 'string' ? key.trim() : '';
};

let scriptLoadingPromise: Promise<boolean> | null = null;

/**
 * Safely injects the Google reCAPTCHA v3/Enterprise script tag into the document head
 */
export const loadRecaptchaScript = (): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);

  console.log('reCAPTCHA initialized:', import.meta.env.VITE_RECAPTCHA_SITE_KEY);

  const siteKey = getRecaptchaSiteKey();
  if (!siteKey) {
    console.warn('[reCAPTCHA] No site key found in environment variables (VITE_RECAPTCHA_SITE_KEY / RECAPTCHA_SITE_KEY)');
    return Promise.resolve(false);
  }

  if (window.grecaptcha) {
    return Promise.resolve(true);
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve) => {
    // Check if script tag already exists
    const existing = document.querySelector('script[src*="google.com/recaptcha/api.js"]');
    if (existing) {
      if (window.grecaptcha) {
        resolve(true);
      } else {
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', () => resolve(false));
      }
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = (err) => {
      console.warn('[reCAPTCHA] Failed to load Google reCAPTCHA script:', err);
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
};

/**
 * Executes reCAPTCHA token verification for a specific action (e.g. 'signin', 'signup', 'generate_classroom')
 */
export const executeRecaptcha = async (action: string = 'auth_flow'): Promise<string | null> => {
  const siteKey = getRecaptchaSiteKey();
  if (!siteKey) {
    return null;
  }

  try {
    const loaded = await loadRecaptchaScript();
    if (!loaded || !window.grecaptcha) {
      console.warn('[reCAPTCHA] Script not ready, proceeding with auth flow fallback');
      return null;
    }

    return await new Promise<string | null>((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn('[reCAPTCHA] Execution timed out, proceeding gracefully');
        resolve(null);
      }, 4000);

      window.grecaptcha?.ready(async () => {
        try {
          const token = await window.grecaptcha!.execute(siteKey, { action });
          clearTimeout(timeoutId);
          resolve(token);
        } catch (err) {
          clearTimeout(timeoutId);
          console.warn('[reCAPTCHA] Execution failed:', err);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.warn('[reCAPTCHA] Error executing reCAPTCHA:', error);
    return null;
  }
};

/**
 * Initializes a Firebase RecaptchaVerifier for authentication flows
 */
export const initFirebaseRecaptchaVerifier = (
  containerIdOrElement: string | HTMLElement,
  authInstance: Auth = auth,
  parameters: Record<string, any> = { size: 'invisible' }
): RecaptchaVerifier | null => {
  if (typeof window === 'undefined') return null;

  try {
    return new RecaptchaVerifier(authInstance, containerIdOrElement, parameters);
  } catch (err) {
    console.warn('[reCAPTCHA] Failed to initialize Firebase RecaptchaVerifier:', err);
    return null;
  }
};
