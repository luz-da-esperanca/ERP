import type {
  SocialValue,
  SocialValues,
} from '@erp/contracts/social-form-fields';
import type {
  ProtectionContext,
  ProtectedPayload,
} from '../domain/protected-payload.js';
export type {
  ProtectedSocialBlock,
  ProtectionContext,
  ProtectedPayload,
} from '../domain/protected-payload.js';
export interface SensitivePayloads {
  available(): boolean;
  seal(
    context: ProtectionContext,
    value: SocialValues | SocialValue,
  ): ProtectedPayload;
  open(
    context: ProtectionContext,
    value: ProtectedPayload,
  ): SocialValues | SocialValue;
}
