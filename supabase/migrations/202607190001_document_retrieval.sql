-- Task 1: Document retrieval schema + Storage policy correction

-- Enable pgvector
create extension if not exists vector with schema extensions;

-- Immutable function for FTS indexing
create or replace function document_chunks_search_text(heading_path text[], content text)
returns text
language sql
immutable
as $$
  select coalesce(array_to_string(heading_path, ' '), '') || ' ' || content
$$;

-- Add processed document columns to source_documents
alter table source_documents
  add column if not exists processed_storage_path text,
  add column if not exists processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'indexed', 'failed')),
  add column if not exists embedding_model text,
  add column if not exists indexed_at timestamptz;

-- Document chunks table
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  source_document_id uuid not null references source_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  heading_path text[] not null default '{}',
  content text not null check (length(btrim(content)) > 0),
  locator jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536) not null,
  embedding_model text not null,
  created_at timestamptz not null default now(),
  unique (source_document_id, chunk_index)
);

create index document_chunks_scope_idx
  on document_chunks (workspace_id, business_id, source_document_id);
create index document_chunks_fts_idx on document_chunks
  using gin (to_tsvector('simple', document_chunks_search_text(heading_path, content)));
create index document_chunks_embedding_idx on document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- RLS for document_chunks
alter table document_chunks enable row level security;

create policy "document_chunks_select" on document_chunks
  for select using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = document_chunks.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "document_chunks_insert" on document_chunks
  for insert with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = document_chunks.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'owner')
    )
  );

create policy "document_chunks_update" on document_chunks
  for update using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = document_chunks.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'owner')
    )
  );

create policy "document_chunks_delete" on document_chunks
  for delete using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = document_chunks.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'owner')
    )
  );

-- Grant service role full access
grant select on document_chunks to service_role;
grant insert, update, delete on document_chunks to service_role;

-- Grant authenticated role read access
grant select on document_chunks to authenticated;

-- Hybrid search function
create or replace function hybrid_search_document_chunks(
  query_text text,
  query_embedding extensions.vector(1536),
  match_workspace_id uuid,
  match_business_id uuid,
  match_count integer default 8
)
returns table (
  id uuid,
  workspace_id uuid,
  business_id uuid,
  source_document_id uuid,
  chunk_index integer,
  heading_path text[],
  content text,
  locator jsonb,
  embedding_model text,
  score float
)
language sql
security invoker
as $$
with lexical as (
  select
    dc.id,
    dc.workspace_id,
    dc.business_id,
    dc.source_document_id,
    dc.chunk_index,
    dc.heading_path,
    dc.content,
    dc.locator,
    dc.embedding_model,
    row_number() over (order by ts_rank(to_tsvector('simple', document_chunks_search_text(dc.heading_path, dc.content)), plainto_tsquery('simple', query_text)) desc) as rank
  from document_chunks dc
  join source_documents sd on sd.id = dc.source_document_id
  where dc.workspace_id = match_workspace_id
    and dc.business_id = match_business_id
    and sd.processing_status = 'indexed'
    and to_tsvector('simple', document_chunks_search_text(dc.heading_path, dc.content)) @@ plainto_tsquery('simple', query_text)
  order by rank
  limit 50
),
semantic as (
  select
    dc.id,
    dc.workspace_id,
    dc.business_id,
    dc.source_document_id,
    dc.chunk_index,
    dc.heading_path,
    dc.content,
    dc.locator,
    dc.embedding_model,
    row_number() over (order by dc.embedding <=> query_embedding) as rank
  from document_chunks dc
  join source_documents sd on sd.id = dc.source_document_id
  where dc.workspace_id = match_workspace_id
    and dc.business_id = match_business_id
    and sd.processing_status = 'indexed'
  order by rank
  limit 50
),
combined as (
  select
    coalesce(l.id, s.id) as id,
    coalesce(l.workspace_id, s.workspace_id) as workspace_id,
    coalesce(l.business_id, s.business_id) as business_id,
    coalesce(l.source_document_id, s.source_document_id) as source_document_id,
    coalesce(l.chunk_index, s.chunk_index) as chunk_index,
    coalesce(l.heading_path, s.heading_path) as heading_path,
    coalesce(l.content, s.content) as content,
    coalesce(l.locator, s.locator) as locator,
    coalesce(l.embedding_model, s.embedding_model) as embedding_model,
    coalesce(1.0 / nullif(l.rank, 0), 0.0) + coalesce(1.0 / nullif(s.rank, 0), 0.0) as score
  from lexical l
  full outer join semantic s on s.id = l.id
)
select
  c.id,
  c.workspace_id,
  c.business_id,
  c.source_document_id,
  c.chunk_index,
  c.heading_path,
  c.content,
  c.locator,
  c.embedding_model,
  c.score
from combined c
order by c.score desc
limit match_count;
$$;

-- Fix Storage policies: path is workspaces/{workspaceId}/..., so workspace is segment 2
drop policy if exists "storage_sources_select" on storage.objects;
drop policy if exists "storage_sources_insert" on storage.objects;
drop policy if exists "storage_sources_delete" on storage.objects;
drop policy if exists "storage_archives_select" on storage.objects;
drop policy if exists "storage_archives_insert" on storage.objects;
drop policy if exists "storage_archives_delete" on storage.objects;

create policy "storage_sources_select" on storage.objects
  for select using (
    bucket_id = 'business-context-sources'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[2]
        and wm.user_id = auth.uid()
    )
  );

create policy "storage_sources_insert" on storage.objects
  for insert with check (
    bucket_id = 'business-context-sources'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[2]
        and wm.user_id = auth.uid()
    )
  );

create policy "storage_sources_delete" on storage.objects
  for delete using (
    bucket_id = 'business-context-sources'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[2]
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'owner')
    )
  );

create policy "storage_archives_select" on storage.objects
  for select using (
    bucket_id = 'business-context-archives'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[2]
        and wm.user_id = auth.uid()
    )
  );

create policy "storage_archives_insert" on storage.objects
  for insert with check (
    bucket_id = 'business-context-archives'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[2]
        and wm.user_id = auth.uid()
    )
  );

create policy "storage_archives_delete" on storage.objects
  for delete using (
    bucket_id = 'business-context-archives'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[2]
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'owner')
    )
  );
