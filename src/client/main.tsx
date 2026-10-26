import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import './login.css';
import { createHttpAuthService } from './auth/http-auth-service.ts';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element is missing.');

const authService = createHttpAuthService();

createRoot(rootElement).render(
  <StrictMode><App authService={authService} /></StrictMode>,
);
