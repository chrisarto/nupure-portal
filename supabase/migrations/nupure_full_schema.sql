-- =============================================================================
-- Nu-Pure Beverages Compliance Portal — Full Database Schema (Self-Hosted Supabase)
-- Completely isolated from Gotzinger & all other client portals
-- =============================================================================

-- 1. Core Airtable-Synced / JSONB Tables
CREATE TABLE IF NOT EXISTS public.nupure_sanitation_tasks (
    airtable_id text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    synced_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_schedule_events (
    airtable_id text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    synced_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_training_documents (
    airtable_id text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    synced_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_training_records (
    airtable_id text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    synced_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_employees (
    airtable_id text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    synced_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_handover_reports (
    airtable_id text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    synced_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_pre_op_reports (
    airtable_id text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    synced_at timestamp with time zone DEFAULT now()
);

-- 2. Dynamic Forms, Submissions & Email Settings
CREATE TABLE IF NOT EXISTS public.nupure_form_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    description text DEFAULT ''::text,
    form_type text DEFAULT 'inspection'::text NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.nupure_form_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.nupure_form_templates(id) ON DELETE CASCADE,
    template_slug text NOT NULL,
    template_name text NOT NULL,
    submitted_by text DEFAULT ''::text,
    submitted_by_email text DEFAULT ''::text,
    site text DEFAULT 'Nu-Pure Beverages'::text,
    area text DEFAULT ''::text,
    responses jsonb DEFAULT '{}'::jsonb NOT NULL,
    score_total integer,
    score_pass integer,
    score_fail integer,
    score_reclean integer,
    overall_score numeric,
    status text DEFAULT 'draft'::text NOT NULL,
    pdf_url text,
    notes text DEFAULT ''::text,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    section_scores jsonb DEFAULT '{}'::jsonb,
    reclean_signed_off_by text,
    reclean_signed_off_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.nupure_email_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type text NOT NULL UNIQUE,
    report_label text NOT NULL,
    recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
    send_on_submit boolean DEFAULT true NOT NULL,
    send_on_fail_only boolean DEFAULT false NOT NULL,
    fail_threshold integer DEFAULT 85 NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by text
);

-- 3. Corporate Documents, Meeting Minutes, Swab Roll-Ups & SOP Machine Mapping
CREATE TABLE IF NOT EXISTS public.nupure_corporate_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    category text NOT NULL,
    description text,
    file_name text NOT NULL,
    storage_path text NOT NULL,
    file_size bigint,
    file_type text,
    version integer DEFAULT 1,
    uploaded_by text,
    expiry_date date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_meeting_minutes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text,
    meeting_date date NOT NULL,
    file_url text NOT NULL,
    file_name text NOT NULL,
    file_size bigint,
    file_type text,
    uploaded_by text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_swab_rollup_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    report_type text NOT NULL DEFAULT 'weekly',
    period_start date,
    period_end date,
    period_label text,
    file_url text NOT NULL,
    file_name text NOT NULL,
    file_size bigint,
    file_type text,
    uploaded_by text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_machine_mapping (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    area_room text NOT NULL,
    machine_equipment text NOT NULL,
    risk_area text DEFAULT '',
    component text DEFAULT '',
    is_food_contact boolean DEFAULT false,
    cleaning_responsibility text DEFAULT '',
    dismantle_required boolean DEFAULT false,
    who_dismantles text DEFAULT '',
    parts_removed text DEFAULT '',
    reassembly_by text DEFAULT '',
    isolation_required boolean DEFAULT false,
    energy_sources jsonb DEFAULT '[]'::jsonb,
    isolation_point text DEFAULT '',
    lockout_required boolean DEFAULT false,
    who_applies_locks text DEFAULT '',
    try_test_method text DEFAULT '',
    cleaning_method_type text DEFAULT '',
    gross_soil_removal text DEFAULT '',
    pre_rinse text DEFAULT '',
    detergent_chemical text DEFAULT '',
    concentration text DEFAULT '',
    temperature text DEFAULT '',
    contact_time text DEFAULT '',
    mechanical_action text DEFAULT '',
    rinse_step text DEFAULT '',
    sanitiser text DEFAULT '',
    final_rinse boolean DEFAULT false,
    dry_drain text DEFAULT '',
    pre_op_criteria text DEFAULT '',
    verification_method jsonb DEFAULT '[]'::jsonb,
    frequency text DEFAULT '',
    photos jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'TO COMPLETE',
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(area_room, machine_equipment)
);

-- 4. Cleaning Program Workstreams, Areas, Templates & Instances
CREATE TABLE IF NOT EXISTS public.nupure_cp_workstreams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id uuid,
    code text NOT NULL,
    display_name text NOT NULL,
    operational_label text,
    shift_days text[],
    shift_start time without time zone,
    shift_end time without time zone,
    show_task_times boolean DEFAULT false,
    scope_description text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_cp_areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id uuid,
    parent_area_id uuid REFERENCES public.nupure_cp_areas(id),
    code text,
    name text NOT NULL,
    description text,
    active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_cp_task_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id uuid,
    area_id uuid REFERENCES public.nupure_cp_areas(id),
    workstream_id uuid REFERENCES public.nupure_cp_workstreams(id),
    name text NOT NULL,
    cleaning_level text,
    frequency_type text,
    frequency_interval integer,
    occurrences_per_week integer,
    fixed_days text[],
    allowed_days text[],
    fixed_time_start time without time zone,
    fixed_time_end time without time zone,
    scheduling_constraint text,
    instructions text,
    limitation_text text,
    source_sheet text,
    source_row integer,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_cp_task_instances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid REFERENCES public.nupure_cp_task_templates(id),
    program_id uuid,
    site_id uuid,
    scheduled_date date NOT NULL,
    due_period_key text,
    assigned_workstream_id uuid REFERENCES public.nupure_cp_workstreams(id),
    assigned_user_id uuid,
    status text DEFAULT 'not_started'::text,
    completed_by uuid,
    completed_at timestamp with time zone,
    notes text,
    exception_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    signature_data jsonb
);

CREATE TABLE IF NOT EXISTS public.nupure_cp_task_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_instance_id uuid REFERENCES public.nupure_cp_task_instances(id) ON DELETE CASCADE,
    photo_type text,
    storage_path text NOT NULL,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now(),
    caption text
);

-- 5. Nu-Pure Room-by-Room Digital Cleaning Event Reports
CREATE TABLE IF NOT EXISTS public.nupure_cleaning_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_number text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    zone text NOT NULL,
    location text NOT NULL,
    frequency_badge text DEFAULT 'DAILY',
    checklist_items jsonb DEFAULT '[]'::jsonb,
    items_cleaned text,
    total_time_minutes integer DEFAULT 30,
    shift_type text DEFAULT 'Weekday (Mon–Fri)',
    cleaning_type text DEFAULT 'Scheduled Daily Hygiene Clean',
    chemicals_used jsonb DEFAULT '[]'::jsonb,
    operators_involved jsonb DEFAULT '[]'::jsonb,
    ssop_verified boolean DEFAULT true,
    visual_inspection_passed boolean DEFAULT true,
    corrective_action text,
    before_photos jsonb DEFAULT '[]'::jsonb,
    after_photos jsonb DEFAULT '[]'::jsonb,
    comments text,
    submitted_by text,
    supervisor_signoff text,
    signature_data text,
    schedule_event_id text,
    site text DEFAULT 'Nu-Pure Beverages — Stapylton'::text,
    created_at timestamp with time zone DEFAULT now()
);

-- 6. Nu-Pure Stocktake & Consumable Order System
CREATE TABLE IF NOT EXISTS public.nupure_stocktake_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL,
    item_name text NOT NULL,
    product_code text DEFAULT '',
    unit text NOT NULL,
    par_level integer DEFAULT 10 NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nupure_stocktake_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL,
    stocktake_date date DEFAULT CURRENT_DATE NOT NULL,
    conducted_by text NOT NULL,
    urgency text DEFAULT 'Standard Weekly Order'::text NOT NULL,
    recipient_emails jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_items_ordered integer DEFAULT 0 NOT NULL,
    email_sent boolean DEFAULT false NOT NULL,
    email_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- 7. Nu-Pure QR Code Issue Reporting -> Required Actions -> Completion Report
CREATE TABLE IF NOT EXISTS public.nupure_qr_issues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action_number text NOT NULL,
    zone text NOT NULL,
    area text NOT NULL,
    category text NOT NULL,
    priority text DEFAULT 'Medium'::text NOT NULL,
    description text NOT NULL,
    reported_by_name text DEFAULT ''::text,
    reported_by_email text DEFAULT ''::text,
    reported_by_phone text DEFAULT ''::text,
    issue_photos jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'open'::text NOT NULL,
    assigned_to text,
    completed_by text,
    completed_at timestamp with time zone,
    resolution_notes text,
    completion_photos jsonb DEFAULT '[]'::jsonb,
    signature_data text,
    completion_report_sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 8. Enable Row Level Security & Grant Permissions
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'nupure_%'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('GRANT ALL ON TABLE public.%I TO postgres, anon, authenticated, service_role;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Enable read access for all" ON public.%I FOR SELECT TO public USING (true);', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated users full access" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Authenticated users full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Service role full access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', tbl);
    END LOOP;
END $$;

-- Public QR Code Issue Reporting policies for anon users
DROP POLICY IF EXISTS "Anon can insert qr issues" ON public.nupure_qr_issues;
CREATE POLICY "Anon can insert qr issues" ON public.nupure_qr_issues FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can select qr issues" ON public.nupure_qr_issues;
CREATE POLICY "Anon can select qr issues" ON public.nupure_qr_issues FOR SELECT TO anon USING (true);

-- 9. Create Supabase Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
    ('nupure-attachments', 'nupure-attachments', true),
    ('documents', 'documents', true),
    ('form-photos', 'form-photos', true),
    ('cleaning-photos', 'cleaning-photos', true),
    ('issue-photos', 'issue-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Storage Policies
DROP POLICY IF EXISTS "Public read access for nupure buckets" ON storage.objects;
CREATE POLICY "Public read access for nupure buckets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('nupure-attachments', 'documents', 'form-photos', 'cleaning-photos', 'issue-photos'));

DROP POLICY IF EXISTS "Authenticated upload access for nupure buckets" ON storage.objects;
CREATE POLICY "Authenticated upload access for nupure buckets"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id IN ('nupure-attachments', 'documents', 'form-photos', 'cleaning-photos', 'issue-photos'))
WITH CHECK (bucket_id IN ('nupure-attachments', 'documents', 'form-photos', 'cleaning-photos', 'issue-photos'));

DROP POLICY IF EXISTS "Anon upload access for issue-photos" ON storage.objects;
CREATE POLICY "Anon upload access for issue-photos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'issue-photos');
