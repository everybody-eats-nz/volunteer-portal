export interface PasswordRequirement {
  test: (password: string) => boolean;
  message: string;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    test: (password: string) => password.length >= 6,
    message: "At least 6 characters",
  },
  {
    test: (password: string) => /[A-Z]/.test(password),
    message: "Contains uppercase letter",
  },
  {
    test: (password: string) => /[a-z]/.test(password),
    message: "Contains lowercase letter",
  },
  {
    test: (password: string) => /[0-9]/.test(password),
    message: "Contains number",
  },
];

export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  for (const requirement of PASSWORD_REQUIREMENTS) {
    if (!requirement.test(password)) {
      errors.push(requirement.message);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getPasswordRequirementStatus(password: string) {
  return PASSWORD_REQUIREMENTS.map(requirement => ({
    ...requirement,
    passed: requirement.test(password),
  }));
}