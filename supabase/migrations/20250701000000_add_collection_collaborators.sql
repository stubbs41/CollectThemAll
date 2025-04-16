-- Create collection_collaborators table
CREATE TABLE IF NOT EXISTS public.collection_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_group_id UUID NOT NULL REFERENCES public.collection_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'read', -- 'read', 'write', 'admin'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  
  -- Add a unique constraint to prevent duplicate collaborators per collection group
  UNIQUE(collection_group_id, user_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS collection_collaborators_user_id_idx ON public.collection_collaborators(user_id);
CREATE INDEX IF NOT EXISTS collection_collaborators_email_idx ON public.collection_collaborators(email);
CREATE INDEX IF NOT EXISTS collection_collaborators_status_idx ON public.collection_collaborators(status);

-- Add comments
COMMENT ON TABLE public.collection_collaborators IS 'Stores collaborators for collection groups';
COMMENT ON COLUMN public.collection_collaborators.collection_group_id IS 'ID of the collection group';
COMMENT ON COLUMN public.collection_collaborators.user_id IS 'ID of the collaborator user';
COMMENT ON COLUMN public.collection_collaborators.invited_by IS 'ID of the user who invited the collaborator';
COMMENT ON COLUMN public.collection_collaborators.email IS 'Email of the collaborator';
COMMENT ON COLUMN public.collection_collaborators.permission_level IS 'Permission level: read, write, admin';
COMMENT ON COLUMN public.collection_collaborators.status IS 'Status of the invitation: pending, accepted, declined';
COMMENT ON COLUMN public.collection_collaborators.last_accessed_at IS 'Last time the collaborator accessed the collection';

-- Add RLS policies
ALTER TABLE public.collection_collaborators ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see collaborators for collections they own or collaborate on
CREATE POLICY "Users can view collaborators for their collections"
  ON public.collection_collaborators
  FOR SELECT
  USING (
    -- User is the owner of the collection group
    EXISTS (
      SELECT 1 FROM public.collection_groups
      WHERE id = collection_group_id AND user_id = auth.uid()
    )
    OR
    -- User is a collaborator on the collection group
    user_id = auth.uid()
  );

-- Policy to allow collection owners to manage collaborators
CREATE POLICY "Collection owners can manage collaborators"
  ON public.collection_collaborators
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.collection_groups
      WHERE id = collection_group_id AND user_id = auth.uid()
    )
  );

-- Policy to allow collaborators to update their own status
CREATE POLICY "Collaborators can update their own status"
  ON public.collection_collaborators
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid() AND
    (NEW.status = 'accepted' OR NEW.status = 'declined') AND
    OLD.status = 'pending'
  );

-- Add function to check if a user has permission to a collection group
CREATE OR REPLACE FUNCTION public.check_collection_permission(
  p_collection_group_id UUID,
  p_user_id UUID,
  p_required_permission TEXT DEFAULT 'read'
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_permission_level TEXT;
BEGIN
  -- Check if user is the owner
  SELECT EXISTS (
    SELECT 1 FROM public.collection_groups
    WHERE id = p_collection_group_id AND user_id = p_user_id
  ) INTO v_is_owner;
  
  -- If user is the owner, they have all permissions
  IF v_is_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Check collaborator permission level
  SELECT permission_level INTO v_permission_level
  FROM public.collection_collaborators
  WHERE collection_group_id = p_collection_group_id 
    AND user_id = p_user_id
    AND status = 'accepted';
  
  -- If no permission found, return false
  IF v_permission_level IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check permission level
  RETURN CASE
    WHEN p_required_permission = 'read' THEN TRUE -- All levels can read
    WHEN p_required_permission = 'write' AND v_permission_level IN ('write', 'admin') THEN TRUE
    WHEN p_required_permission = 'admin' AND v_permission_level = 'admin' THEN TRUE
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get all collections a user has access to
CREATE OR REPLACE FUNCTION public.get_accessible_collections(p_user_id UUID)
RETURNS TABLE (
  collection_group_id UUID,
  collection_group_name TEXT,
  permission_level TEXT
) AS $$
BEGIN
  -- Return collections owned by the user
  RETURN QUERY
  SELECT 
    cg.id AS collection_group_id,
    cg.name AS collection_group_name,
    'owner'::TEXT AS permission_level
  FROM public.collection_groups cg
  WHERE cg.user_id = p_user_id
  
  UNION
  
  -- Return collections the user collaborates on
  SELECT 
    cg.id AS collection_group_id,
    cg.name AS collection_group_name,
    cc.permission_level
  FROM public.collection_collaborators cc
  JOIN public.collection_groups cg ON cc.collection_group_id = cg.id
  WHERE cc.user_id = p_user_id AND cc.status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the shared_collections table to add collaboration fields
ALTER TABLE public.shared_collections
ADD COLUMN IF NOT EXISTS is_collaborative BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.shared_collections
ADD COLUMN IF NOT EXISTS password_protected BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.shared_collections
ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN public.shared_collections.is_collaborative IS 'Whether the share allows collaborative editing';
COMMENT ON COLUMN public.shared_collections.password_protected IS 'Whether the share is password protected';
COMMENT ON COLUMN public.shared_collections.password_hash IS 'Hashed password for protected shares';

-- Add a table to track user presence in collections
CREATE TABLE IF NOT EXISTS public.collection_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_group_id UUID NOT NULL REFERENCES public.collection_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  status TEXT NOT NULL DEFAULT 'online', -- 'online', 'away', 'offline'
  
  -- Add a unique constraint to prevent duplicate presence records
  UNIQUE(collection_group_id, user_id)
);

CREATE INDEX IF NOT EXISTS collection_presence_collection_group_id_idx ON public.collection_presence(collection_group_id);
CREATE INDEX IF NOT EXISTS collection_presence_user_id_idx ON public.collection_presence(user_id);
CREATE INDEX IF NOT EXISTS collection_presence_status_idx ON public.collection_presence(status);

COMMENT ON TABLE public.collection_presence IS 'Tracks user presence in collection groups';
COMMENT ON COLUMN public.collection_presence.collection_group_id IS 'ID of the collection group';
COMMENT ON COLUMN public.collection_presence.user_id IS 'ID of the user';
COMMENT ON COLUMN public.collection_presence.last_active_at IS 'Last time the user was active in the collection';
COMMENT ON COLUMN public.collection_presence.status IS 'Status of the user: online, away, offline';

-- Add RLS policies for presence
ALTER TABLE public.collection_presence ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see presence for collections they have access to
CREATE POLICY "Users can view presence for accessible collections"
  ON public.collection_presence
  FOR SELECT
  USING (
    public.check_collection_permission(collection_group_id, auth.uid(), 'read')
  );

-- Policy to allow users to update their own presence
CREATE POLICY "Users can update their own presence"
  ON public.collection_presence
  FOR ALL
  USING (user_id = auth.uid());

-- Function to update user presence
CREATE OR REPLACE FUNCTION public.update_user_presence(
  p_collection_group_id UUID,
  p_status TEXT DEFAULT 'online'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.collection_presence (collection_group_id, user_id, status, last_active_at)
  VALUES (p_collection_group_id, auth.uid(), p_status, now())
  ON CONFLICT (collection_group_id, user_id)
  DO UPDATE SET 
    status = p_status,
    last_active_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up stale presence records (run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_stale_presence() RETURNS VOID AS $$
BEGIN
  -- Mark users as away if inactive for 5 minutes
  UPDATE public.collection_presence
  SET status = 'away'
  WHERE status = 'online' AND last_active_at < now() - INTERVAL '5 minutes';
  
  -- Mark users as offline if inactive for 30 minutes
  UPDATE public.collection_presence
  SET status = 'offline'
  WHERE status IN ('online', 'away') AND last_active_at < now() - INTERVAL '30 minutes';
  
  -- Delete offline records older than 24 hours
  DELETE FROM public.collection_presence
  WHERE status = 'offline' AND last_active_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
