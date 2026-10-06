export type ProtectedSocialBlock = 'health' | 'medications' | 'religion';
export interface ProtectionContext {
  formId: string;
  version: number;
  memberId: string;
  block: ProtectedSocialBlock;
}
export interface ProtectedPayload {
  keyId: string;
  nonce: string;
  ciphertext: string;
  tag: string;
}
