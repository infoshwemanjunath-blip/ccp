-- Run this in Supabase -> SQL Editor
create table if not exists orders (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  phone               text not null,            -- stored as 91XXXXXXXXXX
  email               text not null,
  razorpay_order_id   text unique,
  razorpay_payment_id text,
  status              text not null default 'pending',   -- pending | paid
  paid_at             timestamptz,
  wa_status           text not null default 'pending',   -- pending | sent | failed
  wa_message_id       text,
  wa_error            text,
  wa_attempts         int  not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists orders_retry_idx on orders (status, wa_status);
