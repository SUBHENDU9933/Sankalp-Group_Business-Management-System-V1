-- =====================================================================
-- SANKALP GROUP — Schema v7 (Estimate Presets DB + Lead-Estimate Sync)
-- Apply AFTER v1..v6.
--   1. 5 preset tables (rooms, items, terms, notes, guides) with `is_active` for soft-delete
--   2. Seed default values (matches /app/frontend/public/estimator.html original arrays)
--   3. Lead-estimate tracking columns + trigger
-- =====================================================================

-- 1. PRESET TABLES -----------------------------------------------------
create table if not exists public.estimate_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'General',
  name text not null unique,
  description text,
  unit_type text not null default 'sqft_dim',  -- sqft_dim | sqft_total | nos | rft | lumsum
  rate_standard numeric not null default 0,
  rate_premium numeric not null default 0,
  rate_ultra numeric not null default 0,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_estimate_items_cat on public.estimate_items(category);

create table if not exists public.estimate_terms (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.estimate_notes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.estimate_guides (
  id uuid primary key default gen_random_uuid(),
  tier text not null,                -- 'standard' | 'premium' | 'ultra'
  content text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS — readable by all authenticated users; only admin can write
alter table public.estimate_rooms enable row level security;
alter table public.estimate_items enable row level security;
alter table public.estimate_terms enable row level security;
alter table public.estimate_notes enable row level security;
alter table public.estimate_guides enable row level security;

do $$ declare t text; begin
  for t in select unnest(array['estimate_rooms','estimate_items','estimate_terms','estimate_notes','estimate_guides']) loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- 2. SEED DEFAULTS ------------------------------------------------------
-- Rooms
insert into public.estimate_rooms (name, sort_order) values
  ('Living Room', 1),('Master Bedroom', 2),('Bedroom 1', 3),('Bedroom 2', 4),
  ('Dining Area', 5),('Kitchen', 6),('Balcony', 7),('Study Room', 8),
  ('Pooja Room', 9),('Lobby / Passage', 10),('Reception Area', 11),
  ('Conference Room', 12),('Pantry', 13),('Director Cabin', 14)
on conflict (name) do nothing;

-- Items (with reasonable categories so dropdown can filter)
insert into public.estimate_items (category, name, description, unit_type, rate_standard, rate_premium, rate_ultra, sort_order) values
  ('Furniture','TV Unit','Plywood laminate finish','sqft_dim',1350,1550,1750,1),
  ('Furniture','Floating TV Unit','Wall hung TV unit','sqft_dim',1350,1550,1750,2),
  ('Wall Decor','Wall Paneling','Decorative wall panel','sqft_dim',650,800,950,3),
  ('Wall Decor','CNC Panel','CNC MDF design panel','sqft_dim',650,800,950,4),
  ('Wall Decor','Sofa Back Panel','Decorative panel work','sqft_dim',650,800,950,5),
  ('Furniture','Crockery Unit','Storage with shutters','sqft_dim',1350,1550,1750,6),
  ('Furniture','Display Unit','Open display shelves','sqft_dim',1350,1550,1750,7),
  ('Furniture','Partition Unit','Wooden CNC partition','sqft_dim',650,800,950,8),
  ('Wardrobe','Wardrobe','Modular hinged wardrobe','sqft_dim',1350,1550,1750,9),
  ('Wardrobe','Sliding Wardrobe','Sliding shutter unit','sqft_dim',1350,1550,1750,10),
  ('Wardrobe','Loft Storage','Overhead loft cabinet','sqft_dim',1350,1550,1750,11),
  ('Furniture','Bed with Storage','Hydraulic storage bed','sqft_dim',1350,1550,1750,12),
  ('Furniture','Headboard Panel','Decorative bed panel','sqft_dim',1350,1550,1750,13),
  ('Furniture','Dressing Table','Mirror & drawer unit','sqft_dim',1350,1550,1750,14),
  ('Furniture','Side Table','Bedside storage','sqft_dim',1350,1550,1750,15),
  ('Furniture','Study Table','Study/work desk','sqft_dim',1350,1550,1750,16),
  ('Furniture','Shoe Rack','Modular shoe cabinet','sqft_dim',1350,1550,1750,17),
  ('Furniture','Pooja Unit','Wooden pooja unit','sqft_dim',1350,1550,1750,18),
  ('Furniture','Bathroom Vanity','Basin cabinet unit','sqft_dim',1350,1550,1750,19),
  ('Furniture','Utility Cabinet','Washing/utility unit','sqft_dim',1350,1550,1750,20),
  ('Kitchen','Modular Kitchen','Base & wall cabinets','sqft_dim',1450,1650,1850,21),
  ('Kitchen','Tall Unit','Pantry cabinet','sqft_dim',1350,1550,1750,22),
  ('Kitchen','Overhead Cabinet','Wall kitchen cabinet','sqft_dim',1350,1550,1750,23),
  ('Kitchen','Drawer System','Tandem drawer unit','sqft_dim',1350,1550,1750,24),
  ('Kitchen','Bottle Pull-Out','Bottle basket','sqft_dim',1450,1650,1850,25),
  ('Kitchen','Corner Unit','Magic corner','sqft_dim',1450,1650,1850,26),
  ('Kitchen','Chimney Cabinet','Chimney housing','sqft_dim',1350,1550,1750,27),
  ('Kitchen','Kitchen Platform','Granite/Quartz slab','sqft_dim',650,850,1050,28),
  ('Kitchen','Sink Cutting','Platform cutting','nos',450,650,850,29),
  ('Flooring','Floor Tiles','Vitrified flooring','sqft_total',120,180,230,30),
  ('Flooring','Wooden Flooring','Laminate/SPC','sqft_total',220,380,650,31),
  ('Flooring','Wall Tiles','Kitchen/Bath tiles','sqft_total',140,220,350,32),
  ('Civil','Tile Dismantling','Old tile removal','sqft_total',35,45,60,33),
  ('Flooring','Marble Polishing','Diamond polish','sqft_total',20,30,45,34),
  ('Civil','Waterproofing','Bath/Balcony','sqft_total',65,90,140,35),
  ('Civil','Brick Partition','Brick wall work','sqft_total',110,150,220,36),
  ('Civil','Plaster Repair','Wall plaster','sqft_total',45,65,90,37),
  ('Ceiling','False Ceiling','Gypsum/POP ceiling','sqft_dim',100,130,170,38),
  ('Ceiling','Designer Ceiling','Multi-level POP','sqft_dim',180,220,260,39),
  ('Ceiling','Ceiling Lighting','Standard Ceiling Light','sqft_dim',150,230,350,40),
  ('Electrical','Switchboard Point','Modular switch point','nos',550,850,1200,41),
  ('Electrical','Light Point','Ceiling/wall light','nos',450,650,950,42),
  ('Electrical','Fan Point','Ceiling fan wiring','nos',650,950,1300,43),
  ('Electrical','AC Point','Dedicated AC line','nos',2000,2800,3800,44),
  ('Electrical','Geyser Point','Heater wiring','nos',1200,1800,2500,45),
  ('Electrical','Concealed Wiring','FR concealed wiring','rft',85,120,180,46),
  ('Electrical','LED Panel Light','12-18W panel','rft',450,850,1600,47),
  ('Electrical','COB Light','Decorative spot','nos',650,1200,2200,48),
  ('Electrical','Profile Light','LED strip light','rft',250,450,750,49),
  ('Electrical','Under Cabinet Light','Kitchen LED strip','lumsum',180,320,550,50),
  ('Wall Decor','Wallpaper','Designer wallpaper','sqft_dim',120,220,380,51),
  ('Wall Decor','Wall Molding','POP wall molding','sqft_dim',180,280,420,52),
  ('Wall Decor','Mirror Panel','Decorative mirror','sqft_dim',450,750,1200,53),
  ('Soft Furnishing','Curtains','Fabric + stitching','sqft_total',350,650,1200,54),
  ('Soft Furnishing','Blinds','Roller/Zebra blinds','sqft_total',220,380,650,55),
  ('Soft Furnishing','Mosquito Net','Sliding/fixed net','sqft_total',180,280,420,56),
  ('Office','Glass Partition','Toughened glass','sqft_total',650,1100,1850,57),
  ('Office','Reception Counter','Reception desk','sqft_dim',1450,1650,1850,58),
  ('Office','Workstation','Office workstation','sqft_dim',1250,1450,1650,59),
  ('Office','Conference Table','Conference table','sqft_dim',1250,1450,1650,60),
  ('Office','Storage Cabinet','Office storage','sqft_dim',1250,1450,1650,61),
  ('Office','Filing Cabinet','File storage','sqft_dim',1250,1450,1650,62),
  ('Office','Director Table','Executive table','sqft_dim',1450,1650,1850,63),
  ('Office','Office Partition','Gypsum/Wood panel','sqft_dim',280,380,480,64)
on conflict (name) do nothing;

-- Standard terms
insert into public.estimate_terms (content, sort_order) values
  ('<strong>Advance Payment:</strong> 20–30% advance required to confirm booking.', 1),
  ('<strong>Payment Schedule:</strong> Balance payment to be cleared as per agreed work progress.', 2),
  ('<strong>Scope:</strong> Electrical, civil, plumbing & POP work are excluded unless specifically mentioned.', 3),
  ('<strong>Changes:</strong> Any design or material change after final approval will be chargeable.', 4),
  ('<strong>Timeline:</strong> Estimated timeline starts after final design approval and advance payment.', 5),
  ('<strong>Warranty:</strong> Warranty covers workmanship only; material warranty as per manufacturer.', 6);

-- Project notes
insert into public.estimate_notes (content, sort_order) values
  ('<strong>Final Billing:</strong> Final amount will be based on actual site measurements and executed work.', 1),
  ('<strong>Customisation:</strong> All items are custom-made; category upgrade or downgrade is possible.', 2),
  ('<strong>Appliances:</strong> Appliance and accessory costs are not included unless specified.', 3),
  ('<strong>Site Readiness:</strong> Site must be clear and ready before work commencement.', 4);

-- Guides
insert into public.estimate_guides (tier, content, sort_order) values
  ('standard', '<strong>Standard:</strong> ISI Standard Ply / BWR/BWP Grade Ply, 0.8mm laminate finish, Standard hardware & hinges,', 1),
  ('premium',  '<strong>Premium:</strong> BWP / RedCore equivalent ply, Premium laminate, Branded hardware (Hettich / Ebco), Soft-close hinges, Improved finishing.', 2),
  ('ultra',    '<strong>Ultra:</strong> Century Sainik 710 ply, Premium Merino laminate, Premium branded hardware, Soft-close drawers & shutters, Superior craftsmanship.', 3);

-- 3. LEAD-ESTIMATE TRACKING --------------------------------------------
alter table public.leads add column if not exists estimate_status text;       -- draft | sent | approved | rejected
alter table public.leads add column if not exists estimate_count int not null default 0;
alter table public.leads add column if not exists last_estimate_id uuid references public.estimates(id) on delete set null;

-- Trigger: maintain leads.estimate_count + last_estimate_id + estimate_status
create or replace function public.sync_lead_on_estimate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_status text;
begin
  if (tg_op = 'DELETE') then
    if old.lead_id is not null then
      select count(*) into v_count from public.estimates where lead_id = old.lead_id;
      update public.leads
        set estimate_count = v_count,
            last_estimate_id = (select id from public.estimates where lead_id = old.lead_id order by created_at desc limit 1),
            estimate_status = (select status from public.estimates where lead_id = old.lead_id order by created_at desc limit 1)
        where id = old.lead_id;
    end if;
    return old;
  end if;

  if new.lead_id is not null then
    select count(*) into v_count from public.estimates where lead_id = new.lead_id;
    -- Highest-priority status wins: approved > sent > draft > rejected (latest)
    select status into v_status
      from public.estimates
      where lead_id = new.lead_id
      order by case status when 'approved' then 1 when 'sent' then 2 when 'draft' then 3 else 4 end,
               updated_at desc
      limit 1;
    update public.leads
      set estimate_count = v_count,
          last_estimate_id = new.id,
          estimate_status = v_status
      where id = new.lead_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_lead_estimate on public.estimates;
create trigger trg_sync_lead_estimate
  after insert or update or delete on public.estimates
  for each row execute function public.sync_lead_on_estimate();
