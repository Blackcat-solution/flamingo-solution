-- FLAMINGO relational schema (SQLite dialect, portable to PostgreSQL with minor type changes)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('professional','employer','admin')),
  admin_role TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending','closed')),
  mfa_secret TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS professional_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  category TEXT NOT NULL,
  bio TEXT,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  years_experience REAL NOT NULL DEFAULT 0,
  current_title TEXT,
  current_employer TEXT,
  education TEXT,
  languages TEXT NOT NULL DEFAULT '[]',
  skills TEXT NOT NULL DEFAULT '[]',
  certifications TEXT NOT NULL DEFAULT '[]',
  portfolio_url TEXT,
  linkedin_url TEXT,
  hourly_rate_paise INTEGER,
  recommended_rate_paise INTEGER,
  availability_days TEXT NOT NULL DEFAULT '[]',
  shift_hours INTEGER NOT NULL DEFAULT 8,
  preferred_start TEXT,
  preferred_end TEXT,
  break_schedule TEXT NOT NULL DEFAULT '[]',
  minimum_experience_met INTEGER NOT NULL DEFAULT 0,
  notice_period_days INTEGER DEFAULT 0,
  salary_expectation_paise INTEGER,
  photo_url TEXT,
  resume_document_id TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  identity_status TEXT NOT NULL DEFAULT 'pending' CHECK (identity_status IN ('pending','submitted','verified','rejected')),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','in_review','verified','rejected')),
  assessment_status TEXT NOT NULL DEFAULT 'not_started' CHECK (assessment_status IN ('not_started','in_progress','failed','passed')),
  profile_status TEXT NOT NULL DEFAULT 'draft' CHECK (profile_status IN ('draft','submitted','approved','rejected','inactive')),
  rating REAL NOT NULL DEFAULT 0,
  completed_assignments INTEGER NOT NULL DEFAULT 0,
  rehire_rate REAL NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_category ON professional_profiles(category);
CREATE INDEX IF NOT EXISTS idx_profiles_public ON professional_profiles(is_public);

CREATE TABLE IF NOT EXISTS employer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  org_name TEXT NOT NULL,
  legal_name TEXT,
  registration_number TEXT,
  gstin TEXT,
  industry TEXT,
  company_size TEXT,
  website TEXT,
  registered_address TEXT,
  city TEXT,
  state TEXT,
  rep_name TEXT NOT NULL,
  rep_designation TEXT,
  billing_email TEXT,
  billing_address TEXT,
  organisation_history TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','in_review','verified','rejected')),
  verification_notes TEXT,
  verified_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('professional','employer')),
  owner_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','verified','rejected')),
  reviewer_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS employment_history (
  id TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  employer_name TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS professional_references (
  id TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  relationship TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','contacted','verified','declined')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'mid' CHECK (level IN ('mid','senior','lead')),
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  pass_score INTEGER NOT NULL DEFAULT 70,
  is_active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_questions (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq','short','practical')),
  prompt TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  correct_option INTEGER,
  points INTEGER NOT NULL DEFAULT 10,
  rubric TEXT,
  difficulty TEXT NOT NULL DEFAULT 'mid',
  tags TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id),
  professional_id TEXT NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','auto_scored','human_review','passed','failed','expired')),
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  submitted_at TEXT,
  auto_score REAL,
  final_score REAL,
  pass_mark INTEGER NOT NULL DEFAULT 70,
  integrity_score INTEGER NOT NULL DEFAULT 100,
  integrity_flags TEXT NOT NULL DEFAULT '[]',
  reviewer_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_notes TEXT,
  feedback TEXT,
  question_order TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_attempts_professional ON assessment_attempts(professional_id);

CREATE TABLE IF NOT EXISTS attempt_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES assessment_questions(id),
  answer TEXT,
  is_correct INTEGER,
  points_awarded REAL,
  reviewer_note TEXT,
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS integrity_events (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_requirements (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES employer_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  skills TEXT NOT NULL DEFAULT '[]',
  min_experience REAL NOT NULL DEFAULT 3,
  hours_per_week INTEGER NOT NULL,
  shift_hours INTEGER NOT NULL DEFAULT 8,
  working_days TEXT NOT NULL DEFAULT '[]',
  start_date TEXT,
  duration_weeks INTEGER,
  budget_hourly_paise INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','paused','filled','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shortlists (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES employer_profiles(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  requirement_id TEXT REFERENCES job_requirements(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (employer_id, professional_id, requirement_id)
);

CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES employer_profiles(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  requirement_id TEXT REFERENCES job_requirements(id) ON DELETE SET NULL,
  round INTEGER NOT NULL CHECK (round IN (1,2)),
  scheduled_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  mode TEXT NOT NULL DEFAULT 'video',
  meeting_url TEXT,
  panel TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  notes TEXT,
  outcome TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_round ON interviews(employer_id, professional_id, round, IFNULL(requirement_id,''));
CREATE INDEX IF NOT EXISTS idx_interviews_time ON interviews(scheduled_at);

CREATE TABLE IF NOT EXISTS scorecards (
  id TEXT PRIMARY KEY,
  interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  panel_user_id TEXT REFERENCES users(id),
  panel_name TEXT NOT NULL,
  scores TEXT NOT NULL DEFAULT '{}',
  total_score REAL,
  recommendation TEXT CHECK (recommendation IN ('strong_yes','yes','no','strong_no')),
  notes TEXT,
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  employer_id TEXT NOT NULL REFERENCES employer_profiles(id),
  professional_id TEXT NOT NULL REFERENCES professional_profiles(id),
  requirement_id TEXT REFERENCES job_requirements(id),
  title TEXT NOT NULL,
  description TEXT,
  scope TEXT,
  category TEXT,
  hourly_rate_paise INTEGER NOT NULL,
  hours_per_week INTEGER NOT NULL,
  shift_hours INTEGER NOT NULL,
  working_days TEXT NOT NULL DEFAULT '[]',
  daily_start TEXT DEFAULT '09:00',
  start_date TEXT NOT NULL,
  end_date TEXT,
  deliverables TEXT,
  reporting_manager TEXT,
  payment_terms TEXT NOT NULL DEFAULT '50% advance; 50% on completion and formal release',
  cancellation_terms TEXT,
  dispute_terms TEXT,
  break_schedule TEXT NOT NULL DEFAULT '[]',
  estimated_hours REAL,
  total_value_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','active','on_hold','awaiting_approval','completed','disputed','closed','cancelled')),
  contract_signed_professional INTEGER NOT NULL DEFAULT 0,
  contract_signed_employer INTEGER NOT NULL DEFAULT 0,
  activation_fee_charged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assignments_professional ON assignments(professional_id);
CREATE INDEX IF NOT EXISTS idx_assignments_employer ON assignments(employer_id);

CREATE TABLE IF NOT EXISTS assignment_events (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 60,
  hours_worked REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected','disputed')),
  notes TEXT,
  submitted_at TEXT NOT NULL,
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  approval_note TEXT,
  UNIQUE (assignment_id, work_date, start_at)
);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(work_date);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  employer_id TEXT NOT NULL REFERENCES employer_profiles(id),
  type TEXT NOT NULL CHECK (type IN ('advance','final')),
  professional_charges_paise INTEGER NOT NULL,
  platform_fee_paise INTEGER NOT NULL DEFAULT 0,
  gst_paise INTEGER NOT NULL DEFAULT 0,
  other_charges_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','paid','void')),
  issued_at TEXT NOT NULL,
  due_at TEXT,
  paid_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  payment_ref TEXT NOT NULL UNIQUE,
  invoice_id TEXT REFERENCES invoices(id),
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  employer_id TEXT NOT NULL REFERENCES employer_profiles(id),
  type TEXT NOT NULL CHECK (type IN ('advance','final')),
  amount_paise INTEGER NOT NULL,
  platform_fee_paise INTEGER NOT NULL DEFAULT 0,
  gst_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  gateway TEXT NOT NULL DEFAULT 'simulated',
  gateway_ref TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','authorised','captured','failed','refunded','partially_refunded')),
  created_at TEXT NOT NULL,
  captured_at TEXT,
  refunded_paise INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  payout_ref TEXT NOT NULL UNIQUE,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  professional_id TEXT NOT NULL REFERENCES professional_profiles(id),
  type TEXT NOT NULL CHECK (type IN ('advance','final')),
  gross_paise INTEGER NOT NULL,
  activation_fee_paise INTEGER NOT NULL DEFAULT 0,
  tds_paise INTEGER NOT NULL DEFAULT 0,
  net_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','on_hold','failed')),
  method TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS activation_fees (
  id TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL REFERENCES professional_profiles(id),
  assignment_id TEXT NOT NULL UNIQUE REFERENCES assignments(id),
  amount_paise INTEGER NOT NULL,
  base_paise INTEGER NOT NULL,
  gst_paise INTEGER NOT NULL,
  payout_id TEXT REFERENCES payouts(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','deducted','refunded')),
  disclosed_at TEXT NOT NULL,
  charged_at TEXT
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  txn_group TEXT NOT NULL,
  account TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  amount_paise INTEGER NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_group ON ledger_entries(txn_group);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL UNIQUE REFERENCES assignments(id),
  employer_id TEXT NOT NULL REFERENCES employer_profiles(id),
  professional_id TEXT NOT NULL REFERENCES professional_profiles(id),
  manager_user_id TEXT REFERENCES users(id),
  scores TEXT NOT NULL DEFAULT '{}',
  total_score REAL NOT NULL,
  strengths TEXT,
  improvements TEXT,
  responsibilities TEXT,
  overall_rating TEXT,
  rehire INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','submitted','published','challenged','under_review','upheld','revised')),
  submitted_at TEXT NOT NULL,
  professional_response TEXT,
  response_at TEXT,
  resolution TEXT,
  resolution_at TEXT
);

CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  raised_by TEXT NOT NULL REFERENCES users(id),
  assignment_id TEXT REFERENCES assignments(id),
  review_id TEXT REFERENCES reviews(id),
  payment_id TEXT REFERENCES payments(id),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','rejected')),
  resolution TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  ip TEXT,
  meta TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS rate_benchmarks (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  level TEXT NOT NULL,
  min_hourly_paise INTEGER NOT NULL,
  median_hourly_paise INTEGER NOT NULL,
  max_hourly_paise INTEGER NOT NULL,
  demand_index REAL NOT NULL DEFAULT 1.0,
  source_name TEXT NOT NULL,
  source_url TEXT,
  as_of TEXT NOT NULL,
  notes TEXT,
  UNIQUE (category, level, source_name)
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','closed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT,
  success INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(email, created_at);
