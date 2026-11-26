/* track.js — order lookup by code (dataset + orders saved in this browser) or via a shared link (#o=...) */
(function () {
  "use strict";
  const { t, esc, money, num, N, $ } = App;
  App.mountHeader("track");
  const catalog = App.products(App.allRows(false));
  function view(o, how) {
    const lines = o.lines ? o.lines.map(l => ({ d: l.description, q: l.quantity, u: l.unitprice, a: l.total_amount })) : o.items.map(i => ({ d: i.description, q: i.quantity, u: i.unitprice, a: +(i.quantity * i.unitprice).toFixed(2) }));
    const total = +App.sum(lines, l => l.a).toFixed(2), units = App.sum(lines, l => l.q);
    const name = o.customerName || o.customer || "", cid = o.customerid;
    const status = o.source === "local" || o.source === "link" ? [t("tr_registered"), 1] : [t("tr_nostatus"), 0];
    const warn = o.source === "link" ? `<div class="note" style="margin-bottom:12px">${esc(t("tr_link_note"))}</div>` : o.source === "local" ? `<div class="note info" style="margin-bottom:12px">${esc(t("tr_local_note"))}</div>` : "";
    return `${warn}<div class="bar"><span class="tag">${esc(t("tr_order"))} <span class="num">${esc(o.code)}</span></span></div>
      <div class="kv"><div><b>${N(o.date || "-")}${o.hour != null ? ` <span class="num">${String(o.hour).padStart(2, "0")}:00</span>` : ""}</b><span>${esc(t("tr_date"))}</span></div>
        <div><b>${name ? esc(name) : (cid ? N(cid) : "-")}</b><span>${esc(name ? t("tr_customer") : t("tr_customer_id"))}</span></div>
        <div><b>${N(o.country || "-")}</b><span>${esc(t("co_country"))}</span></div><div><b>${N(units)}</b><span>${esc(t("tr_units"))}</span></div><div><b>${N(money(total))}</b><span>${esc(t("co_total"))}</span></div></div>
      <div class="timeline" aria-label="status"><div class="${status[1] ? "on" : ""}">${esc(status[0])}</div></div>${status[1] ? "" : `<p class="meta">${esc(t("tr_nostatus_why"))}</p>`}
      <div class="tw" style="margin-top:12px"><table><thead><tr><th>${esc(t("tr_product"))}</th><th class="n">${esc(t("co_qty"))}</th><th class="n">${esc(t("tr_unit"))}</th><th class="n">${esc(t("tr_amount"))}</th></tr></thead><tbody>${lines.map(l => `<tr><td class="l">${esc(App.titleCase(l.d))}</td><td class="n">${num(l.q)}</td><td class="n">${money(l.u)}</td><td class="n">${money(l.a)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function find(raw) {
    const out = $("#result"), c = App.clean(raw, 40).toLowerCase();
    if (!c) { out.innerHTML = App.emptyBox(t("tr_enter")); return; }
    const o = App.orders(App.allRows()).find(x => x.code.toLowerCase() === c);
    out.innerHTML = o ? view(o) : `<p class="empty">${esc(t("tr_notfound", { code: App.clean(raw, 40) }))}</p><p class="meta" style="text-align:center">${esc(t("tr_notfound_why"))}</p>`;
  }
  $("#tform").addEventListener("submit", e => { e.preventDefault(); find($("#code").value); });
  const q = new URLSearchParams(location.search).get("code"), h = /^#o=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (h) { const o = App.decodeOrder(h[1], catalog); $("#code").value = o ? o.code : ""; $("#result").innerHTML = o ? view(o) : `<p class="empty">${esc(t("tr_badlink"))}</p>`; }
  else if (q) { $("#code").value = App.clean(q, 40); find(q); }
  else $("#result").innerHTML = App.emptyBox(t("tr_enter"));
  App.applyI18n(); App.mountFooter();
})();
