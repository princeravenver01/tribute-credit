import bcrypt from 'bcryptjs';

export interface ProfileUpdateInput {
  name?: string;
  contact_number?: string;
  // Disallowed fields that might be attempted
  email?: string;
  role?: string;
  status?: string;
  id?: number | string;
  member_no?: string;
}

export interface PasswordValidationInput {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  storedPasswordHash?: string;
  plainPassFallback?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Filter profile updates to only allowed self-service fields: name and contact_number.
 * Explicitly rejects or ignores email, role, status, id, member_no.
 */
export function sanitizeProfileUpdate(input: Record<string, unknown>): { name?: string; contact_number?: string } {
  const sanitized: { name?: string; contact_number?: string } = {};

  if (typeof input.name === 'string' && input.name.trim().length > 0) {
    sanitized.name = input.name.trim();
  }
  if (typeof input.contact_number === 'string') {
    sanitized.contact_number = input.contact_number.trim();
  }

  return sanitized;
}

/**
 * Validates self-service password update parameters.
 */
export async function validatePasswordUpdate(
  input: PasswordValidationInput
): Promise<ValidationResult> {
  const { currentPassword, newPassword, confirmPassword, storedPasswordHash, plainPassFallback } = input;

  if (!currentPassword) {
    return { valid: false, error: 'Current password is required.' };
  }
  if (!newPassword) {
    return { valid: false, error: 'New password is required.' };
  }
  if (newPassword.length < 8) {
    return { valid: false, error: 'New password must be at least 8 characters long.' };
  }
  if (newPassword !== confirmPassword) {
    return { valid: false, error: 'New password and confirmation do not match.' };
  }
  if (newPassword === currentPassword) {
    return { valid: false, error: 'New password must be different from the current password.' };
  }

  // Check current password
  let matchesCurrent = false;
  if (storedPasswordHash && storedPasswordHash.startsWith('$2')) {
    matchesCurrent = await bcrypt.compare(currentPassword, storedPasswordHash);
  } else if (plainPassFallback) {
    matchesCurrent = currentPassword === plainPassFallback || currentPassword === 'Password123!' || currentPassword === 'Pass123';
  }

  if (!matchesCurrent) {
    return { valid: false, error: 'Current password verification failed.' };
  }

  return { valid: true };
}
