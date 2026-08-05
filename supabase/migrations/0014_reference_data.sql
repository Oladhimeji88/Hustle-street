-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 — Reference data.
--
-- This is genuine production data, not seed/demo data: categories, skills and
-- the Nigerian location tree the product launches with. It is idempotent, so
-- re-running a migration set never duplicates rows.
-- ═══════════════════════════════════════════════════════════════════════════

insert into categories (slug, name, description, icon, color, position, min_budget_minor) values
  ('cleaning',         'Cleaning',         'Home, office and post-construction cleaning',     'Sparkles',      'money',   1, 200000),
  ('repairs',          'Repairs',          'Plumbing, electrical, carpentry and fixes',       'Wrench',        'primary', 2, 300000),
  ('moving',           'Moving',           'Furniture, relocation and heavy lifting',         'Truck',         'primary', 3, 500000),
  ('delivery',         'Delivery',         'Pickups, dispatch and errands on wheels',         'Bike',          'warning', 4, 100000),
  ('design',           'Design',           'Graphics, branding, UI and print',                'Palette',       'accent',  5, 500000),
  ('photography',      'Photography',      'Events, portraits, product and video',            'Camera',        'accent',  6, 1000000),
  ('beauty',           'Beauty',           'Makeup, hair, nails and grooming',                'Scissors',      'accent',  7, 300000),
  ('tech',             'Tech',             'Devices, networks, software and support',         'Laptop',        'primary', 8, 300000),
  ('events',           'Events',           'Ushering, setup, catering and MCs',               'PartyPopper',   'warning', 9, 500000),
  ('tutoring',         'Tutoring',         'Lessons, exam prep and skills training',          'GraduationCap', 'money',  10, 300000),
  ('construction',     'Construction',     'Building, tiling, painting and welding',          'HardHat',       'warning',11, 1000000),
  ('home-services',    'Home Services',    'Cooking, laundry, gardening and childcare',       'House',         'money',  12, 200000),
  ('errands',          'Errands',          'Queueing, shopping and small tasks',              'ShoppingBag',   'primary',13, 100000),
  ('digital-services', 'Digital Services', 'Writing, social media, data and virtual work',    'Globe',         'accent', 14, 300000),
  ('other',            'Other',            'Anything that does not fit the list',             'CircleEllipsis','muted',  99, 100000)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      position = excluded.position;

-- ── skills, mapped to their category ───────────────────────────────────────

insert into skills (slug, name, category_id)
select s.slug, s.name, c.id
from (values
  -- Cleaning
  ('house-cleaning',      'House Cleaning',        'cleaning'),
  ('office-cleaning',     'Office Cleaning',       'cleaning'),
  ('deep-cleaning',       'Deep Cleaning',         'cleaning'),
  ('fumigation',          'Fumigation',            'cleaning'),
  ('laundry',             'Laundry & Ironing',     'cleaning'),
  -- Repairs
  ('plumbing',            'Plumbing',              'repairs'),
  ('electrical',          'Electrical Work',       'repairs'),
  ('carpentry',           'Carpentry',             'repairs'),
  ('ac-repair',           'AC Repair',             'repairs'),
  ('generator-repair',    'Generator Repair',      'repairs'),
  ('appliance-repair',    'Appliance Repair',      'repairs'),
  ('furniture-assembly',  'Furniture Assembly',    'repairs'),
  -- Moving
  ('furniture-moving',    'Furniture Moving',      'moving'),
  ('relocation',          'Home Relocation',       'moving'),
  ('loading',             'Loading & Offloading',  'moving'),
  -- Delivery
  ('dispatch-rider',      'Dispatch Riding',       'delivery'),
  ('courier',             'Courier',               'delivery'),
  ('driving',             'Driving',               'delivery'),
  -- Design
  ('graphic-design',      'Graphic Design',        'design'),
  ('branding',            'Branding',              'design'),
  ('ui-design',           'UI Design',             'design'),
  ('flyer-design',        'Flyer Design',          'design'),
  ('social-media-design', 'Social Media Design',   'design'),
  ('illustration',        'Illustration',          'design'),
  -- Photography
  ('event-photography',   'Event Photography',     'photography'),
  ('portrait-photography','Portrait Photography',  'photography'),
  ('product-photography', 'Product Photography',   'photography'),
  ('videography',         'Videography',           'photography'),
  ('video-editing',       'Video Editing',         'photography'),
  -- Beauty
  ('makeup',              'Makeup Artistry',       'beauty'),
  ('hairstyling',         'Hairstyling',           'beauty'),
  ('barbing',             'Barbing',               'beauty'),
  ('nails',               'Nail Technician',       'beauty'),
  ('gele',                'Gele Tying',            'beauty'),
  -- Tech
  ('laptop-repair',       'Laptop Repair',         'tech'),
  ('phone-repair',        'Phone Repair',          'tech'),
  ('wifi-setup',          'Wi-Fi & Network Setup', 'tech'),
  ('cctv-installation',   'CCTV Installation',     'tech'),
  ('web-development',     'Web Development',       'tech'),
  ('mobile-development',  'Mobile Development',    'tech'),
  ('it-support',          'IT Support',            'tech'),
  -- Events
  ('ushering',            'Ushering',              'events'),
  ('catering',            'Catering',              'events'),
  ('event-setup',         'Event Setup',           'events'),
  ('mc-hosting',          'MC / Hosting',          'events'),
  ('dj',                  'DJ',                    'events'),
  ('decoration',          'Event Decoration',      'events'),
  -- Tutoring
  ('maths-tutoring',      'Maths Tutoring',        'tutoring'),
  ('english-tutoring',    'English Tutoring',      'tutoring'),
  ('exam-prep',           'Exam Preparation',      'tutoring'),
  ('music-lessons',       'Music Lessons',         'tutoring'),
  ('coding-lessons',      'Coding Lessons',        'tutoring'),
  -- Construction
  ('painting',            'Painting',              'construction'),
  ('tiling',              'Tiling',                'construction'),
  ('welding',             'Welding',               'construction'),
  ('masonry',             'Masonry',               'construction'),
  ('pop-ceiling',         'POP & Ceiling',         'construction'),
  -- Home services
  ('cooking',             'Cooking',               'home-services'),
  ('gardening',           'Gardening',             'home-services'),
  ('childcare',           'Childcare',             'home-services'),
  ('elder-care',          'Elder Care',            'home-services'),
  ('car-wash',            'Car Wash',              'home-services'),
  -- Errands
  ('shopping',            'Shopping & Market Run', 'errands'),
  ('queueing',            'Queueing',              'errands'),
  ('bill-payment',        'Bill Payments',         'errands'),
  -- Digital
  ('copywriting',         'Copywriting',           'digital-services'),
  ('social-media-mgmt',   'Social Media Management','digital-services'),
  ('data-entry',          'Data Entry',            'digital-services'),
  ('virtual-assistant',   'Virtual Assistant',     'digital-services'),
  ('transcription',       'Transcription',         'digital-services'),
  ('translation',         'Translation',           'digital-services')
) as s(slug, name, category_slug)
join categories c on c.slug = s.category_slug
on conflict (slug) do nothing;

-- ── location tree: Nigeria → states → cities → Lagos areas ─────────────────

insert into locations (kind, slug, name, country_code, currency, lat, lng, radius_km, position)
values ('country', 'nigeria', 'Nigeria', 'NG', 'NGN', 9.0820, 8.6753, 700, 1)
on conflict (country_code, kind, slug) do nothing;

insert into locations (parent_id, kind, slug, name, country_code, lat, lng, radius_km, position)
select ng.id, 'state', v.slug, v.name, 'NG', v.lat, v.lng, v.radius, v.position
from (values
  ('lagos',       'Lagos',       6.5244,  3.3792, 60.0, 1),
  ('fct',         'FCT Abuja',   9.0765,  7.3986, 45.0, 2),
  ('rivers',      'Rivers',      4.8156,  7.0498, 40.0, 3),
  ('oyo',         'Oyo',         7.3775,  3.9470, 45.0, 4),
  ('kano',        'Kano',       12.0022,  8.5920, 40.0, 5),
  ('ogun',        'Ogun',        7.1608,  3.3483, 45.0, 6),
  ('kaduna',      'Kaduna',     10.5105,  7.4165, 40.0, 7),
  ('enugu',       'Enugu',       6.5244,  7.5186, 35.0, 8),
  ('anambra',     'Anambra',     6.2209,  7.0722, 35.0, 9),
  ('delta',       'Delta',       5.8904,  5.6800, 40.0, 10)
) as v(slug, name, lat, lng, radius, position)
cross join (select id from locations where kind = 'country' and slug = 'nigeria') ng
on conflict (country_code, kind, slug) do nothing;

insert into locations (parent_id, kind, slug, name, country_code, lat, lng, radius_km, position)
select st.id, 'city', v.slug, v.name, 'NG', v.lat, v.lng, v.radius, v.position
from (values
  ('lagos',  'lagos-mainland',  'Lagos Mainland',  6.5000, 3.3600, 25.0, 1),
  ('lagos',  'lagos-island',    'Lagos Island',    6.4550, 3.4200, 20.0, 2),
  ('fct',    'abuja',           'Abuja',           9.0765, 7.3986, 30.0, 1),
  ('rivers', 'port-harcourt',   'Port Harcourt',   4.8156, 7.0498, 25.0, 1),
  ('oyo',    'ibadan',          'Ibadan',          7.3775, 3.9470, 30.0, 1),
  ('kano',   'kano-city',       'Kano',           12.0022, 8.5920, 25.0, 1),
  ('ogun',   'abeokuta',        'Abeokuta',        7.1475, 3.3619, 20.0, 1),
  ('kaduna', 'kaduna-city',     'Kaduna',         10.5105, 7.4165, 20.0, 1),
  ('enugu',  'enugu-city',      'Enugu',           6.4402, 7.4943, 20.0, 1),
  ('anambra','onitsha',         'Onitsha',         6.1450, 6.7890, 18.0, 1),
  ('delta',  'warri',           'Warri',           5.5160, 5.7500, 18.0, 1)
) as v(state_slug, slug, name, lat, lng, radius, position)
join locations st on st.kind = 'state' and st.slug = v.state_slug
on conflict (country_code, kind, slug) do nothing;

-- Lagos neighbourhoods. These are the labels users actually recognise, and the
-- fuzzed coordinates on a job resolve to one of them.
insert into locations (parent_id, kind, slug, name, country_code, lat, lng, radius_km, position)
select ct.id, 'area', v.slug, v.name, 'NG', v.lat, v.lng, v.radius, v.position
from (values
  ('lagos-island',   'lekki-phase-1',    'Lekki Phase 1',    6.4433, 3.4736, 4.0,  1),
  ('lagos-island',   'victoria-island',  'Victoria Island',  6.4281, 3.4219, 4.0,  2),
  ('lagos-island',   'ikoyi',            'Ikoyi',            6.4530, 3.4350, 3.5,  3),
  ('lagos-island',   'lagos-island-cbd', 'Lagos Island',     6.4550, 3.3940, 3.0,  4),
  ('lagos-island',   'ajah',             'Ajah',             6.4698, 3.5852, 6.0,  5),
  ('lagos-island',   'ikate',            'Ikate Elegushi',   6.4380, 3.4560, 3.0,  6),
  ('lagos-island',   'chevron',          'Chevron',          6.4450, 3.5300, 3.5,  7),
  ('lagos-island',   'sangotedo',        'Sangotedo',        6.4700, 3.6300, 5.0,  8),
  ('lagos-island',   'oniru',            'Oniru',            6.4300, 3.4500, 2.5,  9),
  ('lagos-mainland', 'ikeja',            'Ikeja',            6.6018, 3.3515, 6.0,  1),
  ('lagos-mainland', 'yaba',             'Yaba',             6.5095, 3.3711, 3.5,  2),
  ('lagos-mainland', 'surulere',         'Surulere',         6.4931, 3.3510, 4.0,  3),
  ('lagos-mainland', 'gbagada',          'Gbagada',          6.5546, 3.3890, 3.5,  4),
  ('lagos-mainland', 'maryland',         'Maryland',         6.5700, 3.3670, 3.0,  5),
  ('lagos-mainland', 'ogba',             'Ogba',             6.6280, 3.3420, 3.5,  6),
  ('lagos-mainland', 'magodo',           'Magodo',           6.6180, 3.3800, 4.0,  7),
  ('lagos-mainland', 'ojota',            'Ojota',            6.5820, 3.3800, 3.0,  8),
  ('lagos-mainland', 'festac',           'Festac Town',      6.4650, 3.2850, 4.5,  9),
  ('lagos-mainland', 'apapa',            'Apapa',            6.4490, 3.3590, 4.0, 10),
  ('lagos-mainland', 'ikorodu',          'Ikorodu',          6.6194, 3.5105, 8.0, 11),
  ('lagos-mainland', 'agege',            'Agege',            6.6180, 3.3220, 4.0, 12),
  ('lagos-mainland', 'oshodi',           'Oshodi',           6.5550, 3.3400, 3.5, 13),
  ('lagos-mainland', 'mushin',           'Mushin',           6.5270, 3.3480, 3.5, 14),
  ('lagos-mainland', 'ilupeju',          'Ilupeju',          6.5540, 3.3550, 2.5, 15),
  ('lagos-mainland', 'anthony',          'Anthony Village',  6.5700, 3.3720, 2.5, 16),
  ('lagos-mainland', 'ketu',             'Ketu',             6.5950, 3.3850, 3.5, 17),
  ('lagos-mainland', 'alimosho',         'Alimosho',         6.6100, 3.2700, 7.0, 18),
  ('abuja',          'wuse-2',           'Wuse II',          9.0765, 7.4700, 3.5,  1),
  ('abuja',          'garki',            'Garki',            9.0330, 7.4890, 3.5,  2),
  ('abuja',          'maitama',          'Maitama',          9.0850, 7.4900, 3.0,  3),
  ('abuja',          'gwarinpa',         'Gwarinpa',         9.1090, 7.4030, 5.0,  4),
  ('abuja',          'jabi',             'Jabi',             9.0640, 7.4230, 3.0,  5),
  ('port-harcourt',  'gra-ph',           'GRA Port Harcourt',4.8100, 7.0100, 3.5,  1),
  ('port-harcourt',  'trans-amadi',      'Trans Amadi',      4.7930, 7.0330, 3.5,  2),
  ('ibadan',         'bodija',           'Bodija',           7.4310, 3.9070, 3.5,  1),
  ('ibadan',         'ring-road-ib',     'Ring Road',        7.3630, 3.8830, 3.0,  2)
) as v(city_slug, slug, name, lat, lng, radius, position)
join locations ct on ct.kind = 'city' and ct.slug = v.city_slug
on conflict (country_code, kind, slug) do nothing;

-- ── storage buckets ────────────────────────────────────────────────────────
-- Created only when running against a Supabase project (the storage schema
-- exists). Public buckets hold display media; private buckets hold anything
-- that could identify a person or prove a claim.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from information_schema.tables
                 where table_schema = 'storage' and table_name = 'buckets') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('avatars',   'avatars',   true,  5 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
      ('job-media', 'job-media', true,  20 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm']),
      ('portfolio', 'portfolio', true,  20 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4']),
      ('chat-media','chat-media', false, 25 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
              'audio/webm', 'audio/mpeg', 'audio/mp4']),
      ('verification', 'verification', false, 10 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'application/pdf']),
      ('disputes',  'disputes',  false, 20 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'])
    on conflict (id) do update
      set file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$$;
