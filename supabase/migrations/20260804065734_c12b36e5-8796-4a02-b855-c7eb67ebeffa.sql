CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND (role = _role OR role::text = 'owner')
  )
$$;

CREATE OR REPLACE FUNCTION private.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = ANY(_roles)
        OR role::text = 'owner'
        OR (role::text = 'sales_manager'
            AND _roles::text[] && ARRAY['front_desk_manager','receptionist','finance'])
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE requested text;
BEGIN
  INSERT INTO public.profiles (id, full_name, job_title)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name','New staff member'),
          COALESCE(NEW.raw_user_meta_data->>'job_title','Front Desk'));

  requested := NEW.raw_user_meta_data->>'role';
  IF requested IS NULL OR requested NOT IN
     ('owner','admin','front_desk_manager','sales_manager','receptionist','housekeeping','maintenance','finance') THEN
    requested := 'receptionist';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested::public.app_role);
  RETURN NEW;
END; $$;