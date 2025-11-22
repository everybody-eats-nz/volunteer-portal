/**
 * Comprehensive TypeScript types for Nova Migration System
 *
 * This file defines all the types needed for the Nova migration system,
 * replacing all `any` types with proper TypeScript interfaces.
 */

import { SignupStatus } from "@/generated/client";

// ==============================================================================
// NOVA API CORE TYPES
// ==============================================================================

/**
 * Base Nova field structure used throughout Nova API responses
 */
export interface NovaField {
  attribute: string;
  value: string | number | NovaMediaItem[] | null;
  name: string;
  belongsToId?: number;
}

/**
 * Nova media item structure for profile photos
 */
export interface NovaMediaItem {
  __media_urls__?: {
    __original__?: string;
    detailView?: string;
    form?: string;
    preview?: string;
  };
  [key: string]: unknown;
}

/**
 * Base Nova resource with ID structure
 */
export interface NovaResource {
  id: {
    value: number;
  };
  fields: NovaField[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Nova paginated response structure
 */
export interface NovaPaginatedResponse<T = NovaResource> {
  data?: T[];
  resources?: T[];
  resource?: T;
  next_page_url?: string;
  prev_page_url?: string;
  per_page?: number;
  current_page?: number;
  total?: number;
  links?: {
    next?: string;
    prev?: string;
  };
}

// ==============================================================================
// NOVA USER TYPES
// ==============================================================================

/**
 * Legacy Nova user structure (flat format)
 */
export interface NovaUserLegacy {
  id: number;
  name: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_phone?: string;
  medical_conditions?: string;
  profile_photo?: string;
  photo?: string;
  avatar?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Nova user resource structure (Nova API format)
 */
export interface NovaUserResource extends NovaResource {
  fields: NovaUserField[];
}

/**
 * Nova user field types
 */
export interface NovaUserField extends NovaField {
  attribute:
    | "email"
    | "first_name"
    | "last_name"
    | "phone"
    | "date_of_birth"
    | "emergency_contact_name"
    | "emergency_contact_relationship"
    | "emergency_contact_phone"
    | "medical_conditions"
    | "avatar"
    | "profile_photo"
    | "approved_at"
    | string; // Allow for other fields that might exist
}

/**
 * Union type for Nova users (supports both legacy and new formats)
 */
export type NovaUser = NovaUserLegacy | NovaUserResource;

// ==============================================================================
// NOVA EVENT/SHIFT TYPES
// ==============================================================================

/**
 * Legacy Nova shift structure
 */
export interface NovaShiftLegacy {
  id: number;
  shift_type: string;
  start_time: string;
  end_time: string;
  location: string;
  capacity: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Nova event resource structure (Nova API format)
 */
export interface NovaEventResource extends NovaResource {
  fields: NovaEventField[];
}

/**
 * Nova event field types
 */
export interface NovaEventField extends NovaField {
  attribute:
    | "name"
    | "date"
    | "location"
    | "capacity"
    | "description"
    | "notes"
    | string; // Allow for other fields
}

/**
 * Union type for Nova shifts/events
 */
export type NovaShift = NovaShiftLegacy | NovaEventResource;
export type NovaEvent = NovaEventResource;

// ==============================================================================
// NOVA SIGNUP TYPES
// ==============================================================================

/**
 * Nova shift signup resource structure
 */
export interface NovaShiftSignupResource extends NovaResource {
  fields: NovaSignupField[];
  statusId?: number;
  statusName?: string;
  status?: string;
  canceled_at?: string;
}

/**
 * Nova signup field types
 */
export interface NovaSignupField extends NovaField {
  attribute:
    | "user"
    | "event"
    | "position"
    | "status"
    | "notes"
    | "canceled_at"
    | string; // Allow for other fields
}

/**
 * Union type for Nova signups
 */
export type NovaShiftSignup = NovaShiftSignupResource;

// ==============================================================================
// MIGRATION DATA STRUCTURES
// ==============================================================================

/**
 * Complete scraped data from Nova
 */
export interface ScrapedData {
  users: NovaUser[];
  events: NovaEvent[];
  signups: NovaShiftSignup[];
  metadata: ScrapedDataMetadata;
}

/**
 * Metadata about scraped data
 */
export interface ScrapedDataMetadata {
  scrapedAt: string;
  totalUsers: number;
  totalEvents: number;
  totalSignups: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
}

// ==============================================================================
// TRANSFORMATION TYPES
// ==============================================================================

/**
 * Options for data transformation
 */
export interface TransformationOptions {
  dryRun?: boolean;
  skipExistingUsers?: boolean;
  skipExistingShifts?: boolean;
  defaultPassword?: string;
  markAsMigrated?: boolean;
}

/**
 * Result of data transformation
 */
export interface TransformationResult {
  success: boolean;
  stats: TransformationStats;
  errors: TransformationError[];
}

/**
 * Statistics from transformation process
 */
export interface TransformationStats {
  usersProcessed: number;
  usersCreated: number;
  usersSkipped: number;
  shiftTypesCreated: number;
  shiftsProcessed: number;
  shiftsCreated: number;
  shiftsSkipped: number;
  signupsProcessed: number;
  signupsCreated: number;
  signupsSkipped: number;
}

/**
 * Error from transformation process
 */
export interface TransformationError {
  type: "user" | "shift" | "signup";
  id: number;
  error: string;
}

// ==============================================================================
// MIGRATION API REQUEST/RESPONSE TYPES
// ==============================================================================

/**
 * Nova authentication configuration
 */
export interface NovaAuthConfig {
  baseUrl: string;
  email: string;
  password: string;
}

/**
 * Bulk migration request
 */
export interface BulkMigrationRequest {
  novaConfig: NovaAuthConfig;
  options?: BulkMigrationOptions;
  sessionId?: string;
}

/**
 * Bulk migration options
 */
export interface BulkMigrationOptions {
  skipExistingUsers?: boolean;
  includeHistoricalData?: boolean;
  batchSize?: number;
  dryRun?: boolean;
  startPage?: number;
}

/**
 * Bulk migration response
 */
export interface BulkMigrationResponse {
  success: boolean;
  totalUsers: number;
  usersProcessed: number;
  usersCreated: number;
  usersSkipped: number;
  usersWithHistory: number;
  totalShifts: number;
  totalSignups: number;
  errors: string[];
  duration: number;
  dryRun: boolean;
}

/**
 * Preview migration request
 */
export interface PreviewMigrationRequest {
  novaConfig: NovaAuthConfig;
  limit?: number;
}

/**
 * Preview migration response
 */
export interface PreviewMigrationResponse {
  success: boolean;
  sampleUsers: NovaUserPreview[];
  totalUsersAvailable: number;
  errors: string[];
}

/**
 * Preview of a Nova user for migration
 */
export interface NovaUserPreview {
  id: number;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  profilePhoto?: string;
  approvedAt?: string;
  hasHistoricalData: boolean;
  shiftsCount: number;
  signupsCount: number;
}

/**
 * Migration progress request
 */
export interface MigrationProgressRequest {
  sessionId: string;
}

/**
 * Scrape user history request
 */
export interface ScrapeUserHistoryRequest {
  novaConfig: NovaAuthConfig;
  userId: number;
  sessionId?: string;
}

/**
 * Scrape user history response
 */
export interface ScrapeUserHistoryResponse {
  success: boolean;
  user: NovaUserWithHistory;
  errors: string[];
}

/**
 * Nova user with complete history
 */
export interface NovaUserWithHistory {
  user: NovaUser;
  signups: NovaShiftSignup[];
  events: NovaEvent[];
  metadata: {
    totalShifts: number;
    totalSignups: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
}

// ==============================================================================
// PROGRESS/SSE EVENT TYPES
// ==============================================================================

/**
 * Base progress event structure
 */
export interface ProgressEvent {
  type: ProgressEventType;
  message: string;
  timestamp: string;
  sessionId: string;
  stage: MigrationStage;
}

/**
 * Types of progress events
 */
export type ProgressEventType =
  | "status"
  | "progress"
  | "error"
  | "complete"
  | "heartbeat";

/**
 * Migration stages
 */
export type MigrationStage =
  | "connecting"
  | "fetching"
  | "processing"
  | "complete"
  | "error";

/**
 * Status progress event
 */
export interface StatusProgressEvent extends ProgressEvent {
  type: "status";
  totalUsers?: number;
  currentUser?: string;
}

/**
 * Progress update event
 */
export interface ProgressUpdateEvent extends ProgressEvent {
  type: "progress";
  currentUser: string;
  usersProcessed: number;
  totalUsers: number;
  usersCreated: number;
  usersSkipped: number;
  percentage?: number;
}

/**
 * Error progress event
 */
export interface ErrorProgressEvent extends ProgressEvent {
  type: "error";
  error: string;
  details?: string;
}

/**
 * Complete progress event
 */
export interface CompleteProgressEvent extends ProgressEvent {
  type: "complete";
  result: BulkMigrationResponse;
}

/**
 * Heartbeat progress event
 */
export interface HeartbeatProgressEvent extends ProgressEvent {
  type: "heartbeat";
}

/**
 * Union type for all progress events
 */
export type MigrationProgressEvent =
  | StatusProgressEvent
  | ProgressUpdateEvent
  | ErrorProgressEvent
  | CompleteProgressEvent
  | HeartbeatProgressEvent;

// ==============================================================================
// TRANSFORMED DATA TYPES
// ==============================================================================

/**
 * Transformed user data ready for Prisma
 */
export interface TransformedUserData {
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  profilePhotoUrl?: string | null;
  dateOfBirth?: Date | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
  medicalConditions?: string | null;
  hashedPassword: string;
  profileCompleted: boolean;
  isMigrated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transformed shift data ready for Prisma
 */
export interface TransformedShiftData {
  shiftTypeId?: string | null;
  start: Date;
  end: Date;
  location: string;
  capacity: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  shiftTypeName: string; // Helper field for shift type creation
}

/**
 * Transformed signup data ready for Prisma
 */
export interface TransformedSignupData {
  userId: string;
  shiftId: string;
  status: SignupStatus;
  canceledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Signup data with position information
 */
export interface SignupDataWithPosition {
  positionName: string;
}

// ==============================================================================
// STATUS MAPPING TYPES
// ==============================================================================

/**
 * Nova status mapping for signups
 */
export interface NovaStatusMapping {
  [key: string]: SignupStatus;
}

/**
 * Nova signup status (can be numeric or string)
 */
export type NovaSignupStatus = string | number;

// ==============================================================================
// COMPONENT PROPS TYPES
// ==============================================================================

/**
 * Props for Nova bulk migration component
 */
export interface NovaBulkMigrationProps {
  onMigrationComplete?: (result: BulkMigrationResponse) => void;
  onMigrationError?: (error: string) => void;
}

/**
 * Migration form data
 */
export interface MigrationFormData {
  baseUrl: string;
  email: string;
  password: string;
  skipExistingUsers: boolean;
  includeHistoricalData: boolean;
  batchSize: number;
  dryRun: boolean;
}

// ==============================================================================
// UTILITY TYPES
// ==============================================================================

/**
 * Extract field value helper type
 */
export type ExtractFieldValue<
  T extends NovaField,
  K extends string
> = T extends { attribute: K } ? T["value"] : never;

/**
 * Nova API response wrapper
 */
export interface NovaApiResponse<T = unknown> {
  data?: T;
  resource?: T;
  resources?: T[];
  message?: string;
  errors?: string[];
}

/**
 * Date parsing result
 */
export interface DateParseResult {
  success: boolean;
  date?: Date;
  error?: string;
}

/**
 * Photo download result
 */
export interface PhotoDownloadResult {
  success: boolean;
  base64Data?: string;
  error?: string;
}

// ==============================================================================
// ERROR TYPES
// ==============================================================================

/**
 * Nova API error
 */
export interface NovaApiError extends Error {
  status?: number;
  response?: string;
}

/**
 * Migration error details
 */
export interface MigrationErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ==============================================================================
// EXPORTS
// ==============================================================================
