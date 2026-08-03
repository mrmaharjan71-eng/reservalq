CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles)) $$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) $$;

-- guests
DROP POLICY IF EXISTS "front office read guests" ON public.guests;
DROP POLICY IF EXISTS "front office insert guests" ON public.guests;
DROP POLICY IF EXISTS "front office update guests" ON public.guests;
DROP POLICY IF EXISTS "managers delete guests" ON public.guests;
CREATE POLICY "front office read guests" ON public.guests FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist','finance']::public.app_role[]));
CREATE POLICY "front office insert guests" ON public.guests FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::public.app_role[]));
CREATE POLICY "front office update guests" ON public.guests FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::public.app_role[]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::public.app_role[]));
CREATE POLICY "managers delete guests" ON public.guests FOR DELETE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]));

-- reservations
DROP POLICY IF EXISTS "front office read reservations" ON public.reservations;
DROP POLICY IF EXISTS "front office insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "front office update reservations" ON public.reservations;
DROP POLICY IF EXISTS "managers delete reservations" ON public.reservations;
CREATE POLICY "front office read reservations" ON public.reservations FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist','finance']::public.app_role[]));
CREATE POLICY "front office insert reservations" ON public.reservations FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::public.app_role[]));
CREATE POLICY "front office update reservations" ON public.reservations FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::public.app_role[]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::public.app_role[]));
CREATE POLICY "managers delete reservations" ON public.reservations FOR DELETE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]));

-- rooms
DROP POLICY IF EXISTS "staff read rooms" ON public.rooms;
DROP POLICY IF EXISTS "ops insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "ops update rooms" ON public.rooms;
DROP POLICY IF EXISTS "admins delete rooms" ON public.rooms;
CREATE POLICY "staff read rooms" ON public.rooms FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "ops insert rooms" ON public.rooms FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]));
CREATE POLICY "ops update rooms" ON public.rooms FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','housekeeping','maintenance']::public.app_role[]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','housekeeping','maintenance']::public.app_role[]));
CREATE POLICY "admins delete rooms" ON public.rooms FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- housekeeping_tasks
DROP POLICY IF EXISTS "staff read housekeeping" ON public.housekeeping_tasks;
DROP POLICY IF EXISTS "ops insert housekeeping" ON public.housekeeping_tasks;
DROP POLICY IF EXISTS "ops update housekeeping" ON public.housekeeping_tasks;
DROP POLICY IF EXISTS "managers delete housekeeping" ON public.housekeeping_tasks;
CREATE POLICY "staff read housekeeping" ON public.housekeeping_tasks FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "ops insert housekeeping" ON public.housekeeping_tasks FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist','housekeeping','maintenance']::public.app_role[]));
CREATE POLICY "ops update housekeeping" ON public.housekeeping_tasks FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','housekeeping','maintenance']::public.app_role[]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','housekeeping','maintenance']::public.app_role[]));
CREATE POLICY "managers delete housekeeping" ON public.housekeeping_tasks FOR DELETE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]));

-- ai_actions
DROP POLICY IF EXISTS "staff read ai actions" ON public.ai_actions;
DROP POLICY IF EXISTS "front office insert ai actions" ON public.ai_actions;
DROP POLICY IF EXISTS "front office decide ai actions" ON public.ai_actions;
DROP POLICY IF EXISTS "admins delete ai actions" ON public.ai_actions;
CREATE POLICY "staff read ai actions" ON public.ai_actions FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "front office insert ai actions" ON public.ai_actions FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::public.app_role[]));
CREATE POLICY "front office decide ai actions" ON public.ai_actions FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::public.app_role[]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager','receptionist']::public.app_role[]));
CREATE POLICY "admins delete ai actions" ON public.ai_actions FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- audit_logs
DROP POLICY IF EXISTS "managers read audit" ON public.audit_logs;
DROP POLICY IF EXISTS "staff append own audit" ON public.audit_logs;
CREATE POLICY "managers read audit" ON public.audit_logs FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]));
CREATE POLICY "staff append own audit" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (private.is_staff(auth.uid()) AND actor = auth.uid());

-- profiles
DROP POLICY IF EXISTS "read own or managers read profiles" ON public.profiles;
CREATE POLICY "read own or managers read profiles" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]));

-- user_roles
DROP POLICY IF EXISTS "read own roles or admin" ON public.user_roles;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "read own roles or admin" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- room_types
DROP POLICY IF EXISTS "managers write room types" ON public.room_types;
DROP POLICY IF EXISTS "staff read room types" ON public.room_types;
CREATE POLICY "staff read room types" ON public.room_types FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "managers insert room types" ON public.room_types FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]));
CREATE POLICY "managers update room types" ON public.room_types FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','front_desk_manager']::public.app_role[]));
CREATE POLICY "admins delete room types" ON public.room_types FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- drop now-unused public helpers
DROP FUNCTION IF EXISTS public.has_any_role(uuid, public.app_role[]);
DROP FUNCTION IF EXISTS public.is_staff(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);