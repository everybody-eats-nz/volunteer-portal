import { Check, X } from "lucide-react";
import { getPasswordRequirementStatus } from "@/lib/utils/password-validation";

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

export function PasswordRequirements({ password, className = "" }: PasswordRequirementsProps) {
  const requirements = getPasswordRequirementStatus(password);

  if (!password) {
    return (
      <p className={`text-xs text-muted-foreground ${className}`} data-testid="password-hint">
        Password must be at least 6 characters long and contain uppercase, lowercase letter, and number
      </p>
    );
  }

  return (
    <div className={`space-y-1 ${className}`} data-testid="password-requirements">
      {requirements.map((requirement, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          {requirement.passed ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <X className="h-3 w-3 text-red-500" />
          )}
          <span
            className={
              requirement.passed
                ? "text-green-600"
                : "text-red-500"
            }
          >
            {requirement.message}
          </span>
        </div>
      ))}
    </div>
  );
}