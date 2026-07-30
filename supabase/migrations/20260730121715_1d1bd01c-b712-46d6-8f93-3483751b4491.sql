-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','front_desk_manager','receptionist','housekeeping','maintenance','finance');
CREATE TYPE public.room_condition AS ENUM ('clean','dirty','inspected','out_of_order');
CREATE TYPE public.reservation_status AS ENUM ('pending','confirmed','checked_in','checked_out','cancelled','no_show');
CREATE TYPE public.task_status AS ENUM ('pending','in_progress','completed','blocked');
CREATE TYPE public.ai_action_status AS ENUM ('proposed','approved','rejected','executed');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'New staff member',
  job_title TEXT NOT NULL DEFAULT 'Front Desk',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "staff read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, job_title)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name','New staff member'),
          COALESCE(NEW.raw_user_meta_data->>'job_title','Front Desk'));
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'receptionist'::public.app_role END);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ROOM TYPES
CREATE TABLE public.room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_occupancy INT NOT NULL DEFAULT 2,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_types TO authenticated;
GRANT ALL ON public.room_types TO service_role;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read room types" ON public.room_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers write room types" ON public.room_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'front_desk_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'front_desk_manager'));

-- ROOMS
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL UNIQUE,
  room_type_id UUID NOT NULL REFERENCES public.room_types ON DELETE RESTRICT,
  floor INT NOT NULL DEFAULT 1,
  condition public.room_condition NOT NULL DEFAULT 'clean',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage rooms" ON public.rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- GUESTS
CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nationality TEXT,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  loyalty_tier TEXT NOT NULL DEFAULT 'standard',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guests TO authenticated;
GRANT ALL ON public.guests TO service_role;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage guests" ON public.guests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RESERVATIONS
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('RSV-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  guest_id UUID NOT NULL REFERENCES public.guests ON DELETE RESTRICT,
  room_id UUID REFERENCES public.rooms ON DELETE SET NULL,
  room_type_id UUID NOT NULL REFERENCES public.room_types ON DELETE RESTRICT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  adults INT NOT NULL DEFAULT 1,
  children INT NOT NULL DEFAULT 0,
  nightly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.reservation_status NOT NULL DEFAULT 'pending',
  channel TEXT NOT NULL DEFAULT 'front_desk',
  special_requests TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage reservations" ON public.reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX reservations_dates_idx ON public.reservations (check_in, check_out);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER reservations_touch BEFORE UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- HOUSEKEEPING
CREATE TABLE public.housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms ON DELETE CASCADE,
  task_type TEXT NOT NULL DEFAULT 'departure_clean',
  priority INT NOT NULL DEFAULT 2,
  status public.task_status NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.housekeeping_tasks TO authenticated;
GRANT ALL ON public.housekeeping_tasks TO service_role;
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage housekeeping" ON public.housekeeping_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AI ACTION QUEUE
CREATE TABLE public.ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  reasoning TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.8,
  status public.ai_action_status NOT NULL DEFAULT 'proposed',
  reservation_id UUID REFERENCES public.reservations ON DELETE SET NULL,
  decided_by UUID REFERENCES auth.users ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_actions TO authenticated;
GRANT ALL ON public.ai_actions TO service_role;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage ai actions" ON public.ai_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AUDIT LOG
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor UUID REFERENCES auth.users ON DELETE SET NULL,
  actor_label TEXT NOT NULL DEFAULT 'system',
  entity TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read audit" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff write audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- SEED DATA
INSERT INTO public.room_types (code,name,description,base_rate,max_occupancy,amenities) VALUES
 ('SGL','Single','Compact room with a single bed, ideal for solo business travellers.',120.00,1,ARRAY['Wi-Fi','Desk','Smart TV']),
 ('DBL','Double','Comfortable room with a queen bed and city view.',165.00,2,ARRAY['Wi-Fi','Minibar','Smart TV','Coffee machine']),
 ('TWN','Twin','Two single beds, popular with colleagues travelling together.',170.00,2,ARRAY['Wi-Fi','Desk','Smart TV']),
 ('DLX','Deluxe','Spacious deluxe room with lounge chair and rainfall shower.',235.00,3,ARRAY['Wi-Fi','Minibar','Bathrobe','Nespresso','Rainfall shower']),
 ('STE','Suite','Separate living area, king bed and premium amenities.',380.00,4,ARRAY['Wi-Fi','Living room','Minibar','Bathtub','Butler service']),
 ('EXE','Executive Suite','Executive lounge access with panoramic views.',520.00,4,ARRAY['Wi-Fi','Lounge access','Workspace','Bathtub','Butler service']),
 ('FAM','Family Room','Two connected rooms designed for families with children.',310.00,5,ARRAY['Wi-Fi','Connecting rooms','Kids amenities','Smart TV']),
 ('PRS','Presidential Suite','Top floor residence with private terrace and dining room.',1150.00,6,ARRAY['Wi-Fi','Private terrace','Dining room','Butler service','Chauffeur']);

INSERT INTO public.rooms (room_number, room_type_id, floor, condition) VALUES
 ('101',(SELECT id FROM public.room_types WHERE code='SGL'),1,'clean'),
 ('102',(SELECT id FROM public.room_types WHERE code='SGL'),1,'dirty'),
 ('103',(SELECT id FROM public.room_types WHERE code='DBL'),1,'clean'),
 ('104',(SELECT id FROM public.room_types WHERE code='DBL'),1,'inspected'),
 ('105',(SELECT id FROM public.room_types WHERE code='TWN'),1,'clean'),
 ('201',(SELECT id FROM public.room_types WHERE code='DBL'),2,'clean'),
 ('202',(SELECT id FROM public.room_types WHERE code='TWN'),2,'dirty'),
 ('203',(SELECT id FROM public.room_types WHERE code='DLX'),2,'clean'),
 ('204',(SELECT id FROM public.room_types WHERE code='DLX'),2,'out_of_order'),
 ('205',(SELECT id FROM public.room_types WHERE code='FAM'),2,'clean'),
 ('301',(SELECT id FROM public.room_types WHERE code='DLX'),3,'clean'),
 ('302',(SELECT id FROM public.room_types WHERE code='STE'),3,'clean'),
 ('303',(SELECT id FROM public.room_types WHERE code='STE'),3,'dirty'),
 ('304',(SELECT id FROM public.room_types WHERE code='FAM'),3,'clean'),
 ('401',(SELECT id FROM public.room_types WHERE code='EXE'),4,'clean'),
 ('402',(SELECT id FROM public.room_types WHERE code='EXE'),4,'inspected'),
 ('403',(SELECT id FROM public.room_types WHERE code='STE'),4,'clean'),
 ('501',(SELECT id FROM public.room_types WHERE code='PRS'),5,'clean');

INSERT INTO public.guests (full_name,email,phone,nationality,is_vip,loyalty_tier,notes) VALUES
 ('Amara Okonkwo','amara.okonkwo@example.com','+234 803 555 0142','Nigeria',true,'platinum','Prefers high floor, allergic to feather pillows.'),
 ('Lars Bergstrom','lars.bergstrom@example.com','+46 70 555 0198','Sweden',false,'gold','Late arrival, usually after 22:00.'),
 ('Priya Raghunathan','priya.r@example.com','+91 98200 55512','India',false,'standard','Vegetarian breakfast.'),
 ('Tomás Herrera','tomas.herrera@example.com','+34 611 555 044','Spain',false,'silver',''),
 ('Grace Whitfield','grace.whitfield@example.com','+44 7700 900321','United Kingdom',true,'platinum','Corporate account — Whitfield Legal.'),
 ('Kenji Nakamura','kenji.nakamura@example.com','+81 90 5555 1122','Japan',false,'gold','Quiet room away from lifts.');

INSERT INTO public.reservations (guest_id, room_id, room_type_id, check_in, check_out, adults, children, nightly_rate, total_amount, balance_due, status, channel, special_requests) VALUES
 ((SELECT id FROM public.guests WHERE email='amara.okonkwo@example.com'),(SELECT id FROM public.rooms WHERE room_number='501'),(SELECT id FROM public.room_types WHERE code='PRS'), CURRENT_DATE, CURRENT_DATE + 3, 2, 0, 1150.00, 3450.00, 0.00, 'checked_in','direct','Airport pickup arranged.'),
 ((SELECT id FROM public.guests WHERE email='lars.bergstrom@example.com'),(SELECT id FROM public.rooms WHERE room_number='203'),(SELECT id FROM public.room_types WHERE code='DLX'), CURRENT_DATE, CURRENT_DATE + 2, 1, 0, 235.00, 470.00, 470.00, 'confirmed','booking.com','Late check-in.'),
 ((SELECT id FROM public.guests WHERE email='priya.r@example.com'),NULL,(SELECT id FROM public.room_types WHERE code='DBL'), CURRENT_DATE + 1, CURRENT_DATE + 5, 2, 1, 165.00, 660.00, 660.00, 'confirmed','website','Vegetarian breakfast, cot required.'),
 ((SELECT id FROM public.guests WHERE email='tomas.herrera@example.com'),(SELECT id FROM public.rooms WHERE room_number='105'),(SELECT id FROM public.room_types WHERE code='TWN'), CURRENT_DATE - 2, CURRENT_DATE, 2, 0, 170.00, 340.00, 0.00, 'checked_in','expedia',''),
 ((SELECT id FROM public.guests WHERE email='grace.whitfield@example.com'),(SELECT id FROM public.rooms WHERE room_number='401'),(SELECT id FROM public.room_types WHERE code='EXE'), CURRENT_DATE + 2, CURRENT_DATE + 6, 1, 0, 520.00, 2080.00, 2080.00, 'confirmed','corporate','Invoice to Whitfield Legal.'),
 ((SELECT id FROM public.guests WHERE email='kenji.nakamura@example.com'),NULL,(SELECT id FROM public.room_types WHERE code='STE'), CURRENT_DATE + 4, CURRENT_DATE + 7, 2, 0, 380.00, 1140.00, 1140.00, 'pending','website','Quiet room requested.');

INSERT INTO public.housekeeping_tasks (room_id, task_type, priority, status, notes) VALUES
 ((SELECT id FROM public.rooms WHERE room_number='102'),'departure_clean',1,'pending','Guest departed early.'),
 ((SELECT id FROM public.rooms WHERE room_number='202'),'departure_clean',2,'in_progress',''),
 ((SELECT id FROM public.rooms WHERE room_number='303'),'deep_clean',1,'pending','Suite turndown before VIP arrival.'),
 ((SELECT id FROM public.rooms WHERE room_number='204'),'maintenance',1,'blocked','Air conditioning unit awaiting parts.');

INSERT INTO public.ai_actions (action_type, summary, reasoning, confidence, status, payload) VALUES
 ('room_assignment','Assign room 301 (Deluxe) to Priya Raghunathan','Reservation is unassigned, arrives tomorrow. Room 301 is clean, matches the booked Deluxe-adjacent category at no extra cost, and is away from the lift shaft which suits a family with an infant.',0.910,'proposed','{}'::jsonb),
 ('upsell','Offer Kenji Nakamura an Executive Suite upgrade at +£90/night','Suite inventory is 60% committed for those dates while Executive rooms sit at 25%. Guest is Gold tier with two prior suite stays, giving a high historical acceptance rate.',0.740,'proposed','{}'::jsonb),
 ('housekeeping','Prioritise room 303 deep clean before 14:00','VIP arrival Grace Whitfield is scheduled in two days, and the suite requires a deep clean plus inspection cycle which historically takes 4 hours.',0.880,'proposed','{}'::jsonb),
 ('risk','Flag reservation for Lars Bergstrom as no-show risk','Booking.com channel, no deposit taken, late arrival pattern and a prior no-show 11 months ago. Recommend a confirmation call before 18:00.',0.660,'proposed','{}'::jsonb);