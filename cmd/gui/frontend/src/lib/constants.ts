/**
 * Kattle Application Constants
 *
 * Global constants used across the application.
 */

export const APP_NAME = "Kattle";
export const APP_VERSION = "0.1.0";
export const APP_TAGLINE = "Deep dive into your cattle";
export const APP_DESCRIPTION = "Kubernetes Resource Explorer";

export const GITHUB_URL = "https://github.com/flavono123/kattle";

/**
 * Default columns always shown in ResultTable (not removable by user).
 * - '_context': Synthetic column for multi-cluster context (not in schema)
 * - 'metadata.name': Standard Kubernetes resource identifier
 */
export const DEFAULT_COLUMNS = ['_context', 'metadata.name'] as const;

/**
 * Default columns that exist in the schema tree.
 * These should have disabled selection in NavigationPanel since they're always visible.
 * Subset of DEFAULT_COLUMNS that are actual schema fields.
 */
export const DEFAULT_SCHEMA_FIELDS = ['metadata.name'] as const;
