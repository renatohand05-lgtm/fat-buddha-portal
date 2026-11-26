-- 14 · Documentos das medidas disciplinares (advertência e suspensão assinadas, atestados etc.)
alter table public.ocorrencias add column if not exists anexos jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rh-documentos', 'rh-documentos', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- caminho: <loja_id>/<ocorrencia_id>/<arquivo>; mesmas regras de acesso das ocorrências
drop policy if exists "rh-docs: ver" on storage.objects;
drop policy if exists "rh-docs: enviar" on storage.objects;
drop policy if exists "rh-docs: excluir" on storage.objects;
create policy "rh-docs: ver" on storage.objects for select to authenticated
  using (bucket_id = 'rh-documentos' and public.ve_ocorrencias((storage.foldername(name))[1]));
create policy "rh-docs: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'rh-documentos' and public.ve_ocorrencias((storage.foldername(name))[1]));
create policy "rh-docs: excluir" on storage.objects for delete to authenticated
  using (bucket_id = 'rh-documentos' and public.pode_excluir((storage.foldername(name))[1]));
