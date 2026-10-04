import type {
  Activity,
  ActivityDetail,
  ActivityInput,
  Project,
  ProjectInput,
  ProjectsOverview,
} from '@erp/contracts/projects';
export interface ProjectsGateway {
  overview(): Promise<ProjectsOverview>;
  createProject(input: ProjectInput): Promise<Project>;
  createActivity(input: ActivityInput): Promise<Activity>;
  getActivity(id: string, asOf: string): Promise<ActivityDetail>;
  enroll(
    activityId: string,
    personId: string,
    validFrom: string,
    revision: number,
  ): Promise<void>;
}
