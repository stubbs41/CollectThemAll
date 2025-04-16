-- Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_id TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add indexes for email_logs
CREATE INDEX IF NOT EXISTS email_logs_user_id_idx ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS email_logs_status_idx ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx ON public.email_logs(created_at);

-- Add RLS policies for email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own email logs
CREATE POLICY "Users can view their own email logs"
  ON public.email_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Create comments table
CREATE TABLE IF NOT EXISTS public.collection_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_id TEXT NOT NULL REFERENCES public.shared_collections(share_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  comment TEXT NOT NULL,
  parent_id UUID REFERENCES public.collection_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  is_deleted BOOLEAN DEFAULT false NOT NULL,
  
  -- Either user_id or guest_name must be provided
  CONSTRAINT user_or_guest_required CHECK (
    (user_id IS NOT NULL) OR (guest_name IS NOT NULL)
  )
);

-- Add indexes for comments
CREATE INDEX IF NOT EXISTS collection_comments_share_id_idx ON public.collection_comments(share_id);
CREATE INDEX IF NOT EXISTS collection_comments_user_id_idx ON public.collection_comments(user_id);
CREATE INDEX IF NOT EXISTS collection_comments_parent_id_idx ON public.collection_comments(parent_id);
CREATE INDEX IF NOT EXISTS collection_comments_created_at_idx ON public.collection_comments(created_at);

-- Add RLS policies for comments
ALTER TABLE public.collection_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can view comments on a shared collection
CREATE POLICY "Anyone can view comments on a shared collection"
  ON public.collection_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_collections
      WHERE share_id = collection_comments.share_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- Users can create comments on shared collections that allow comments
CREATE POLICY "Users can create comments on shared collections that allow comments"
  ON public.collection_comments
  FOR INSERT
  WITH CHECK (
    -- Check if the shared collection exists, is active, and allows comments
    EXISTS (
      SELECT 1 FROM public.shared_collections
      WHERE share_id = collection_comments.share_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
      AND allow_comments = true
    )
    -- If user is authenticated, user_id must match auth.uid()
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR
      (auth.uid() IS NULL AND user_id IS NULL AND guest_name IS NOT NULL)
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
  ON public.collection_comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON public.collection_comments
  FOR DELETE
  USING (user_id = auth.uid());

-- Collection owners can delete any comments on their collections
CREATE POLICY "Collection owners can delete any comments on their collections"
  ON public.collection_comments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_collections
      WHERE share_id = collection_comments.share_id
      AND user_id = auth.uid()
    )
  );

-- Create analytics table for shared collections
CREATE TABLE IF NOT EXISTS public.collection_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_id TEXT NOT NULL REFERENCES public.shared_collections(share_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'view', 'comment', 'download', etc.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  metadata JSONB
);

-- Add indexes for analytics
CREATE INDEX IF NOT EXISTS collection_analytics_share_id_idx ON public.collection_analytics(share_id);
CREATE INDEX IF NOT EXISTS collection_analytics_event_type_idx ON public.collection_analytics(event_type);
CREATE INDEX IF NOT EXISTS collection_analytics_user_id_idx ON public.collection_analytics(user_id);
CREATE INDEX IF NOT EXISTS collection_analytics_created_at_idx ON public.collection_analytics(created_at);

-- Add RLS policies for analytics
ALTER TABLE public.collection_analytics ENABLE ROW LEVEL SECURITY;

-- Anyone can create analytics events
CREATE POLICY "Anyone can create analytics events"
  ON public.collection_analytics
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_collections
      WHERE share_id = collection_analytics.share_id
      AND status = 'active'
    )
  );

-- Only collection owners can view analytics
CREATE POLICY "Collection owners can view analytics"
  ON public.collection_analytics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_collections
      WHERE share_id = collection_analytics.share_id
      AND user_id = auth.uid()
    )
  );

-- Add function to track collection view
CREATE OR REPLACE FUNCTION public.track_collection_view(
  p_share_id TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_ip_address TEXT;
BEGIN
  -- Get current user ID if authenticated
  SELECT auth.uid() INTO v_user_id;
  
  -- Get IP address (in a real implementation, this would come from the request)
  v_ip_address := '0.0.0.0';
  
  -- Insert the analytics event
  INSERT INTO public.collection_analytics (
    share_id,
    event_type,
    user_id,
    ip_address,
    user_agent,
    referrer
  ) VALUES (
    p_share_id,
    'view',
    v_user_id,
    v_ip_address,
    p_user_agent,
    p_referrer
  );
  
  -- Update view count in shared_collections
  UPDATE public.shared_collections
  SET view_count = view_count + 1
  WHERE share_id = p_share_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add allow_comments column to shared_collections if it doesn't exist
ALTER TABLE public.shared_collections
ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT false;
