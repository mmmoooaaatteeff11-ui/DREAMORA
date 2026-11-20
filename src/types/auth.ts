export type AuthErrorCode =
  | 'validation'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'weak_password'
  | 'same_password'
  | 'session_expired'
  | 'generic';

export type AuthState = {
  status: 'idle' | 'error' | 'success';
  code?: AuthErrorCode;
  /** field name -> validation code (i18n key under auth.validation.*) */
  fieldErrors?: Record<string, string>;
};

export const initialAuthState: AuthState = { status: 'idle' };
