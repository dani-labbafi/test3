/* core.js — data layer, storage, cart, formatting. No DOM rendering here (see ui.js).
   Everything is computed from data.js (window.data) + orders saved in this browser (LocalStorage). */
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const KEY_ORDERS = "sales_orders_v1"; // same key as the original project: existing saved orders keep working
  const KEY_CART = "bluestore_cart_v1";
  const KEY_LANG = "bluestore_lang";

  /* ---------- storage ---------- */
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  App.storageOk = (() => { try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); return true; } catch (e) { return false; } })();

  /* ---------- language / i18n ---------- */
  App.lang = (lsGet(KEY_LANG, null) || (document.documentElement.getAttribute("data-default-lang") || "fa"));
  if (App.lang !== "fa" && App.lang !== "en") App.lang = "fa";
  document.documentElement.lang = App.lang;
  document.documentElement.dir = App.lang === "fa" ? "rtl" : "ltr";
  App.setLang = l => { lsSet(KEY_LANG, l); location.reload(); };
  App.t = (key, vars) => {
    const e = (window.I18N || {})[key];
    let s = e ? e[App.lang === "fa" ? 0 : 1] : key;
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  };
  App.applyI18n = (root) => {
    (root || document).querySelectorAll("[data-i18n]").forEach(n => { n.textContent = App.t(n.dataset.i18n); });
    (root || document).querySelectorAll("[data-i18n-ph]").forEach(n => { n.placeholder = App.t(n.dataset.i18nPh); });
    (root || document).querySelectorAll("[data-i18n-aria]").forEach(n => { n.setAttribute("aria-label", App.t(n.dataset.i18nAria)); });
    (root || document).querySelectorAll("[data-i18n-title]").forEach(n => { n.title = App.t(n.dataset.i18nTitle); });
  };

  /* ---------- formatting & safety ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = v => "$" + Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = v => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const pct = v => (Number(v || 0) * 100).toFixed(1) + "%";
  const titleCase = s => String(s).toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const clean = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 100);
  const N = v => `<span class="num">${esc(v)}</span>`; // keeps digits/LTR text correct inside RTL
  Object.assign(App, { esc, money, num, pct, titleCase, clean, N, lsGet, lsSet, KEY_CART, KEY_ORDERS });
  App.$ = (s, r) => (r || document).querySelector(s);
  App.$$ = (s, r) => [...(r || document).querySelectorAll(s)];
  App.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 150); }; };
  App.imgUrl = code => "img/products/" + String(code).replace(/[^A-Za-z0-9_-]/g, "_") + ".svg";

  /* ---------- saved orders (LocalStorage only: NOT a shared database) ---------- */
  App.savedOrders = () => { const a = lsGet(KEY_ORDERS, []); return Array.isArray(a) ? a : []; };
  App.saveOrder = o => lsSet(KEY_ORDERS, App.savedOrders().concat(o));
  App.clearSavedOrders = () => { try { localStorage.removeItem(KEY_ORDERS); } catch (e) {} };

  /* ---------- rows: original dataset + local orders ---------- */
  App.datasetRows = () => (window.data || []).map(r => ({ ...r, description: String(r.description).trim(), stockcode: String(r.stockcode), source: "dataset", customerKey: "c" + r.customerid }));
  App.localRows = () => App.savedOrders().flatMap(o => (o.items || []).map(i => ({
    invoiceno: o.code, stockcode: String(i.stockcode), description: i.description, quantity: i.quantity, unitprice: i.unitprice,
    customerid: o.customerid || null, customerName: o.customer || "", country: o.country, date: o.date, hour: o.hour,
    total_amount: +(i.quantity * i.unitprice).toFixed(2), source: "local", status: o.status || "registered",
    customerKey: o.customerid ? "c" + o.customerid : "n:" + String(o.customer || "").toLowerCase()
  })));
  App.allRows = (includeLocal) => App.datasetRows().concat(includeLocal === false ? [] : App.localRows());

  /* ---------- aggregation ---------- */
  App.products = rows => {
    const m = new Map();
    rows.forEach(r => {
      let p = m.get(r.description);
      if (!p) m.set(r.description, p = { name: r.description, stockcode: r.stockcode, price: r.unitprice, lastDate: r.date, prices: new Set(), qty: 0, revenue: 0, orders: new Set(), dates: new Set() });
      if (r.date >= p.lastDate) { p.lastDate = r.date; p.price = r.unitprice; }
      p.prices.add(r.unitprice); p.qty += r.quantity; p.revenue += r.total_amount; p.orders.add(String(r.invoiceno)); p.dates.add(r.date);
    });
    return [...m.values()].map(p => ({ ...p, revenue: +p.revenue.toFixed(2), orderCount: p.orders.size, dateCount: p.dates.size, priceCount: p.prices.size, unitsPerOrder: p.qty / p.orders.size }));
  };
  App.orders = rows => {
    const m = new Map();
    rows.forEach(r => {
      const k = String(r.invoiceno);
      let o = m.get(k);
      if (!o) m.set(k, o = { code: k, date: r.date, hour: r.hour, country: r.country, customerid: r.customerid, customerKey: r.customerKey, customerName: r.customerName || "", source: r.source, lines: [], units: 0, total: 0 });
      o.lines.push(r); o.units += r.quantity; o.total += r.total_amount;
    });
    return [...m.values()].map(o => ({ ...o, total: +o.total.toFixed(2) }));
  };
  App.sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  App.groupSum = (arr, keyFn, valFn) => { const m = {}; arr.forEach(x => { const k = keyFn(x); m[k] = (m[k] || 0) + valFn(x); }); return m; };
  App.quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))] : 0;

  /* price tiers: edges default to the quartiles of the real product-price distribution */
  App.defaultEdges = products => {
    const s = products.map(p => p.price).sort((a, b) => a - b);
    const e = [App.quantile(s, .25), App.quantile(s, .5), App.quantile(s, .75)].map(v => +v.toFixed(2));
    return [...new Set(e)];
  };
  App.tiersFromEdges = edges => {
    const e = [...edges].sort((a, b) => a - b), t = [];
    let lo = 0;
    e.forEach(x => { t.push({ min: lo, max: x }); lo = x; });
    t.push({ min: lo, max: Infinity });
    return t.map(x => ({ ...x, label: x.max === Infinity ? App.t("tier_over", { v: money(x.min) }) : (x.min === 0 ? App.t("tier_under", { v: money(x.max) }) : money(x.min) + " – " + money(x.max)) }));
  };
  App.inTier = (p, t) => (t.min === 0 ? p.price >= 0 : p.price >= t.min) && p.price < t.max;
  // Note on tier boundaries: lower bound inclusive, upper bound exclusive.

  /* ---------- cart (LocalStorage) ---------- */
  App.cart = {
    get() { const c = lsGet(KEY_CART, {}); return c && typeof c === "object" ? c : {}; },
    set(c) { lsSet(KEY_CART, c); document.dispatchEvent(new CustomEvent("cart:change")); },
    add(code, q) { const c = this.get(); c[code] = Math.min(9999, (c[code] || 0) + Math.max(1, q | 0)); this.set(c); },
    setQty(code, q) { const c = this.get(); if (q < 1) delete c[code]; else c[code] = Math.min(9999, q | 0); this.set(c); },
    remove(code) { const c = this.get(); delete c[code]; this.set(c); },
    clear() { this.set({}); },
    count() { return Object.values(this.get()).reduce((s, v) => s + (v | 0), 0); },
    // resolves cart entries against the catalog; unknown stockcodes are dropped
    lines(catalog) {
      const c = this.get();
      return Object.keys(c).map(code => { const p = catalog.find(x => x.stockcode === code); return p ? { product: p, qty: c[code], amount: +(c[code] * p.price).toFixed(2) } : null; }).filter(Boolean);
    }
  };

  /* ---------- order codes & shareable tracking link ---------- */
  App.newCode = () => {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", used = new Set(App.orders(App.allRows()).map(o => o.code));
    const rnd = n => { const a = new Uint32Array(n); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 4294967296); return a; };
    let c;
    do { c = "ORD-" + Array.from(rnd(6), v => A[v % A.length]).join(""); } while (used.has(c));
    return c;
  };
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  App.encodeOrder = o => b64e(JSON.stringify({ c: o.code, n: o.customer, co: o.country, d: o.date, h: o.hour, i: o.items.map(i => [i.stockcode, i.quantity, i.unitprice]) }));
  App.decodeOrder = (s, catalog) => { // strictly validated: this data comes from a URL and is NOT verified
    try {
      const o = JSON.parse(b64d(s));
      if (!/^ORD-[A-Z0-9]{6}$/.test(o.c) || !Array.isArray(o.i) || !o.i.length || o.i.length > 60) return null;
      const items = o.i.map(x => {
        const q = Number(x[1]), pr = Number(x[2]), p = catalog.find(c => c.stockcode === String(x[0]).slice(0, 20));
        if (!Number.isInteger(q) || q < 1 || q > 9999 || !(pr >= 0 && pr < 100000)) throw 0;
        return { stockcode: String(x[0]).slice(0, 20), description: p ? p.name : String(x[0]).slice(0, 20), quantity: q, unitprice: pr };
      });
      return { code: o.c, customer: clean(o.n, 60), country: clean(o.co, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(o.d) ? o.d : "", hour: Number.isInteger(o.h) ? o.h : null, items, source: "link" };
    } catch (e) { return null; }
  };

  App.COUNTRIES = ["United Kingdom", "Germany", "EIRE", "Lithuania", "France", "Netherlands", "Iran", "Turkey", "Italy", "Spain", "United States", "Canada", "Azerbaijan", "United Arab Emirates"];
  App.countryList = () => [...new Set(App.COUNTRIES.concat(App.datasetRows().map(r => r.country)))].sort();
  App.downloadText = (name, text, type) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain" })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  App.csvCell = v => { let s = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }; // also neutralises CSV formula injection
})();
