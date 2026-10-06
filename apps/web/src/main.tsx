import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ConnectedApp } from './app/connected-app';
import { HttpAuthentication } from './access';
import { ApiClient } from './shared/api-client';
import './index.css';

const authentication = new HttpAuthentication(new ApiClient());

const root = document.getElementById('root');

if (!root) throw new Error('Application root was not found');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ConnectedApp authentication={authentication} />
    </BrowserRouter>
  </StrictMode>,
);
