insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'playdeck-images',
  'playdeck-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "playdeck_images_public_insert"
on storage.objects
for insert
to public
with check (
  bucket_id = 'playdeck-images'
  and (storage.foldername(name))[1] = 'slides'
);
