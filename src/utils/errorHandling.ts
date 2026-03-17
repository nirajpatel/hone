type ErrorClassification =
  | { kind: 'access_denied' }
  | { kind: 'invalid_credentials' }
  | { kind: 'email_not_confirmed' }
  | { kind: 'rate_limited' }
  | { kind: 'network' }
  | { kind: 'user_input'; message: string }
  | { kind: 'backend' };

function classifyError(error: any): ErrorClassification {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code || error?.status;
  const lower = errorMessage.toLowerCase();

  if (errorCode === 403 || lower.includes('access denied') || lower.includes('not authorized') || lower.includes('not approved')) {
    return { kind: 'access_denied' };
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return { kind: 'invalid_credentials' };
  }
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return { kind: 'email_not_confirmed' };
  }
  if (lower.includes('too many requests') || lower.includes('rate_limit')) {
    return { kind: 'rate_limited' };
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection') || lower.includes('timeout')) {
    return { kind: 'network' };
  }
  if (errorCode === 400 && (lower.includes('required') || lower.includes('invalid') || lower.includes('validation'))) {
    return { kind: 'user_input', message: errorMessage };
  }

  return { kind: 'backend' };
}

const userFacingMessages: Record<string, string> = {
  access_denied: "Thanks for your interest! This email isn't approved for beta access yet.",
  invalid_credentials: 'Incorrect email or password. Please try again.',
  email_not_confirmed: 'Please verify your email before signing in.',
  rate_limited: 'Too many sign-in attempts. Please wait a moment.',
  network: 'Connection error. Please check your internet and try again.',
};

/**
 * Returns a user-friendly error message.
 * User-facing errors get specific messaging; backend errors get the defaultMessage.
 */
export function sanitizeErrorMessage(error: any, defaultMessage: string = 'Something went wrong'): string {
  const classification = classifyError(error);

  if (classification.kind === 'backend') {
    return defaultMessage;
  }

  if (classification.kind === 'user_input') {
    return classification.message || defaultMessage;
  }

  return userFacingMessages[classification.kind] ?? defaultMessage;
}
