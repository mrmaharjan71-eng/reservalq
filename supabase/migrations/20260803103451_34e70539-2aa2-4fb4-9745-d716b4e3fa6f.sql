-- Helper: is this user any kind of staff?
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- Helper: does this user have any of the given roles?
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- ===== guests =====
DROP POLICY IF EXISTS "staff manage guests" ON public.guests;
CREATE POLICY "front office read guests" ON public.guests FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist','finance']::app_role[]));
CREATE POLICY "front office insert guests" ON public.guests FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::app_role[]));
CREATE POLICY "front office update guests" ON public.guests FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::app_role[]));
CREATE POLICY "managers delete guests" ON public.guests FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::app_role[]));

-- ===== reservations =====
DROP POLICY IF EXISTS "staff manage reservations" ON public.reservations;
CREATE POLICY "front office read reservations" ON public.reservations FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist','finance']::app_role[]));
CREATE POLICY "front office insert reservations" ON public.reservations FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::app_role[]));
CREATE POLICY "front office update reservations" ON public.reservations FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::app_role[]));
CREATE POLICY "managers delete reservations" ON public.reservations FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::app_role[]));

-- ===== rooms =====
DROP POLICY IF EXISTS "staff manage rooms" ON public.rooms;
CREATE POLICY "staff read rooms" ON public.rooms FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "ops insert rooms" ON public.rooms FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::app_role[]));
CREATE POLICY "ops update rooms" ON public.rooms FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','housekeeping','maintenance']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','housekeeping','maintenance']::app_role[]));
CREATE POLICY "admins delete rooms" ON public.rooms FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ===== housekeeping_tasks =====
DROP POLICY IF EXISTS "staff manage housekeeping" ON public.housekeeping_tasks;
CREATE POLICY "staff read housekeeping" ON public.housekeeping_tasks FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "ops insert housekeeping" ON public.housekeeping_tasks FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist','housekeeping','maintenance']::app_role[]));
CREATE POLICY "ops update housekeeping" ON public.housekeeping_tasks FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','housekeeping','maintenance']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','housekeeping','maintenance']::app_role[]));
CREATE POLICY "managers delete housekeeping" ON public.housekeeping_tasks FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::app_role[]));

-- ===== ai_actions =====
DROP POLICY IF EXISTS "staff manage ai actions" ON public.ai_actions;
CREATE POLICY "staff read ai actions" ON public.ai_actions FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "front office insert ai actions" ON public.ai_actions FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::app_role[]));
CREATE POLICY "front office decide ai actions" ON public.ai_actions FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::app_role[]));
CREATE POLICY "admins delete ai actions" ON public.ai_actions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ===== audit_logs =====
DROP POLICY IF EXISTS "staff read audit" ON public.audit_logs;
DROP POLICY IF EXISTS "staff write audit" ON public.audit_logs;
CREATE POLICY "managers read audit" ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::app_role[]));
CREATE POLICY "staff append own audit" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND actor = auth.uid());

-- ===== profiles =====
DROP POLICY IF EXISTS "staff read profiles" ON public.profiles;
CREATE POLICY "read own or managers read profiles" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::app_role[]));

-- ===== user_roles =====
DROP POLICY IF EXISTS "staff read roles" ON public.user_roles;
CREATE POLICY "read own roles or admin" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- ===== definer function exposure =====
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;