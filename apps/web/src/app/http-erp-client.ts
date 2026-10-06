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
  constructor(api: ApiClient) {
    this.registration = new HttpRegistration(api, this.invalidate);
    this.projects = new HttpProjects(api);
    this.audit = new HttpAudit(api);
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
