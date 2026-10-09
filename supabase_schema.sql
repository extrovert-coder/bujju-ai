-- Supabase PostgreSQL Schema for Bujju AI with User Authentication & RLS
-- Run this in your Supabase SQL Editor: Dashboard -> SQL Editor -> New Query -> Run

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create or update conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure user_id column exists if table was already created in Step 4
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.conversations
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Create or update messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'ai', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. Conversations RLS Policies (User-Specific)
DROP POLICY IF EXISTS "Allow anonymous read access to conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow anonymous insert access to conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow anonymous update access to conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow anonymous delete access to conversations" ON public.conversations;

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
CREATE POLICY "Users can insert own conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations"
  ON public.conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Messages RLS Policies (Scoped via conversation ownership)
DROP POLICY IF EXISTS "Allow anonymous read access to messages" ON public.messages;
DROP POLICY IF EXISTS "Allow anonymous insert access to messages" ON public.messages;
DROP POLICY IF EXISTS "Allow anonymous delete access to messages" ON public.messages;

DROP POLICY IF EXISTS "Users can view messages from own conversations" ON public.messages;
CREATE POLICY "Users can view messages from own conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE public.conversations.id = public.messages.conversation_id
      AND public.conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert messages into own conversations" ON public.messages;
CREATE POLICY "Users can insert messages into own conversations"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE public.conversations.id = public.messages.conversation_id
      AND public.conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete messages from own conversations" ON public.messages;
CREATE POLICY "Users can delete messages from own conversations"
  ON public.messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE public.conversations.id = public.messages.conversation_id
      AND public.conversations.user_id = auth.uid()
    )
  );

-- 7. Create files table
CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  extracted_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user_id on files table
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);

-- Enable RLS on files
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Files RLS Policies (User-Specific: SELECT, INSERT, DELETE)
DROP POLICY IF EXISTS "Users can view own files" ON public.files;
CREATE POLICY "Users can view own files"
  ON public.files FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
CREATE POLICY "Users can insert own files"
  ON public.files FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own files" ON public.files;
CREATE POLICY "Users can delete own files"
  ON public.files FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 8. Add file reference to conversations table for chat history persistence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'file_id'
  ) THEN
    ALTER TABLE public.conversations
    ADD COLUMN file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE public.conversations
    ADD COLUMN file_name TEXT;
  END IF;
END $$;

-- 9. Create user_usage table for tracking server-authoritative daily message limits
CREATE TABLE IF NOT EXISTS public.user_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_user_date ON public.user_usage(user_id, usage_date);

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage" ON public.user_usage;
CREATE POLICY "Users can view own usage"
  ON public.user_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own usage" ON public.user_usage;
CREATE POLICY "Users can insert own usage"
  ON public.user_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own usage" ON public.user_usage;
CREATE POLICY "Users can update own usage"
  ON public.user_usage FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

