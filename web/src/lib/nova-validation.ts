/**
 * Nova Validation Utilities
 *
 * Security utilities for validating Nova configuration to prevent SSRF attacks
 */

/**
 * Validates Nova base URL to prevent Server-Side Request Forgery (SSRF) attacks
 *
 * @param rawUrl - The URL to validate
 * @returns Error message if validation fails, null if valid
 */
export function validateNovaBaseUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    // Only allow HTTP(S)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Nova baseUrl must use http or https protocol";
    }

    const hostname = url.hostname.toLowerCase();

    // Disallow obvious local/loopback hosts
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return "Nova baseUrl must not point to a localhost address";
    }

    // Block common private network patterns by hostname
    if (
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.20.") ||
      hostname.startsWith("172.21.") ||
      hostname.startsWith("172.22.") ||
      hostname.startsWith("172.23.") ||
      hostname.startsWith("172.24.") ||
      hostname.startsWith("172.25.") ||
      hostname.startsWith("172.26.") ||
      hostname.startsWith("172.27.") ||
      hostname.startsWith("172.28.") ||
      hostname.startsWith("172.29.") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.")
    ) {
      return "Nova baseUrl must not point to a private network address";
    }

    return null;
  } catch {
    return "Nova baseUrl is not a valid URL";
  }
}
