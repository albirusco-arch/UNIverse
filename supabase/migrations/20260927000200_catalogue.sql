-- Catalogue: institution type (university or business school) and whether the
-- entry's name, website and email domains were confirmed on the official site.
-- Departments can also come from the curated catalogue (unverified until checked).

alter table public.universities
  add column kind text not null default 'university' check (kind in ('university', 'business_school')),
  add column verified boolean not null default false;

alter table public.departments drop constraint departments_source_check;
alter table public.departments
  add constraint departments_source_check check (source in ('admin', 'ai', 'catalogue'));
