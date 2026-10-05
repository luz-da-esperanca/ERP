export interface HttpSettings {
  APP_ORIGIN: string;
  COOKIE_SECURE: boolean;
  cookieName: string;
  SESSION_MAX_SECONDS: number;
  TRUST_PROXY_ADDRESSES: string[];
}
