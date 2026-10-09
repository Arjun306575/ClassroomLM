import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppV2 from './v2/AppV2';
import { AuthProvider } from './firebase/authContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppV2 />
    </AuthProvider>
  </StrictMode>,
);
