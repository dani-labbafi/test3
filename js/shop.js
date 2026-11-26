/* shop.js — storefront: search, price filter, sorting, product grid */
(function () {
  "use strict";
  const { t, esc, money, num, N, $ } = App;
  App.mountHeader("shop");
  const P = App.products(App.allRows());
  const edges = App.defaultEdges(P), tiers = App.tiersFromEdges(edges);
  const PAGE = 24;
  const st = { q: "", sort: "qty", tier: -1, min: null, max: null, shown: PAGE };

  // hero: real totals from the dataset (+ local orders)
  const rows = App.allRows();
  $("#heroStats").innerHTML = [[P.length, t("st_products")], [num(App.sum(rows, r => r.quantity)), t("st_units")], [App.orders(rows).length, t("st_orders")], [new Set(rows.map(r => r.country)).size, t("st_countries")]]
    .map(s => `<div class="stat"><b class="num">${esc(s[0])}</b><span>${esc(s[1])}</span></div>`).join("");
  // hero stage: three best sellers (by units, then revenue)
  const top = [...P].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 3);
  $("#stage").innerHTML = top.map(p => `<a class="tilt" href="product.html?id=${encodeURIComponent(p.stockcode)}" title="${esc(App.titleCase(p.name))}">${App.productImg(p)}<span class="cap">${esc(App.titleCase(p.name))}</span></a>`).join("");

  // price tier chips come from the real price distribution (quartiles)
  $("#tiers").innerHTML = `<button class="chip on" type="button" data-t="-1">${esc(t("f_all_prices"))}</button>` + tiers.map((x, i) => `<button class="chip" type="button" data-t="${i}"><span class="num">${esc(x.label)}</span></button>`).join("");

  function list() {
    const q = st.q.toLowerCase();
    let a = P.filter(p => (!q || p.name.toLowerCase().includes(q) || p.stockcode.toLowerCase().includes(q)));
    if (st.tier >= 0) a = a.filter(p => App.inTier(p, tiers[st.tier]));
    if (st.min != null) a = a.filter(p => p.price >= st.min);
    if (st.max != null) a = a.filter(p => p.price <= st.max);
    const s = st.sort, cmp = { qty: (x, y) => y.qty - x.qty || y.revenue - x.revenue, qa: (x, y) => x.qty - y.qty || x.revenue - y.revenue, pd: (x, y) => y.price - x.price, pa: (x, y) => x.price - y.price, orders: (x, y) => y.orderCount - x.orderCount || y.qty - x.qty }[s];
    return a.sort(cmp);
  }
  function render() {
    const a = list();
    $("#grid").innerHTML = a.slice(0, st.shown).map(App.productCard).join("") || App.emptyBox(t("shop_none"));
    $("#count").textContent = t("shop_showing", { n: Math.min(st.shown, a.length), m: a.length });
    $("#more").hidden = st.shown >= a.length;
  }
  const reset = () => { st.shown = PAGE; render(); };
  $("#q").addEventListener("input", App.debounce(e => { st.q = App.clean(e.target.value, 60); reset(); }, 120));
  $("#sort").addEventListener("change", e => { st.sort = e.target.value; reset(); });
  $("#tiers").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    App.$$("#tiers .chip").forEach(c => c.classList.toggle("on", c === b)); st.tier = +b.dataset.t;
    $("#pmin").value = ""; $("#pmax").value = ""; st.min = st.max = null; reset();
  });
  const rng = () => { const a = parseFloat($("#pmin").value), b = parseFloat($("#pmax").value); st.min = isNaN(a) ? null : a; st.max = isNaN(b) ? null : b; st.tier = -1; App.$$("#tiers .chip").forEach(c => c.classList.toggle("on", c.dataset.t === "-1")); reset(); };
  $("#pmin").addEventListener("input", App.debounce(rng, 200)); $("#pmax").addEventListener("input", App.debounce(rng, 200));
  $("#more").addEventListener("click", () => { st.shown += PAGE; render(); });
  App.bindAddButtons($("#grid")); App.enableTilt($("#grid")); App.enableTilt($("#stage"));
  App.applyI18n(); render(); App.mountFooter();
})();
