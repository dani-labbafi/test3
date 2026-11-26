/* product.js — product detail page (product.html?id=<stockcode>) */
(function () {
  "use strict";
  const { t, esc, money, num, N, $ } = App;
  App.mountHeader("shop");
  const P = App.products(App.allRows());
  const id = new URLSearchParams(location.search).get("id") || "";
  const p = P.find(x => x.stockcode === id);
  const box = $("#pd");
  if (!p) {
    box.innerHTML = `<div class="panel"><p class="empty">${esc(t("pd_notfound"))}</p><div style="text-align:center"><a class="btn" href="index.html">${esc(t("pd_back"))}</a></div></div>`;
  } else {
    document.title = App.titleCase(p.name) + " — BlueStore";
    const tiers = App.tiersFromEdges(App.defaultEdges(P)), tier = tiers.find(x => App.inTier(p, x));
    const related = P.filter(x => x.stockcode !== p.stockcode).sort((a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price) || b.qty - a.qty).slice(0, 4);
    const avg = p.qty / p.orderCount;
    box.innerHTML = `<div class="crumbs"><a href="index.html">${esc(t("nav_shop"))}</a> / <span class="l">${esc(App.titleCase(p.name))}</span></div>
      <div class="pd"><div><div class="big tilt" id="big">${App.productImg(p)}</div><p class="meta" style="margin-top:10px">${esc(t("img_note"))}</p></div>
      <div><h1>${esc(App.titleCase(p.name))}</h1><div class="meta">${esc(t("pd_code"))}: <span class="num">${esc(p.stockcode)}</span> · ${esc(t("pd_tier"))}: <span class="num">${esc(tier ? tier.label : "-")}</span></div>
        <div class="price">${N(money(p.price))}</div>
        ${p.priceCount > 1 ? `<div class="note" style="margin-bottom:12px">${esc(t("pd_multiprice", { list: [...p.prices].sort((a, b) => a - b).map(money).join(", ") }))}</div>` : ""}
        <div class="kv"><div><b>${N(num(p.qty))}</b><span>${esc(t("c_units_sold"))}</span></div><div><b>${N(p.orderCount)}</b><span>${esc(t("c_in_orders"))}</span></div><div><b>${N(num(+avg.toFixed(1)))}</b><span>${esc(t("pd_avg"))}</span></div></div>
        <div class="row" style="align-items:center;gap:10px;margin-top:6px"><div class="qty" style="flex:0 0 auto;min-width:0"><button type="button" id="mi" aria-label="-">−</button><input id="qty" type="number" min="1" max="9999" value="1" aria-label="${esc(t("co_qty"))}"><button type="button" id="pl" aria-label="+">+</button></div>
          <button class="btn teal" id="add" type="button" style="flex:1">${esc(t("btn_add_cart"))}</button><a class="btn ghost" id="buy" href="cart.html" style="flex:1">${esc(t("pd_buy"))}</a></div>
        <p class="meta" style="margin-top:14px">${esc(t("pd_nostock"))}</p></div></div>
      <section><h2>${esc(t("pd_related"))}</h2><div class="grid" id="rel" style="margin-top:14px">${related.map(App.productCard).join("")}</div></section>`;
    const q = $("#qty"), val = () => Math.max(1, Math.min(9999, parseInt(q.value, 10) || 1));
    $("#mi").onclick = () => { q.value = Math.max(1, val() - 1); }; $("#pl").onclick = () => { q.value = Math.min(9999, val() + 1); };
    $("#add").onclick = () => { App.cart.add(p.stockcode, val()); App.toast(t("toast_added")); };
    $("#buy").onclick = () => { App.cart.add(p.stockcode, val()); };
    App.bindAddButtons($("#rel")); App.enableTilt(box);
  }
  App.applyI18n(); App.mountFooter();
})();
