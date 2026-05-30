-- Alloc8 AI assistant: knowledge base + conversation memory (server-side only via service role)

create extension if not exists vector;

create table if not exists assistant_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  feature_area text,
  created_at timestamptz not null default now()
);

create table if not exists assistant_doc_embeddings (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references assistant_docs(id) on delete cascade,
  chunk text not null,
  embedding vector(1536)
);

create index if not exists assistant_doc_embeddings_embedding_idx
  on assistant_doc_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists assistant_conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_email text,
  messages jsonb not null default '[]'::jsonb,
  workflow_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistant_action_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references assistant_conversation_sessions(id) on delete set null,
  user_email text,
  action_id text not null,
  payload jsonb,
  confirmed boolean not null default false,
  result jsonb,
  created_at timestamptz not null default now()
);

-- Similarity search (called from serverless with service role)
create or replace function match_assistant_docs(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  chunk text,
  title text,
  feature_area text,
  similarity float
)
language sql
stable
as $$
  select
    e.chunk,
    d.title,
    d.feature_area,
    1 - (e.embedding <=> query_embedding) as similarity
  from assistant_doc_embeddings e
  join assistant_docs d on d.id = e.doc_id
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

alter table assistant_docs enable row level security;
alter table assistant_doc_embeddings enable row level security;
alter table assistant_conversation_sessions enable row level security;
alter table assistant_action_logs enable row level security;

-- No public policies: reads/writes only via service role in /api handlers.
