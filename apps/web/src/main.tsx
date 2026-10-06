import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ConnectedApp } from './app/connected-app';
import { HttpAuthentication } from './access';
import { ApiClient } from './shared/api-client';
import { HttpErpClient } from './app/http-erp-client';
import './index.css';

const api = new ApiClient();
const authentication = new HttpAuthentication(api);
const client = new HttpErpClient(api);

const root = document.getElementById('root');

if (!root) throw new Error('Application root was not found');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ConnectedApp authentication={authentication} client={client} />
    </BrowserRouter>
  </StrictMode>,
);
