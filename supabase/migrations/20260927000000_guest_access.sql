-- Guests (signed-out visitors) browse the catalogue and general university
-- information: countries, universities, ESG and teaching insights, the
-- UNIverse score, and the student clubs found on an official page. Everything
-- written by or about students (profiles, posts, comments, equivalences,
-- ratings, saved universities, groups and chats, AI research) stays for
-- signed-in students, as the earlier migrations already enforce.

create policy "Guests read clubs found on official pages" on public.clubs
  for select to anon using (not hidden and source = 'ai' and verified);

grant select on public.club_list to anon;
