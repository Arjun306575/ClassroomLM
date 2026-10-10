import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppV2 from './v2/AppV2';
import { AuthProvider } from './firebase/authContext';
import './index.css';

console.log('reCAPTCHA initialized:', import.meta.env.VITE_RECAPTCHA_SITE_KEY);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppV2 />
    </AuthProvider>
  </StrictMode>,
);
