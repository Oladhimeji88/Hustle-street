/**
 * Database types.
 *
 * Hand-maintained to mirror `supabase/migrations/*`. Regenerate the canonical
 * version with:
 *
 *   pnpm dlx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * Keeping a checked-in version means the app typechecks in CI without needing
 * database credentials.
 */

// ─── Enums (mirror the PostgreSQL enum types) ────────────────────────────────

export type UserRole = 'user' | 'moderator' | 'admin' | 'superadmin'
export type AccountStatus = 'active' | 'restricted' | 'suspended' | 'banned' | 'deleted'
export type VerificationKind = 'email' | 'phone' | 'identity' | 'address' | 'business'
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired'

export type JobStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'APPLICATIONS_OPEN'
  | 'HIRED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'EXPIRED'

export type JobUrgency = 'flexible' | 'scheduled' | 'today' | 'asap'
export type JobScheduleKind = 'asap' | 'today' | 'tomorrow' | 'date' | 'flexible'
export type BudgetKind = 'fixed' | 'negotiable' | 'hourly'
export type JobVisibility = 'nearby' | 'category' | 'invite_only' | 'public'
export type JobLocationKind = 'onsite' | 'remote' | 'hybrid'

export type ApplicationStatus =
  | 'submitted'
  | 'shortlisted'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired'

export type AssignmentStatus =
  | 'pending_payment'
  | 'active'
  | 'submitted'
  | 'completed'
  | 'cancelled'
  | 'disputed'

export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR' | 'GHS' | 'KES'

export type TransactionKind =
  | 'escrow_funding'
  | 'escrow_release'
  | 'refund'
  | 'payout'
  | 'payout_reversal'
  | 'fee'
  | 'adjustment'

export type TransactionStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'HELD'
  | 'RELEASED'
  | 'FAILED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'CANCELLED'

export type LedgerAccountKind =
  | 'user_available'
  | 'user_pending'
  | 'escrow'
  | 'platform_revenue'
  | 'gateway_receivable'
  | 'payout_clearing'
  | 'gateway_fees'

export type EntryDirection = 'debit' | 'credit'
export type PayoutStatus = 'requested' | 'processing' | 'paid' | 'failed' | 'reversed' | 'cancelled'

export type DisputeStatus = 'open' | 'under_review' | 'awaiting_evidence' | 'resolved' | 'withdrawn'
export type DisputeReason =
  | 'not_completed'
  | 'poor_quality'
  | 'payment_issue'
  | 'wrong_description'
  | 'fraud'
  | 'safety_issue'
  | 'cancellation'
  | 'other'
export type DisputeResolution =
  | 'refund_poster'
  | 'release_hustler'
  | 'split'
  | 'no_action'
  | 'cancelled_by_agreement'

export type ReportTarget = 'user' | 'job' | 'message' | 'review' | 'application'
export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ReviewDirection = 'poster_to_hustler' | 'hustler_to_poster'

export type MessageKind = 'text' | 'image' | 'file' | 'voice' | 'system'
export type ConversationKind = 'job' | 'direct' | 'support'
export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms'

export type NotificationKind =
  | 'job_nearby'
  | 'application_received'
  | 'application_accepted'
  | 'application_declined'
  | 'message_received'
  | 'payment_received'
  | 'payment_released'
  | 'payout_processed'
  | 'job_reminder'
  | 'job_submitted'
  | 'job_completed'
  | 'review_request'
  | 'review_received'
  | 'dispute_update'
  | 'verification_update'
  | 'security_alert'
  | 'system'

// ─── Row shapes ──────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  headline: string | null
  email: string | null
  phone: string | null
  city: string | null
  area: string | null
  state: string | null
  country_code: string
  home_lat: number | null
  home_lng: number | null
  is_hustler: boolean
  is_poster: boolean
  service_radius_km: number
  hourly_rate_minor: number | null
  starting_price_minor: number | null
  currency: CurrencyCode
  available_now: boolean
  accepts_remote: boolean
  rating_avg: number
  rating_count: number
  jobs_completed: number
  jobs_posted: number
  response_rate: number
  response_time_secs: number | null
  cancellation_count: number
  status: AccountStatus
  suspended_until: string | null
  suspension_reason: string | null
  risk_level: RiskLevel
  risk_score: number
  email_verified: boolean
  phone_verified: boolean
  identity_verified: boolean
  onboarding_step: string
  profile_completed: boolean
  locale: string
  timezone: string
  last_active_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

/** The projection that is safe to expose publicly. */
export type PublicProfile = Pick<
  Profile,
  | 'id'
  | 'username'
  | 'display_name'
  | 'avatar_url'
  | 'bio'
  | 'headline'
  | 'city'
  | 'area'
  | 'state'
  | 'country_code'
  | 'is_hustler'
  | 'is_poster'
  | 'service_radius_km'
  | 'hourly_rate_minor'
  | 'starting_price_minor'
  | 'currency'
  | 'available_now'
  | 'accepts_remote'
  | 'rating_avg'
  | 'rating_count'
  | 'jobs_completed'
  | 'jobs_posted'
  | 'response_rate'
  | 'response_time_secs'
  | 'email_verified'
  | 'phone_verified'
  | 'identity_verified'
  | 'created_at'
>

export interface Category {
  id: string
  parent_id: string | null
  slug: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  position: number
  is_active: boolean
  min_budget_minor: number | null
  requires_identity_verification: boolean
  job_count: number
}

export interface Skill {
  id: string
  slug: string
  name: string
  category_id: string | null
  is_active: boolean
  usage_count: number
}

export interface LocationRow {
  id: string
  parent_id: string | null
  kind: 'country' | 'state' | 'city' | 'area'
  slug: string
  name: string
  country_code: string
  currency: CurrencyCode
  lat: number | null
  lng: number | null
  radius_km: number | null
  is_active: boolean
  position: number
}

export interface Job {
  id: string
  reference: string
  poster_id: string
  category_id: string
  title: string
  description: string
  status: JobStatus
  urgency: JobUrgency
  location_kind: JobLocationKind
  visibility: JobVisibility
  address_id: string | null
  area_label: string | null
  city: string | null
  state: string | null
  country_code: string
  location_id: string | null
  schedule_kind: JobScheduleKind
  scheduled_for: string | null
  duration_minutes: number | null
  budget_kind: BudgetKind
  budget_min_minor: number | null
  budget_max_minor: number | null
  currency: CurrencyCode
  view_count: number
  application_count: number
  save_count: number
  notified_count: number
  is_flagged: boolean
  published_at: string | null
  expires_at: string | null
  hired_at: string | null
  started_at: string | null
  submitted_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface JobImage {
  id: string
  job_id: string
  storage_path: string
  media_type: 'image' | 'video'
  width: number | null
  height: number | null
  position: number
}

export interface JobRequirement {
  id: string
  job_id: string
  label: string
  kind: 'vehicle' | 'tools' | 'experience' | 'availability' | 'verification' | 'custom'
  is_mandatory: boolean
  position: number
}

export interface JobApplication {
  id: string
  job_id: string
  hustler_id: string
  status: ApplicationStatus
  proposed_price_minor: number
  currency: CurrencyCode
  message: string
  can_start_at: string | null
  estimated_minutes: number | null
  snapshot_rating: number
  snapshot_jobs_done: number
  snapshot_distance_m: number | null
  portfolio_item_ids: string[]
  skill_ids: string[]
  is_shortlisted: boolean
  poster_viewed_at: string | null
  responded_at: string | null
  decline_reason: string | null
  created_at: string
  updated_at: string
}

export interface JobAssignment {
  id: string
  job_id: string
  application_id: string
  hustler_id: string
  poster_id: string
  status: AssignmentStatus
  agreed_price_minor: number
  currency: CurrencyCode
  platform_fee_minor: number
  hustler_net_minor: number
  commission_rate_bps: number
  scheduled_for: string | null
  started_at: string | null
  submitted_at: string | null
  completion_note: string | null
  completion_media: string[]
  confirmed_at: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancellation_reason: string | null
  auto_confirm_at: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  kind: ConversationKind
  job_id: string | null
  application_id: string | null
  subject: string | null
  created_by: string | null
  last_message_at: string | null
  last_message_preview: string | null
  message_count: number
  is_locked: boolean
  locked_reason: string | null
  created_at: string
  updated_at: string
}

export interface ConversationMember {
  conversation_id: string
  user_id: string
  role: 'participant' | 'support' | 'observer'
  last_read_at: string | null
  last_read_message_id: string | null
  unread_count: number
  is_muted: boolean
  joined_at: string
  left_at: string | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  kind: MessageKind
  body: string | null
  client_nonce: string | null
  reply_to_id: string | null
  system_event: string | null
  metadata: Record<string, unknown>
  is_edited: boolean
  edited_at: string | null
  deleted_at: string | null
  flagged: boolean
  created_at: string
}

export interface MessageAttachment {
  id: string
  message_id: string
  storage_path: string
  file_name: string | null
  mime_type: string
  byte_size: number
  width: number | null
  height: number | null
  duration_ms: number | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  kind: NotificationKind
  title: string
  body: string | null
  action_url: string | null
  image_url: string | null
  entity_type: string | null
  entity_id: string | null
  actor_id: string | null
  metadata: Record<string, unknown>
  is_critical: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationPreferences {
  user_id: string
  in_app_enabled: boolean
  push_enabled: boolean
  email_enabled: boolean
  sms_enabled: boolean
  jobs_nearby: boolean
  application_updates: boolean
  messages: boolean
  payments: boolean
  reviews: boolean
  marketing: boolean
  quiet_hours_start: number | null
  quiet_hours_end: number | null
  nearby_radius_km: number
}

export interface Wallet {
  user_id: string
  currency: CurrencyCode
  available_minor: number
  pending_minor: number
  total_minor: number
  withdrawing_minor: number
}

export interface Transaction {
  id: string
  reference: string
  kind: TransactionKind
  status: TransactionStatus
  currency: CurrencyCode
  amount_minor: number
  fee_minor: number
  net_minor: number
  job_id: string | null
  assignment_id: string | null
  payer_id: string | null
  payee_id: string | null
  provider: string | null
  provider_reference: string | null
  provider_fee_minor: number
  idempotency_key: string
  failure_reason: string | null
  metadata: Record<string, unknown>
  authorized_at: string | null
  held_at: string | null
  released_at: string | null
  refunded_at: string | null
  failed_at: string | null
  created_at: string
  updated_at: string
}

export interface LedgerEntry {
  id: string
  transaction_id: string
  account_id: string
  direction: EntryDirection
  amount_minor: number
  currency: CurrencyCode
  narration: string | null
  balance_after_minor: number
  created_at: string
}

export interface PayoutAccount {
  id: string
  user_id: string
  provider: string
  bank_code: string
  bank_name: string
  account_last4: string
  account_name: string
  recipient_code: string | null
  currency: CurrencyCode
  is_default: boolean
  is_verified: boolean
  created_at: string
}

export interface Payout {
  id: string
  reference: string
  user_id: string
  payout_account_id: string
  transaction_id: string | null
  amount_minor: number
  fee_minor: number
  currency: CurrencyCode
  status: PayoutStatus
  provider: string
  provider_reference: string | null
  failure_reason: string | null
  requested_at: string
  completed_at: string | null
  created_at: string
}

export interface Review {
  id: string
  assignment_id: string
  job_id: string
  reviewer_id: string
  reviewee_id: string
  direction: ReviewDirection
  rating: number
  body: string | null
  quality: number | null
  communication: number | null
  reliability: number | null
  professionalism: number | null
  payment_promptness: number | null
  respect: number | null
  job_accuracy: number | null
  is_published: boolean
  published_at: string | null
  is_hidden: boolean
  created_at: string
}

export interface Dispute {
  id: string
  reference: string
  job_id: string
  assignment_id: string
  transaction_id: string | null
  raised_by: string
  against_user: string
  reason: DisputeReason
  description: string
  status: DisputeStatus
  amount_minor: number
  currency: CurrencyCode
  refund_to_poster_minor: number | null
  release_to_hustler_minor: number | null
  resolution: DisputeResolution | null
  resolution_note: string | null
  assigned_to: string | null
  resolved_by: string | null
  resolved_at: string | null
  respond_by: string
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  reporter_id: string
  target_kind: ReportTarget
  target_id: string
  target_user_id: string | null
  reason: string
  details: string | null
  evidence_paths: string[]
  status: ReportStatus
  priority: number
  assigned_to: string | null
  resolution: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface PlatformSetting {
  key: string
  value: unknown
  value_type: 'number' | 'string' | 'boolean' | 'json'
  category: string
  label: string
  description: string | null
  is_public: boolean
  min_value: number | null
  max_value: number | null
  updated_at: string
}

// ─── RPC result shapes ───────────────────────────────────────────────────────

export interface JobSearchResult {
  id: string
  reference: string
  title: string
  description: string
  status: JobStatus
  urgency: JobUrgency
  location_kind: JobLocationKind
  category_id: string
  category_name: string
  category_slug: string
  category_icon: string | null
  budget_kind: BudgetKind
  budget_min_minor: number | null
  budget_max_minor: number | null
  currency: CurrencyCode
  area_label: string | null
  city: string | null
  distance_m: number | null
  schedule_kind: JobScheduleKind
  scheduled_for: string | null
  application_count: number
  view_count: number
  published_at: string | null
  expires_at: string | null
  poster_id: string
  poster_name: string
  poster_avatar: string | null
  poster_rating: number
  poster_jobs_posted: number
  poster_identity_verified: boolean
  cover_image: string | null
  total_count: number
}

export interface HustlerSearchResult {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  headline: string | null
  bio: string | null
  area: string | null
  city: string | null
  distance_m: number | null
  rating_avg: number
  rating_count: number
  jobs_completed: number
  response_rate: number
  response_time_secs: number | null
  available_now: boolean
  accepts_remote: boolean
  starting_price_minor: number | null
  hourly_rate_minor: number | null
  currency: CurrencyCode
  identity_verified: boolean
  phone_verified: boolean
  service_radius_km: number
  skills: string[]
  total_count: number
}

export interface JobRecommendation {
  job_id: string
  title: string
  category_name: string
  budget_min_minor: number | null
  budget_max_minor: number | null
  currency: CurrencyCode
  area_label: string | null
  distance_m: number | null
  urgency: JobUrgency
  application_count: number
  published_at: string | null
  score: number
  score_location: number
  score_skills: number
  score_rating: number
  score_availability: number
  score_experience: number
  reason: string
}

export interface HustlerRecommendation {
  hustler_id: string
  username: string
  display_name: string
  avatar_url: string | null
  headline: string | null
  rating_avg: number
  jobs_completed: number
  distance_m: number | null
  available_now: boolean
  starting_price_minor: number | null
  response_rate: number
  identity_verified: boolean
  score: number
  reason: string
}

export interface SearchSuggestion {
  kind: 'category' | 'skill' | 'location' | 'job'
  id: string
  label: string
  sublabel: string | null
  slug: string | null
  icon: string | null
}

export interface AcceptApplicationResult {
  assignment_id: string
  transaction_id: string
  transaction_reference: string
  conversation_id: string
  amount_minor: number
  platform_fee_minor: number
  hustler_net_minor: number
  currency: CurrencyCode
}

export interface ConfirmCompletionResult {
  assignment_id: string
  release_transaction_id: string
  hustler_net_minor: number
  platform_fee_minor: number
  currency: CurrencyCode
}

export interface MapJobPin {
  id: string
  title: string
  lat: number
  lng: number
  budget_min_minor: number | null
  budget_max_minor: number | null
  currency: CurrencyCode
  category_slug: string
  category_icon: string | null
  urgency: JobUrgency
  area_label: string | null
}
