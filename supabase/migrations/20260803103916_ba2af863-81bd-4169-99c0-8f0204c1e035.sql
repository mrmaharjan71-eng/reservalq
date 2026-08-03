CREATE TABLE public.guest_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_label text NOT NULL DEFAULT 'Guest',
  reference text NOT NULL DEFAULT '',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.guest_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.guest_chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('guest','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guest_chat_messages_session_idx ON public.guest_chat_messages(session_id, created_at);

GRANT SELECT ON public.guest_chat_sessions TO authenticated;
GRANT SELECT ON public.guest_chat_messages TO authenticated;
GRANT ALL ON public.guest_chat_sessions TO service_role;
GRANT ALL ON public.guest_chat_messages TO service_role;

ALTER TABLE public.guest_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers read guest chat sessions" ON public.guest_chat_sessions
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]));

CREATE POLICY "managers read guest chat messages" ON public.guest_chat_messages
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]));

CREATE TRIGGER guest_chat_sessions_touch
BEFORE UPDATE ON public.guest_chat_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();