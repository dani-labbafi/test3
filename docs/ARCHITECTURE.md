# Proposed architecture for real, shared orders

GitHub Pages is static hosting: it cannot receive or store orders. The current UI stores orders in each visitor's LocalStorage. For orders shared between customers and admins you need a backend.

## Recommended minimal stack
- **Front-end:** this project, unchanged, on GitHub Pages.
- **Backend/DB:** Supabase (PostgreSQL + Auth + auto REST API) or Firebase; alternative: Node/Express + PostgreSQL.
- **Only code to change:** the storage functions in `js/core.js` (`savedOrders`, `saveOrder`, `clearSavedOrders`) and `App.localRows`, replaced by API calls.

## Schema (PostgreSQL)
```sql
create table products(stockcode text primary key, name text not null, unit_price numeric(10,2) not null check (unit_price>=0), active boolean default true);
create table customers(id bigserial primary key, name text not null, email text, phone text, country text, created_at timestamptz default now());
create table orders(code text primary key, customer_id bigint references customers(id), country text not null, status text not null default 'registered' check (status in ('registered','processing','shipped','delivered','cancelled')), note text, created_at timestamptz default now());
create table order_items(order_code text references orders(code) on delete cascade, stockcode text references products(stockcode), quantity int not null check (quantity between 1 and 9999), unit_price numeric(10,2) not null, primary key(order_code, stockcode));
create table stock_movements(id bigserial primary key, stockcode text references products(stockcode), delta int not null, reason text not null, created_at timestamptz default now()); -- on-hand = sum(delta); enables real stock/shortage analytics
```

## Rules the server must enforce
1. Take **prices from `products`**, never from the browser. Generate the tracking code server-side (unique, unguessable).
2. Public tracking endpoint: code → limited fields (no email/phone/address).
3. Admin endpoints behind authentication (Supabase Auth + Row Level Security: customers may only insert orders; admins read everything).
4. Validate and length-limit all input; rate-limit order creation (captcha if public).
5. Import `data.js` rows once as historical orders so the dashboard keeps working.

## What this unlocks
Real order status, stock levels and shortage alerts (reorder point / safety stock), per-product trend analysis over a long time series, and customer names.
