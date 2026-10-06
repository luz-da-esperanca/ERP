import { HttpComposition } from '../features/registration/infra/http-composition';
import { HttpEligibility } from '../features/eligibility/infra/http-eligibility';
import { HttpSocialForms } from '../features/social-forms/infra/http-social-forms';
import { HttpReports } from '../features/reports/infra/http-reports';
import { HttpUsers } from '../features/access/infra/http-users';
import type { ApiClient } from '../shared/api-client';
import { HttpRegistration } from '../features/registration/infra/http-registration';
import { HttpProjects } from '../features/projects/infra/http-projects';
import { HttpAudit } from '../features/audit/infra/http-audit';
import type { ErpViewClient } from './erp-client';

export class HttpErpClient implements ErpViewClient {
  private revision = 0;
  private readonly listeners = new Set<() => void>();
  readonly registration: HttpRegistration;
  readonly projects: HttpProjects;
  readonly audit: HttpAudit;
  readonly eligibility: HttpEligibility;
  readonly socialForms: HttpSocialForms;
  readonly reports: HttpReports;
  readonly users: HttpUsers;
  readonly composition: HttpComposition;
  constructor(readonly api: ApiClient) {
    this.registration = new HttpRegistration(api, this.invalidate);
    this.projects = new HttpProjects(api, this.invalidate);
    this.audit = new HttpAudit(api);
    this.eligibility = new HttpEligibility(api);
    this.socialForms = new HttpSocialForms(api);
    this.reports = new HttpReports(api);
    this.users = new HttpUsers(api);
    this.composition = new HttpComposition(api, this.invalidate);
  }
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly getVersion = () => this.revision;
  private readonly invalidate = () => {
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  };
}
