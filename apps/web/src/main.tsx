import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './app/app-layout';
import { ErpProvider } from './app/erp-provider';
import { createDemoClient } from './demo/create-demo-client';
import { LoginPage } from './features/access/presentation/login-page';
import { DashboardPage } from './features/home/presentation/dashboard-page';
import { FamiliesPage } from './features/registration/presentation/families-page';
import {
  NewFamilyPage,
  FamilyPage,
  FamilyMembersPage,
} from './features/registration/presentation/family-page';
import { PersonPage } from './features/registration/presentation/person-page';
import './index.css';

const client = createDemoClient();

function App() {
  return (
    <ErpProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="families" element={<FamiliesPage />} />
            <Route path="families/new" element={<NewFamilyPage />} />
            <Route path="families/:id" element={<FamilyPage />} />
            <Route
              path="families/:id/members"
              element={<FamilyMembersPage />}
            />
            <Route path="families/:id/edit" element={<FamilyPage edit />} />
            <Route path="people/:id" element={<PersonPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErpProvider>
  );
}

const root = document.getElementById('root');

if (!root) throw new Error('Application root was not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
