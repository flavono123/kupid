/**
 * Kubernetes API version parsing and comparison utilities.
 * Handles versions like "v1", "v1beta1", "v2alpha1", etc.
 */

interface VersionInfo {
  major: number;
  stability: number;
  stabilityOrder: number;
}

/**
 * Parse a Kubernetes API version string into comparable parts.
 * @param version - Version string (e.g., "v1", "v1beta1", "v2alpha1")
 * @returns Parsed version info with major, stability, and stabilityOrder
 */
export function parseVersion(version: string): VersionInfo {
  // Extract version number (e.g., "v2", "v1beta1" -> 2, 1)
  const match = version.match(/^v(\d+)/);
  const major = match ? parseInt(match[1], 10) : 0;

  // Determine stability: stable (3) > beta (2) > alpha (1)
  let stability = 3; // default to stable
  let stabilityOrder = 0; // for beta1, beta2, etc.

  if (version.includes('alpha')) {
    stability = 1;
    const alphaMatch = version.match(/alpha(\d+)?/);
    stabilityOrder = alphaMatch?.[1] ? parseInt(alphaMatch[1], 10) : 0;
  } else if (version.includes('beta')) {
    stability = 2;
    const betaMatch = version.match(/beta(\d+)?/);
    stabilityOrder = betaMatch?.[1] ? parseInt(betaMatch[1], 10) : 0;
  }

  return { major, stability, stabilityOrder };
}

/**
 * Compare two Kubernetes API versions for sorting.
 * Higher/more stable versions come first (descending order).
 * @param a - First version string
 * @param b - Second version string
 * @returns Negative if a > b, positive if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a);
  const vB = parseVersion(b);

  // Compare major version first (higher first)
  if (vA.major !== vB.major) {
    return vB.major - vA.major;
  }

  // Same major version: compare stability (stable > beta > alpha)
  if (vA.stability !== vB.stability) {
    return vB.stability - vA.stability;
  }

  // Same stability: compare stability order (higher first)
  return vB.stabilityOrder - vA.stabilityOrder;
}
