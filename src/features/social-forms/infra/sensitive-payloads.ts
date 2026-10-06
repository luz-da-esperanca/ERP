import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { socialMemberBlocksSchema } from '@erp/contracts/social-forms-api';
import type {
  SensitivePayloads,
  ProtectionContext,
} from '../application/sensitive-payloads.js';

const aad = (context: ProtectionContext) =>
  Buffer.from(
    JSON.stringify([
      context.formId,
      context.version,
      context.memberId,
      context.block,
    ]),
  );
export function createSensitivePayloads(
  currentKeyId: string,
  keys: Record<string, Uint8Array>,
): SensitivePayloads {
  for (const key of Object.values(keys))
    if (key.byteLength !== 32)
      throw new Error('Social encryption keys must contain exactly 32 bytes');
  const unavailable = () => new Error('Protected social data unavailable');
  return {
    available: () => !!keys[currentKeyId],
    seal(context, value) {
      const key = keys[currentKeyId];
      if (!key) throw unavailable();
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce, {
        authTagLength: 16,
      });
      cipher.setAAD(aad(context));
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(value), 'utf8'),
        cipher.final(),
      ]);
      return {
        keyId: currentKeyId,
        nonce: nonce.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
      };
    },
    open(context, value) {
      try {
        const key = keys[value.keyId];
        if (!key) throw unavailable();
        const nonce = Buffer.from(value.nonce, 'base64');
        const tag = Buffer.from(value.tag, 'base64');
        if (nonce.length !== 12 || tag.length !== 16) throw unavailable();
        const decipher = createDecipheriv('aes-256-gcm', key, nonce, {
          authTagLength: 16,
        });
        decipher.setAAD(aad(context));
        decipher.setAuthTag(tag);
        // No plaintext leaves this boundary before final authenticates the complete ciphertext.
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(value.ciphertext, 'base64')),
          decipher.final(),
        ]);
        return socialMemberBlocksSchema.shape[context.block].parse(
          JSON.parse(plaintext.toString('utf8')),
        )!;
      } catch {
        throw unavailable();
      }
    },
  };
}
