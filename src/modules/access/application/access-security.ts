export interface AccessSecurityPort {
  hashPassword(password: string): string;
  verifyPassword(password: string, hash: string | null | undefined): boolean;
  generateSessionToken(): { readonly rawToken: string; readonly tokenHash: string };
  hashSessionToken(token: string): string;
}
