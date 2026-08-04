ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_manager';

CREATE TABLE IF NOT EXISTS public.hotel_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_knowledge TO authenticated;
GRANT ALL ON public.hotel_knowledge TO service_role;

ALTER TABLE public.hotel_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read knowledge" ON public.hotel_knowledge
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

CREATE POLICY "managers insert knowledge" ON public.hotel_knowledge
  FOR INSERT TO authenticated
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'front_desk_manager'::public.app_role]));

CREATE POLICY "managers update knowledge" ON public.hotel_knowledge
  FOR UPDATE TO authenticated
  USING (private.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'front_desk_manager'::public.app_role]))
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'front_desk_manager'::public.app_role]));

CREATE POLICY "managers delete knowledge" ON public.hotel_knowledge
  FOR DELETE TO authenticated
  USING (private.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'front_desk_manager'::public.app_role]));

CREATE TRIGGER hotel_knowledge_touch BEFORE UPDATE ON public.hotel_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();