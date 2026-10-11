-- ====================================================================
-- BUJJU AI - PHASE 2 SQL MIGRATION: REMINDERS & FILE TYPE SUPPORT
-- ====================================================================
-- Safe, non-destructive migration script for Supabase PostgreSQL.
-- Run this in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Run

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Ensure file_type column exists on public.files table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE public.files ADD COLUMN file_type TEXT;
  END IF;
END $$;

-- 2. Create public.user_reminders table
CREATE TABLE IF NOT EXISTS public.user_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  due_at TIMESTAMPTZ NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_user_reminders_user_id ON public.user_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reminders_due_at ON public.user_reminders(due_at ASC);
CREATE INDEX IF NOT EXISTS idx_user_reminders_completed ON public.user_reminders(completed);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.user_reminders ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies scoped strictly to authenticated owner (auth.uid() = user_id)
DROP POLICY IF EXISTS "Users can view own reminders" ON public.user_reminders;
CREATE POLICY "Users can view own reminders"
  ON public.user_reminders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reminders" ON public.user_reminders;
CREATE POLICY "Users can insert own reminders"
  ON public.user_reminders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reminders" ON public.user_reminders;
CREATE POLICY "Users can update own reminders"
  ON public.user_reminders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reminders" ON public.user_reminders;
CREATE POLICY "Users can delete own reminders"
  ON public.user_reminders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
