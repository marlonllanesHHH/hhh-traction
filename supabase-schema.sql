-- ============================================
-- HHH TRACTION - SUPABASE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================
-- PROFILES TABLE
-- ==================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  department TEXT,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==================
-- MEETINGS TABLE
-- ==================
CREATE TABLE meetings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT DEFAULT 'l10' CHECK (meeting_type IN ('l10', 'department', 'leadership')),
  cadence TEXT DEFAULT 'weekly',
  day_of_week INTEGER, -- 0=Sun, 1=Mon, etc.
  meeting_time TIME,
  duration_minutes INTEGER DEFAULT 90,
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meeting_attendees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_facilitator BOOLEAN DEFAULT false,
  UNIQUE(meeting_id, user_id)
);

CREATE TABLE meeting_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_session','completed')),
  notes TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE session_attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  present BOOLEAN DEFAULT false,
  UNIQUE(session_id, user_id)
);

-- ==================
-- ROCKS TABLE
-- ==================
CREATE TABLE rocks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES profiles(id),
  meeting_id UUID REFERENCES meetings(id),
  quarter TEXT, -- e.g., "Q2 2026"
  due_date DATE,
  status TEXT DEFAULT 'on_track' CHECK (status IN ('on_track','at_risk','off_track','complete')),
  is_company_rock BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rock_milestones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rock_id UUID REFERENCES rocks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0
);

-- ==================
-- SCORECARD TABLE
-- ==================
CREATE TABLE scorecard_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  goal TEXT NOT NULL,
  goal_operator TEXT DEFAULT '>=' CHECK (goal_operator IN ('>=','<=','=')),
  unit TEXT DEFAULT 'number',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scorecard_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  metric_id UUID REFERENCES scorecard_metrics(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  value NUMERIC,
  note TEXT,
  entered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_id, week_start)
);

-- ==================
-- ISSUES TABLE
-- ==================
CREATE TABLE issues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','solving','solved','long_term')),
  priority INTEGER DEFAULT 0,
  nominated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================
-- TO-DOS TABLE
-- ==================
CREATE TABLE todos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id),
  session_id UUID REFERENCES meeting_sessions(id),
  title TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================
-- HEADLINES TABLE
-- ==================
CREATE TABLE headlines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  type TEXT DEFAULT 'people' CHECK (type IN ('people','business')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================
-- PERFORMANCE EVALUATIONS
-- ==================
CREATE TABLE core_values (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default core values
INSERT INTO core_values (name, description, sort_order) VALUES
  ('Integrity', 'We do what we say and say what we do', 1),
  ('Excellence', 'We hold ourselves to the highest standards', 2),
  ('Inclusivity', 'We welcome and celebrate all people', 3),
  ('Community', 'We put community first in every decision', 4),
  ('Innovation', 'We seek creative solutions to old problems', 5);

CREATE TABLE evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  evaluatee_id UUID REFERENCES profiles(id),
  evaluator_id UUID REFERENCES profiles(id),
  period TEXT NOT NULL, -- e.g., "Q2 2026"
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','shared')),
  overall_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE evaluation_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  evaluation_id UUID REFERENCES evaluations(id) ON DELETE CASCADE,
  criterion_type TEXT NOT NULL CHECK (criterion_type IN ('core_value','gwc','custom')),
  criterion_id UUID, -- references core_values.id or custom_criteria.id
  criterion_name TEXT NOT NULL,
  score INTEGER CHECK (score BETWEEN 1 AND 5),
  gets_it BOOLEAN,
  wants_it BOOLEAN,
  capacity_to_do_it BOOLEAN,
  notes TEXT
);

CREATE TABLE custom_criteria (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================
-- ACCOUNTABILITY CHART
-- ==================
CREATE TABLE accountability_chart (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  seat_title TEXT NOT NULL,
  parent_id UUID REFERENCES accountability_chart(id),
  responsibilities TEXT[],
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================
-- VISION/TRACTION
-- ==================
CREATE TABLE vision_traction (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  section TEXT NOT NULL, -- 'core_values','core_focus','10year','3year','1year','quarterly'
  content JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================
-- ROW LEVEL SECURITY
-- ==================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE rocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rock_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE headlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE accountability_chart ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_traction ENABLE ROW LEVEL SECURITY;

-- Profiles: users can see all, update own
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- All authenticated users can read everything
CREATE POLICY "all_select" ON meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON meeting_attendees FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON meeting_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON session_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON rocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON rock_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON scorecard_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON scorecard_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON todos FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON headlines FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON core_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON custom_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON accountability_chart FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_select" ON vision_traction FOR SELECT TO authenticated USING (true);
CREATE POLICY "evaluations_select" ON evaluations FOR SELECT TO authenticated 
  USING (evaluatee_id = auth.uid() OR evaluator_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "eval_scores_select" ON evaluation_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM evaluations e WHERE e.id = evaluation_id AND 
    (e.evaluatee_id = auth.uid() OR e.evaluator_id = auth.uid() OR
     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))));

-- Insert/Update/Delete: all authenticated users
CREATE POLICY "all_insert" ON meetings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON meetings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_insert" ON meeting_attendees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_insert" ON meeting_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON meeting_sessions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_insert" ON session_attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON session_attendance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_insert" ON rocks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON rocks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_delete" ON rocks FOR DELETE TO authenticated USING (true);
CREATE POLICY "all_insert" ON rock_milestones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON rock_milestones FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_delete" ON rock_milestones FOR DELETE TO authenticated USING (true);
CREATE POLICY "all_insert" ON scorecard_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON scorecard_metrics FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_insert" ON scorecard_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON scorecard_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_insert" ON issues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON issues FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_delete" ON issues FOR DELETE TO authenticated USING (true);
CREATE POLICY "all_insert" ON todos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON todos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_delete" ON todos FOR DELETE TO authenticated USING (true);
CREATE POLICY "all_insert" ON headlines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_insert" ON evaluations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON evaluations FOR UPDATE TO authenticated 
  USING (evaluator_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "all_insert" ON evaluation_scores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON evaluation_scores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_insert" ON accountability_chart FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "all_update" ON accountability_chart FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_delete" ON accountability_chart FOR DELETE TO authenticated USING (true);
CREATE POLICY "all_update" ON vision_traction FOR UPDATE TO authenticated USING (true);
CREATE POLICY "all_insert" ON vision_traction FOR INSERT TO authenticated WITH CHECK (true);
