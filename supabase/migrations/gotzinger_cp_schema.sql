-- Gotzinger Cleaning Program Schema
-- Execute this in the Supabase SQL editor

CREATE TABLE gotzinger_cp_workstreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  operational_label TEXT,
  shift_days TEXT[],
  shift_start TIME,
  shift_end TIME,
  show_task_times BOOLEAN DEFAULT false,
  scope_description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gotzinger_cp_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID,
  parent_area_id UUID REFERENCES gotzinger_cp_areas(id),
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gotzinger_cp_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID,
  area_id UUID REFERENCES gotzinger_cp_areas(id),
  workstream_id UUID REFERENCES gotzinger_cp_workstreams(id),
  name TEXT NOT NULL,
  cleaning_level TEXT,
  frequency_type TEXT,
  frequency_interval INTEGER,
  occurrences_per_week INTEGER,
  fixed_days TEXT[],
  allowed_days TEXT[],
  fixed_time_start TIME,
  fixed_time_end TIME,
  scheduling_constraint TEXT,
  instructions TEXT,
  limitation_text TEXT,
  source_sheet TEXT,
  source_row INTEGER,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gotzinger_cp_task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES gotzinger_cp_task_templates(id),
  program_id UUID,
  site_id UUID,
  scheduled_date DATE NOT NULL,
  due_period_key TEXT,
  assigned_workstream_id UUID REFERENCES gotzinger_cp_workstreams(id),
  assigned_user_id UUID,
  status TEXT DEFAULT 'not_started',
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  exception_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  signature_data JSONB
);

CREATE TABLE gotzinger_cp_task_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_instance_id UUID REFERENCES gotzinger_cp_task_instances(id),
  photo_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  caption TEXT
);

-- Enable RLS (Assuming they want standard auth)
ALTER TABLE gotzinger_cp_workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE gotzinger_cp_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gotzinger_cp_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gotzinger_cp_task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE gotzinger_cp_task_photos ENABLE ROW LEVEL SECURITY;

-- Add basic open policies for authenticated users for simplicity
CREATE POLICY "Enable read for authenticated users" ON gotzinger_cp_workstreams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON gotzinger_cp_workstreams FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users" ON gotzinger_cp_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON gotzinger_cp_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users" ON gotzinger_cp_task_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON gotzinger_cp_task_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users" ON gotzinger_cp_task_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON gotzinger_cp_task_instances FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users" ON gotzinger_cp_task_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON gotzinger_cp_task_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
