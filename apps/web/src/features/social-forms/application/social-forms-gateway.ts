import type { SocialForm, SocialFormInput } from '@erp/contracts/social-forms';
export interface SocialFormsGateway {
  list(familyId: string): Promise<SocialForm[]>;
  publish(input: SocialFormInput): Promise<SocialForm>;
}
