import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import { createHttpAuthService } from './auth/http-auth-service.ts';
import type { ProtectedRouteDefinition } from './navigation/protected-route.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element is missing.');

const authService = createHttpAuthService();
const hubRoute: ProtectedRouteDefinition = {
  destination: '/hub',
  requiredProfile: 'COORDINATOR',
};

createRoot(rootElement).render(
  <StrictMode><App authService={authService} hubRoute={hubRoute} /></StrictMode>,
);
