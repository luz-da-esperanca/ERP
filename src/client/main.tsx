import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import './login.css';
import { createHttpAuthService } from './auth/http-auth-service.ts';
import { createHttpStockApi } from './social-stock/http-stock-api.ts';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element is missing.');

const authService = createHttpAuthService();
const stockApi = createHttpStockApi({ csrfProvider: authService });

createRoot(rootElement).render(
  <StrictMode><App authService={authService} stockApi={stockApi} /></StrictMode>,
);
