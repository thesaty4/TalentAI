-- TalentLens AI — PostgreSQL schema
-- Run via seed.js which drops and recreates on each run for demo resets

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager','hr','candidate')),
  title TEXT,
  employee_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  business_unit TEXT NOT NULL,
  location TEXT NOT NULL,
  experience_years NUMERIC NOT NULL,
  bench_status TEXT NOT NULL DEFAULT 'Bench',
  current_allocation TEXT,
  available_date DATE,
  joining_notice TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_employee;
ALTER TABLE users ADD CONSTRAINT fk_users_employee
  FOREIGN KEY (employee_id) REFERENCES employees(id);

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS employee_skills (
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, skill_id)
);

CREATE TABLE IF NOT EXISTS employee_projects (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  client_name TEXT,
  duration TEXT,
  description TEXT NOT NULL,
  domain_tags TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS employee_ratings (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  review_cycle TEXT NOT NULL,
  rating TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  customer TEXT NOT NULL,
  manager_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Active',
  start_date DATE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ircs (
  id SERIAL PRIMARY KEY,
  irc_code TEXT UNIQUE NOT NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  mandatory_skills TEXT NOT NULL,
  preferred_skills TEXT,
  experience_range TEXT NOT NULL,
  location TEXT NOT NULL,
  remote_policy TEXT NOT NULL,
  opening_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open'
);

CREATE TABLE IF NOT EXISTS pipeline_candidates (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  irc_id INTEGER REFERENCES ircs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'AI Shortlisted',
  match_pct INTEGER,
  why_recommend TEXT,
  why_not TEXT[] DEFAULT '{}',
  conflict BOOLEAN DEFAULT false,
  conflict_note TEXT,
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_note TEXT,
  applied_date DATE DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, irc_id)
);

CREATE TABLE IF NOT EXISTS feedback_rounds (
  id SERIAL PRIMARY KEY,
  pipeline_candidate_id INTEGER REFERENCES pipeline_candidates(id) ON DELETE CASCADE,
  round_name TEXT NOT NULL,
  interviewer TEXT,
  round_date DATE,
  rating TEXT,
  comments TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  seen BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS search_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  irc_id INTEGER REFERENCES ircs(id),
  query_text TEXT,
  jd_filename TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS not_fit_feedback (
  id SERIAL PRIMARY KEY,
  pipeline_candidate_id INTEGER REFERENCES pipeline_candidates(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
