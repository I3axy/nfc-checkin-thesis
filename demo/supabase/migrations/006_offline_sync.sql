-- =============================================================================
-- Migration: offline check-in sync support
-- =============================================================================
-- The scanner can record check-ins while offline and replay them later.
-- To make that replay idempotent (a retry after a lost response must NOT
-- create a duplicate event), each offline event carries a client-generated
-- UUID. A partial unique index enforces "insert at most once" per id, while
-- still allowing many online events with a null id.
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

-- Client-generated id for offline-recorded events (null for online events)
alter table events add column if not exists client_event_id uuid;

-- At most one event per client_event_id; nulls are unconstrained
create unique index if not exists events_client_event_id_key
  on events (client_event_id)
  where client_event_id is not null;
