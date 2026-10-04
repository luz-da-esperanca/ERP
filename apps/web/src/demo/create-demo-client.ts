import type { ErpClient } from '../app/erp-client';
import { DemoRuntime } from './runtime';
import { createDemoAccess } from '../features/access/infra/demo-access';
import { createDemoRegistration } from '../features/registration/infra/demo-registration';
import { createDemoProjects } from '../features/projects/infra/demo-projects';
import { createDemoAttendance } from '../features/attendance/infra/demo-attendance';
import { createDemoSocialForms } from '../features/social-forms/infra/demo-social-forms';
import { createDemoReports } from '../features/reports/infra/demo-reports';
export function createDemoClient(runtime = new DemoRuntime()): ErpClient {
  return {
    subscribe: runtime.subscribe,
    getVersion: runtime.getVersion,
    access: createDemoAccess(runtime),
    registration: createDemoRegistration(runtime),
    projects: createDemoProjects(runtime),
    attendance: createDemoAttendance(runtime),
    socialForms: createDemoSocialForms(runtime),
    reports: createDemoReports(runtime),
    audit: {
      async list() {
        const actor = runtime.authorize('audit.read');
        const permissions = runtime.session()?.capabilities ?? [];
        return runtime.read('audit.read', (s) =>
          s.audit
            .filter((e) => permissions.includes(e.readCapability))
            .map((e) => ({
              ...e,
              actorName:
                s.accounts.find((a) => a.id === e.actorId)?.displayName ??
                (e.actorId === actor.id ? actor.displayName : e.actorName),
            }))
            .reverse(),
        );
      },
    },
  };
}
