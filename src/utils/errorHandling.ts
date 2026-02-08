/**
 * Determines if an error is user-facing (user's fault) or a backend error
 * User-facing errors should be shown to users, backend errors should be sanitized
 */
export function isUserFacingError(error: any): boolean {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code || error?.status;
  const lowerMessage = errorMessage.toLowerCase();

  // User-facing errors (user's fault):
  // - Authentication/authorization errors
  if (errorCode === 403 || lowerMessage.includes('access denied') || lowerMessage.includes('not authorized') || lowerMessage.includes('not approved')) {
    return true;
  }
  
  // - Invalid credentials
  if (lowerMessage.includes('invalid login credentials') || lowerMessage.includes('invalid credentials') || lowerMessage.includes('incorrect')) {
    return true;
  }
  
  // - Email not confirmed
  if (lowerMessage.includes('email not confirmed') || lowerMessage.includes('email_not_confirmed')) {
    return true;
  }
  
  // - Rate limiting (user making too many requests)
  if (lowerMessage.includes('too many requests') || lowerMessage.includes('rate_limit')) {
    return true;
  }
  
  // - Validation errors (user input issues)
  if (errorCode === 400 && (lowerMessage.includes('required') || lowerMessage.includes('invalid') || lowerMessage.includes('validation'))) {
    return true;
  }
  
  // - Network/connection errors (user's network issue)
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection') || lowerMessage.includes('timeout')) {
    return true;
  }

  // Backend errors (not user's fault):
  // - 500 errors, database errors, server errors, etc.
  return false;
}

/**
 * Sanitizes error messages for display to users
 * Returns user-friendly message for user-facing errors
 * Returns generic "Something went wrong" for backend errors
 */
export function sanitizeErrorMessage(error: any, defaultMessage: string = 'Something went wrong'): string {
  // If it's a user-facing error, return the message (or a friendly version)
  if (isUserFacingError(error)) {
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || error?.status;
    const lowerMessage = errorMessage.toLowerCase();

    // Map to user-friendly messages
    if (errorCode === 403 || lowerMessage.includes('access denied') || lowerMessage.includes('not authorized') || lowerMessage.includes('not approved')) {
      return 'Thanks for your interest! This email isn\'t approved for beta access yet.';
    }
    
    if (lowerMessage.includes('invalid login credentials') || lowerMessage.includes('invalid credentials')) {
      return 'Incorrect email or password. Please try again.';
    }
    
    if (lowerMessage.includes('email not confirmed') || lowerMessage.includes('email_not_confirmed')) {
      return 'Please verify your email before signing in.';
    }
    
    if (lowerMessage.includes('too many requests') || lowerMessage.includes('rate_limit')) {
      return 'Too many sign-in attempts. Please wait a moment.';
    }
    
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection')) {
      return 'Connection error. Please check your internet and try again.';
    }

    // For other user-facing errors, return the message
    return errorMessage || defaultMessage;
  }

  // For backend errors, return generic message
  return defaultMessage;
}
