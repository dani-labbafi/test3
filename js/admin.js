/* admin.js — management panel. Every number is computed from data.js (+ optional orders saved in this browser).
   Nothing is invented: inventory levels / order status do not exist in the dataset and are never fabricated. */
(function () {
  "use strict";
  const { t, esc, money, num, pct, N, $, $$, titleCase } = App;
  App.mountHeader("admin", { admin: true });

  /* ---------- state ---------- */
  const ALL = App.allRows(true);
  const DATES = [...new Set(ALL.map(r => r.date))].sort();
  const D = { rows: [], ords: [], prods: [], abc: new Map(), tiers: [], edges: null };
  const FIL = { country: "all", from: DATES[0], to: DATES[DATES.length - 1], local: true };
  let view = "overview";
  const metricOf = { revenue: p => p.revenue, units: p => p.qty, orders: p => p.orderCount };

  function compute() {
    let rows = App.allRows(FIL.local);
    rows = rows.filter(r => r.date >= FIL.from && r.date <= FIL.to && (FIL.country === "all" || r.country === FIL.country));
    D.rows = rows; D.ords = App.orders(rows); D.prods = App.products(rows);
    const sorted = [...D.prods].sort((a, b) => b.revenue - a.revenue), tot = App.sum(sorted, p => p.revenue) || 1;
    let cum = 0; D.abc = new Map();
    sorted.forEach(p => { const before = cum / tot; cum += p.revenue; D.abc.set(p.name, before < .8 ? "A" : before < .95 ? "B" : "C"); });
    D.sortedRev = sorted; D.totalRev = tot;
    const base = App.products(App.allRows(false));
    if (!D.edges) D.edges = App.defaultEdges(base);
    D.tiers = App.tiersFromEdges(D.edges);
  }

  /* ---------- generic sortable table ---------- */
  function table(host, cols, getRows, opt) {
    opt = opt || {};
    const st = { k: opt.sort ? opt.sort[0] : cols[0].k, d: opt.sort ? opt.sort[1] : -1 }, el = $(host);
    function draw() {
      const col = cols.find(c => c.k === st.k) || cols[0], rows = getRows().sort((a, b) => { const x = col.v(a), y = col.v(b); return (typeof x === "string" ? x.localeCompare(y) : x - y) * st.d; });
      const lim = opt.limit || 300;
      el.innerHTML = `<table><thead><tr>${cols.map(c => `<th class="s ${c.n ? "n" : ""}" data-k="${c.k}" ${c.k === st.k ? `aria-sort="${st.d > 0 ? "ascending" : "descending"}"` : ""} tabindex="0">${esc(t(c.label))}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, lim).map((r, i) => `<tr ${opt.row ? `class="click" data-i="${i}" tabindex="0"` : ""}>${cols.map(c => `<td class="${c.n ? "n" : ""} ${c.l ? "l" : ""}">${c.r(r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="empty">${esc(t("none_match"))}</td></tr>`}</tbody></table>`;
      if (opt.count) opt.count(rows.length);
      el.querySelectorAll("th.s").forEach(th => { const go = () => { if (st.k === th.dataset.k) st.d *= -1; else { st.k = th.dataset.k; st.d = -1; } draw(); }; th.onclick = go; th.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }; });
      if (opt.row) el.querySelectorAll("tr.click").forEach(tr => { const go = () => opt.row(rows[+tr.dataset.i]); tr.onclick = go; tr.onkeydown = e => { if (e.key === "Enter") go(); }; });
    }
    return draw;
  }
  const sel = (id, opts, cur, aria) => `<select id="${id}" aria-label="${esc(t(aria || id))}">${opts.map(o => `<option value="${esc(o[0])}" ${o[0] === cur ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
  const metricOpts = () => [["revenue", t("m_revenue")], ["units", t("m_units")], ["orders", t("m_orders")]];

  /* ---------- skeleton of all views ---------- */
  const NAV = [["overview", "ad_overview"], ["charts", "ad_charts"], ["products", "ad_products"], ["orders", "ad_orders"], ["pricing", "ad_pricing"], ["insights", "ad_insights"], ["system", "ad_system"]];
  $("#side").innerHTML = NAV.map(n => `<a href="#${n[0]}" data-v="${n[0]}">${esc(t(n[1]))}</a>`).join("");
  $("#views").innerHTML = `
    <section class="view" id="v-overview"><h2>${esc(t("ad_overview"))}</h2><p class="sub">${esc(t("ad_overview_sub"))}</p><div class="kpis" id="kpis"></div><div id="scope" style="margin-top:18px"></div><div id="quality" style="margin-top:14px"></div></section>
    <section class="view" id="v-charts"><h2>${esc(t("ad_charts"))}</h2><p class="sub">${esc(t("ch_sub"))}</p><div class="charts">
      <div class="panel"><h3>${esc(t("ch_sales_trend"))}</h3><div class="cbox" id="c1"></div></div>
      <div class="panel"><h3>${esc(t("ch_rev_trend"))}</h3><div class="cbox" id="c2"></div></div>
      <div class="panel"><div class="bar" style="margin-bottom:6px"><h3 style="margin:0;flex:1">${esc(t("ch_top"))}</h3>${sel("topM", metricOpts(), "units", "ch_metric")}${sel("topN", [["5", "5"], ["10", "10"], ["15", "15"], ["20", "20"]], "10", "ch_count")}</div><div class="cbox" id="c3"></div></div>
      <div class="panel"><div class="bar" style="margin-bottom:6px"><h3 style="margin:0;flex:1">${esc(t("ch_country"))}</h3>${sel("ctM", metricOpts(), "revenue", "ch_metric")}</div><div class="cbox" id="c4"></div></div>
      <div class="panel"><h3>${esc(t("ch_orderdist"))}</h3><div class="cbox" id="c5"></div></div>
      <div class="panel"><div class="bar" style="margin-bottom:6px"><h3 style="margin:0;flex:1">${esc(t("ch_hour"))}</h3>${sel("hrM", [["orders", t("m_orders")], ["revenue", t("m_revenue")], ["units", t("m_units")]], "orders", "ch_metric")}</div><div class="cbox" id="c6"></div></div>
      <div class="panel wide"><h3>${esc(t("ch_compare"))}</h3><p class="meta" style="margin-bottom:10px">${esc(t("ch_compare_sub"))}</p><div class="cmp" id="cmpSel"></div><div class="cbox" id="c7"></div></div></div></section>
    <section class="view" id="v-products"><h2>${esc(t("ad_products"))}</h2><p class="sub">${esc(t("pr_sub"))}</p>
      <div class="bar"><input id="pq" type="search" maxlength="60" placeholder="${esc(t("shop_search"))}" aria-label="${esc(t("shop_search"))}" style="max-width:260px">
        <label class="meta">${esc(t("f_price"))}</label><input id="ppmin" type="number" min="0" step="0.01" placeholder="min" style="width:90px"><input id="ppmax" type="number" min="0" step="0.01" placeholder="max" style="width:90px">
        <label class="meta">${esc(t("m_units"))}</label><input id="pumin" type="number" min="0" placeholder="min" style="width:90px"><input id="pumax" type="number" min="0" placeholder="max" style="width:90px">
        <span class="spacer"></span><span class="meta" id="pcount"></span><button class="btn ghost sm" id="pcsv" type="button">${esc(t("btn_csv_products"))}</button></div><div class="tw" id="ptb"></div></section>
    <section class="view" id="v-orders"><h2>${esc(t("ad_orders"))}</h2><p class="sub">${esc(t("or_sub"))}</p>
      <div class="bar"><input id="oq" type="search" maxlength="60" placeholder="${esc(t("or_search"))}" aria-label="${esc(t("or_search"))}" style="max-width:340px">
        ${sel("osrc", [["all", t("or_src_all")], ["dataset", t("or_src_dataset")], ["local", t("or_src_local")]], "all", "or_src")}<span class="spacer"></span><span class="meta" id="ocount"></span><button class="btn ghost sm" id="ocsv" type="button">${esc(t("btn_csv_orders"))}</button></div><div class="tw" id="otb"></div></section>
    <section class="view" id="v-pricing"><h2>${esc(t("ad_pricing"))}</h2><p class="sub">${esc(t("pt_sub"))}</p>
      <div class="filters"><div class="field"><label for="e0">${esc(t("pt_edge", { n: 1 }))}</label><input id="e0" type="number" min="0" step="0.05"></div><div class="field"><label for="e1">${esc(t("pt_edge", { n: 2 }))}</label><input id="e1" type="number" min="0" step="0.05"></div><div class="field"><label for="e2">${esc(t("pt_edge", { n: 3 }))}</label><input id="e2" type="number" min="0" step="0.05"></div><button class="btn ghost sm" id="eReset" type="button">${esc(t("pt_reset"))}</button></div>
      <p class="meta" id="ptNote" style="margin-bottom:12px"></p><div class="charts"><div class="panel"><div class="tw" id="ptt" style="max-height:none"></div></div><div class="panel"><h3>${esc(t("pt_chart"))}</h3><div class="cbox" id="c8"></div></div></div></section>
    <section class="view" id="v-insights"><h2>${esc(t("ad_insights"))}</h2><p class="sub">${esc(t("in_sub"))}</p><div class="ins" id="ins"></div></section>
    <section class="view" id="v-system"><h2>${esc(t("ad_system"))}</h2><p class="sub">${esc(t("sy_sub"))}</p><div class="ins" id="sys"></div></section>`;

  /* ---------- overview ---------- */
  function renderOverview() {
    const rev = App.sum(D.rows, r => r.total_amount), units = App.sum(D.rows, r => r.quantity), best = [...D.prods].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)[0];
    const K = [[t("k_orders"), N(num(D.ords.length))], [t("k_products"), N(num(D.prods.length))], [t("k_customers"), N(num(new Set(D.rows.map(r => r.customerKey)).size))], [t("k_revenue"), N(money(rev))],
      [t("k_aov"), N(money(D.ords.length ? rev / D.ords.length : 0))], [t("k_units"), N(num(units))]];
    $("#kpis").innerHTML = K.map(k => `<div class="kpi"><span>${esc(k[0])}</span><b>${k[1]}</b></div>`).join("") +
      `<div class="kpi sm"><span>${esc(t("k_top"))}</span><b>${best ? esc(titleCase(best.name)) : "-"}</b>${best ? `<span>${N(num(best.qty))} ${esc(t("m_units"))} · ${N(best.orderCount)} ${esc(t("m_orders"))}</span>` : ""}</div>`;
    const local = D.rows.filter(r => r.source === "local").length;
    $("#scope").innerHTML = `<div class="note info">${esc(t("ov_scope", { rows: D.rows.length, d: new Set(D.rows.map(r => r.date)).size, a: FIL.from, b: FIL.to }))} ${local ? esc(t("ov_local", { n: App.orders(D.rows.filter(r => r.source === "local")).length })) : ""}</div>`;
    const q = dataQuality();
    $("#quality").innerHTML = q.length ? `<div class="note"><b>${esc(t("dq_h"))}</b><ul style="margin:6px 0 0;padding-inline-start:18px">${q.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
  }
  function dataQuality() {
    const out = [], base = App.datasetRows(), dates = [...new Set(base.map(r => r.date))].sort();
    const dd = new Set(dates.map(d => d.slice(8))), mm = new Set(dates.map(d => d.slice(5, 7)));
    if (dates.length > 1 && dd.size === 1 && mm.size > 1) out.push(t("dq_dates", { n: dates.length, day: [...dd][0], months: [...mm].join(", ") }));
    const mp = App.products(base).filter(p => p.priceCount > 1); if (mp.length) out.push(t("dq_multiprice", { names: mp.map(p => titleCase(p.name) + " (" + [...p.prices].sort((a, b) => a - b).map(money).join(" / ") + ")").join("; ") }));
    const man = base.find(r => r.stockcode === "M" || /^manual$/i.test(r.description)); if (man) out.push(t("dq_manual"));
    out.push(t("dq_currency"));
    return out;
  }

  /* ---------- charts ---------- */
  function byDate(valFn) { const m = App.groupSum(D.rows, r => r.date, valFn); const ds = Object.keys(m).sort(); return { ds, m }; }
  function renderCharts() {
    const rev = byDate(r => r.total_amount), un = byDate(r => r.quantity), ob = {}; D.ords.forEach(o => { ob[o.date] = (ob[o.date] || 0) + 1; });
    const ds = rev.ds;
    Charts.line($("#c1"), { title: t("ch_sales_trend"), labels: ds, series: [{ name: t("m_units"), color: "#3b82f6", data: ds.map(d => un.m[d] || 0) }, { name: t("m_orders"), color: "#22d3ee", data: ds.map(d => ob[d] || 0) }], area: false, fmt: v => num(v), empty: t("no_data") });
    Charts.line($("#c2"), { title: t("ch_rev_trend"), labels: ds, series: [{ name: t("m_revenue"), color: "#7dd3fc", data: ds.map(d => +(rev.m[d] || 0).toFixed(2)) }], fmt: money, empty: t("no_data") });
    const mname = { revenue: t("m_revenue"), units: t("m_units"), orders: t("m_orders") }, fm = k => k === "revenue" ? money : num;
    const tm = $("#topM").value, tn = +$("#topN").value, top = [...D.prods].sort((a, b) => metricOf[tm](b) - metricOf[tm](a) || b.revenue - a.revenue).slice(0, tn);
    Charts.bar($("#c3"), { title: t("ch_top"), horizontal: true, labels: top.map(p => titleCase(p.name)), series: [{ name: mname[tm], color: "#3b82f6", data: top.map(metricOf[tm]) }], fmt: fm(tm), empty: t("no_data") });
    const cm = $("#ctM").value, cg = App.groupSum(D.rows, r => r.country, cm === "revenue" ? r => r.total_amount : cm === "units" ? r => r.quantity : () => 0);
    if (cm === "orders") D.ords.forEach(o => { cg[o.country] = (cg[o.country] || 0) + 1; });
    Charts.donut($("#c4"), { title: t("ch_country"), items: Object.entries(cg).map(([label, value]) => ({ label, value })), fmt: fm(cm), centerLabel: mname[cm], otherLabel: t("other"), empty: t("no_data") });
    // order value distribution
    const cand = [0, 10, 20, 50, 100, 200, 500, 1000, 5000], mx = Math.max(0, ...D.ords.map(o => o.total)), edges = cand.filter((e, i) => i === 0 || cand[i - 1] < mx);
    const bins = edges.map((lo, i) => ({ lo, hi: edges[i + 1] != null ? edges[i + 1] : Infinity, n: 0 }));
    D.ords.forEach(o => { const b = bins.find(b => o.total >= b.lo && o.total < b.hi) || bins[bins.length - 1]; b.n++; });
    Charts.bar($("#c5"), { title: t("ch_orderdist"), labels: bins.map(b => b.hi === Infinity ? "$" + b.lo + "+" : "$" + b.lo + "–" + b.hi), series: [{ name: t("m_orders"), color: "#2dd4bf", data: bins.map(b => b.n) }], fmt: num, empty: t("no_data"), xTitle: t("ch_orderdist_x") });
    const hm = $("#hrM").value, hv = {};
    D.ords.forEach(o => { const h = o.hour; if (h == null) return; hv[h] = (hv[h] || 0) + (hm === "orders" ? 1 : hm === "revenue" ? o.total : o.units); });
    const hs = Object.keys(hv).map(Number).sort((a, b) => a - b);
    Charts.bar($("#c6"), { title: t("ch_hour"), labels: hs.map(h => h + ":00"), series: [{ name: mname[hm], color: "#22d3ee", data: hs.map(h => hv[h]) }], fmt: hm === "revenue" ? money : num, empty: t("no_data") });
    renderCompare();
  }
  let cmpPick = null;
  function renderCompare() {
    const names = [...D.prods].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).map(p => p.name), all = [...D.prods].map(p => p.name).sort();
    if (!cmpPick) cmpPick = names.slice(0, 3);
    cmpPick = cmpPick.filter(n => all.includes(n)); while (cmpPick.length < 2 && names.length > cmpPick.length) cmpPick.push(names.find(n => !cmpPick.includes(n)));
    const slots = Math.min(4, Math.max(cmpPick.length, 3));
    $("#cmpSel").innerHTML = Array.from({ length: slots }, (_, i) => `<select data-ci="${i}" aria-label="${esc(t("ch_compare"))} ${i + 1}"><option value="">—</option>${all.map(n => `<option value="${esc(n)}" ${cmpPick[i] === n ? "selected" : ""}>${esc(titleCase(n))}</option>`).join("")}</select>`).join("");
    $$("#cmpSel select").forEach(s => s.onchange = () => { cmpPick = $$("#cmpSel select").map(x => x.value).filter(Boolean); renderCompare(); });
    const P = cmpPick.map(n => D.prods.find(p => p.name === n)).filter(Boolean);
    if (P.length < 2) { $("#c7").innerHTML = App.emptyBox(t("ch_compare_need")); return; }
    const mx = { revenue: Math.max(...P.map(p => p.revenue)) || 1, units: Math.max(...P.map(p => p.qty)) || 1, orders: Math.max(...P.map(p => p.orderCount)) || 1 };
    const keys = ["revenue", "units", "orders"], raw = { revenue: p => money(p.revenue), units: p => num(p.qty), orders: p => num(p.orderCount) };
    Charts.bar($("#c7"), { title: t("ch_compare"), labels: [t("m_revenue"), t("m_units"), t("m_orders")], series: P.map((p, i) => ({ name: titleCase(p.name), color: Charts.PALETTE[i], data: keys.map(k => 100 * metricOf[k](p) / mx[k]), fmt: (v, j) => raw[keys[j]](p) + " (" + v.toFixed(0) + "%)" })), fmt: v => v.toFixed(0) + "%" });
  }
  ["topM", "topN", "ctM", "hrM"].forEach(id => $("#" + id).addEventListener("change", renderCharts));

  /* ---------- products ---------- */
  const pf = () => { const g = id => { const v = parseFloat($(id).value); return isNaN(v) ? null : v; }; return { q: $("#pq").value.trim().toLowerCase(), pmin: g("#ppmin"), pmax: g("#ppmax"), umin: g("#pumin"), umax: g("#pumax") }; };
  const prodRows = () => { const f = pf(); return D.prods.filter(p => (!f.q || p.name.toLowerCase().includes(f.q) || p.stockcode.toLowerCase().includes(f.q)) && (f.pmin == null || p.price >= f.pmin) && (f.pmax == null || p.price <= f.pmax) && (f.umin == null || p.qty >= f.umin) && (f.umax == null || p.qty <= f.umax)); };
  const tierOf = p => { const x = D.tiers.find(z => App.inTier(p, z)); return x ? x.label : "-"; };
  const drawProducts = table("#ptb", [
    { k: "name", label: "col_product", v: p => p.name, r: p => `<a href="product.html?id=${encodeURIComponent(p.stockcode)}">${esc(titleCase(p.name))}</a>`, l: 1 },
    { k: "code", label: "col_code", v: p => p.stockcode, r: p => N(p.stockcode), l: 1 }, { k: "price", label: "col_price", n: 1, v: p => p.price, r: p => money(p.price) },
    { k: "qty", label: "col_units", n: 1, v: p => p.qty, r: p => num(p.qty) }, { k: "oc", label: "col_orders", n: 1, v: p => p.orderCount, r: p => p.orderCount },
    { k: "rev", label: "col_revenue", n: 1, v: p => p.revenue, r: p => money(p.revenue) }, { k: "upo", label: "col_upo", n: 1, v: p => p.unitsPerOrder, r: p => num(+p.unitsPerOrder.toFixed(1)) },
    { k: "abc", label: "col_abc", v: p => D.abc.get(p.name) || "", r: p => `<span class="tag ${(D.abc.get(p.name) || "c").toLowerCase()}">${D.abc.get(p.name) || "-"}</span>` }, { k: "tier", label: "col_tier", v: p => p.price, r: p => N(tierOf(p)) }
  ], prodRows, { sort: ["rev", -1], count: n => { $("#pcount").textContent = t("n_of", { n, m: D.prods.length }); } });
  ["pq", "ppmin", "ppmax", "pumin", "pumax"].forEach(id => $("#" + id).addEventListener("input", App.debounce(drawProducts, 120)));
  $("#pcsv").onclick = () => App.downloadText("products.csv", ["stockcode,product,price,units,orders,revenue,units_per_order,abc_class"].concat(prodRows().map(p => [App.csvCell(p.stockcode), App.csvCell(p.name), p.price, p.qty, p.orderCount, p.revenue.toFixed(2), p.unitsPerOrder.toFixed(2), D.abc.get(p.name)].join(","))).join("\n"), "text/csv");

  /* ---------- orders ---------- */
  const ordRows = () => { const q = $("#oq").value.trim().toLowerCase(), s = $("#osrc").value; return D.ords.filter(o => (s === "all" || o.source === s) && (!q || o.code.toLowerCase().includes(q) || o.country.toLowerCase().includes(q) || String(o.customerid || "").includes(q) || (o.customerName || "").toLowerCase().includes(q) || o.lines.some(l => l.description.toLowerCase().includes(q)))); };
  const cust = o => o.customerName ? esc(o.customerName) : N(o.customerid || "-");
  const drawOrders = table("#otb", [
    { k: "code", label: "col_invoice", v: o => o.code, r: o => `<span class="tag">${esc(o.code)}</span>`, l: 1 }, { k: "date", label: "col_date", v: o => o.date + String(o.hour || 0).padStart(2, "0"), r: o => N(o.date), l: 1 },
    { k: "cust", label: "col_customer", v: o => String(o.customerName || o.customerid), r: cust, l: 1 }, { k: "country", label: "col_country", v: o => o.country, r: o => N(o.country), l: 1 },
    { k: "items", label: "col_items", n: 1, v: o => o.lines.length, r: o => o.lines.length }, { k: "units", label: "col_units", n: 1, v: o => o.units, r: o => num(o.units) }, { k: "total", label: "col_total", n: 1, v: o => o.total, r: o => money(o.total) },
    { k: "src", label: "col_source", v: o => o.source, r: o => `<span class="tag ${o.source === "local" ? "warn" : "c"}">${esc(t(o.source === "local" ? "or_src_local" : "or_src_dataset"))}</span>` }
  ], ordRows, { sort: ["date", -1], row: openOrder, count: n => { $("#ocount").textContent = t("n_of", { n, m: D.ords.length }); } });
  ["oq", "osrc"].forEach(id => $("#" + id).addEventListener(id === "oq" ? "input" : "change", App.debounce(drawOrders, 120)));
  function openOrder(o) {
    $("#dlgT").innerHTML = `${esc(t("tr_order"))} <span class="num">${esc(o.code)}</span>`;
    $("#dlgB").innerHTML = `<div class="meta" style="margin-bottom:10px">${N(o.date)} · ${N(o.country)} · ${cust(o)}</div><div class="tw"><table><thead><tr><th>${esc(t("tr_product"))}</th><th class="n">${esc(t("co_qty"))}</th><th class="n">${esc(t("tr_unit"))}</th><th class="n">${esc(t("tr_amount"))}</th></tr></thead><tbody>${o.lines.map(l => `<tr><td class="l">${esc(titleCase(l.description))}</td><td class="n">${num(l.quantity)}</td><td class="n">${money(l.unitprice)}</td><td class="n">${money(l.total_amount)}</td></tr>`).join("")}</tbody></table></div><div class="sum t"><span>${esc(t("co_total"))}</span><span class="num">${money(o.total)}</span></div>`;
    $("#dlg").showModal();
  }
  $("#dlgX").onclick = () => $("#dlg").close(); $("#dlg").addEventListener("click", e => { if (e.target === $("#dlg")) $("#dlg").close(); });
  $("#ocsv").onclick = () => App.downloadText("orders.csv", ["order_code,date,hour,country,customer,items,units,total,source"].concat(ordRows().map(o => [App.csvCell(o.code), o.date, o.hour == null ? "" : o.hour, App.csvCell(o.country), App.csvCell(o.customerName || o.customerid || ""), o.lines.length, o.units, o.total.toFixed(2), o.source].join(","))).join("\n"), "text/csv");

  /* ---------- price tiers ---------- */
  function renderPricing() {
    const base = App.products(App.allRows(false));
    [0, 1, 2].forEach(i => { const el = $("#e" + i); if (document.activeElement !== el) el.value = D.edges[i] != null ? D.edges[i] : ""; });
    const rows = D.tiers.map(tr => { const ps = D.prods.filter(p => App.inTier(p, tr)); return { tr, n: ps.length, units: App.sum(ps, p => p.qty), rev: App.sum(ps, p => p.revenue) }; });
    const totN = App.sum(rows, r => r.n) || 1, totR = App.sum(rows, r => r.rev) || 1;
    $("#ptNote").textContent = t("pt_note", { n: base.length, q1: money(D.edges[0]), q2: money(D.edges[1]), q3: money(D.edges[2]) });
    $("#ptt").innerHTML = `<table><thead><tr><th>${esc(t("col_tier"))}</th><th class="n">${esc(t("col_products"))}</th><th class="n">${esc(t("col_units"))}</th><th class="n">${esc(t("col_revenue"))}</th><th class="n">${esc(t("col_share"))}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${N(r.tr.label)}</td><td class="n">${r.n} <span class="meta">(${pct(r.n / totN)})</span></td><td class="n">${num(r.units)}</td><td class="n">${money(r.rev)}</td><td class="n">${pct(r.rev / totR)}</td></tr>`).join("")}</tbody></table>`;
    Charts.bar($("#c8"), { title: t("pt_chart"), labels: rows.map(r => r.tr.label), series: [{ name: t("col_products"), color: "#3b82f6", data: rows.map(r => 100 * r.n / totN), fmt: (v, i) => rows[i].n + " (" + v.toFixed(1) + "%)" }, { name: t("col_share"), color: "#22d3ee", data: rows.map(r => 100 * r.rev / totR), fmt: v => v.toFixed(1) + "%" }], fmt: v => v.toFixed(0) + "%" });
  }
  const readEdges = () => { const v = [0, 1, 2].map(i => parseFloat($("#e" + i).value)); if (v.every(x => x > 0) && v[0] < v[1] && v[1] < v[2]) { D.edges = v; D.tiers = App.tiersFromEdges(v); renderPricing(); } };
  [0, 1, 2].forEach(i => $("#e" + i).addEventListener("input", App.debounce(readEdges, 250)));
  $("#eReset").onclick = () => { D.edges = App.defaultEdges(App.products(App.allRows(false))); D.tiers = App.tiersFromEdges(D.edges); renderPricing(); };

  /* ---------- insights (only what the data supports) ---------- */
  const li = (name, extra) => `<li><span class="l">${esc(titleCase(name))}</span> — ${extra}</li>`;
  function renderInsights() {
    const P = D.prods, O = D.ords, tot = D.totalRev, byRev = D.sortedRev, byQty = [...P].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
    const A = P.filter(p => D.abc.get(p.name) === "A"), B = P.filter(p => D.abc.get(p.name) === "B"), C = P.filter(p => D.abc.get(p.name) === "C");
    const single = P.filter(p => p.orderCount === 1).length, ds = new Set(D.rows.map(r => r.date)).size;
    const upo = [...P].map(p => p.unitsPerOrder).sort((a, b) => a - b), p90 = App.quantile(upo, .9), bulk = P.filter(p => p.unitsPerOrder >= p90 && p.unitsPerOrder > 1).sort((a, b) => b.unitsPerOrder - a.unitsPerOrder);
    const hv = {}; O.forEach(o => { if (o.hour != null) hv[o.hour] = (hv[o.hour] || 0) + 1; }); const hb = Object.entries(hv).sort((a, b) => b[1] - a[1])[0];
    const dv = App.groupSum(D.rows, r => r.date, r => r.total_amount), db = Object.entries(dv).sort((a, b) => b[1] - a[1])[0];
    const elig = P.filter(p => p.dateCount >= 3);
    let trend = "";
    if (!elig.length) trend = `<p class="note">${esc(t("in_trend_none", { n: P.filter(p => p.dateCount >= 2).length, m: P.length }))}</p>`;
    else { // slope of daily units for products sold on >=3 different dates
      const days = [...new Set(D.rows.map(r => r.date))].sort(), sl = elig.map(p => { const ys = days.map(d => App.sum(D.rows.filter(r => r.description === p.name && r.date === d), r => r.quantity)), n = ys.length, mx = (n - 1) / 2, my = App.sum(ys, y => y) / n; let nu = 0, de = 0; ys.forEach((y, i) => { nu += (i - mx) * (y - my); de += (i - mx) * (i - mx); }); return { p, s: de ? nu / de : 0 }; }).sort((a, b) => b.s - a.s);
      trend = `<ul>${sl.slice(0, 3).map(x => li(x.p.name, `${esc(t("in_growth"))} <span class="num">${x.s.toFixed(2)}</span>`)).join("")}${sl.slice(-3).reverse().map(x => li(x.p.name, `${esc(t("in_decline"))} <span class="num">${x.s.toFixed(2)}</span>`)).join("")}</ul>`;
    }
    const dkeys = Object.keys(dv).sort(), dTrend = dkeys.length > 1 ? `${N(money(dv[dkeys[0]]))} → ${N(money(dv[dkeys[dkeys.length - 1]]))}` : "";
    const attention = []; // products that merit a manager's look, based ONLY on sales data
    A.forEach(p => attention.push([p, [t("rs_classA")]])); bulk.forEach(p => { const e = attention.find(x => x[0] === p); if (e) e[1].push(t("rs_bulk")); else attention.push([p, [t("rs_bulk")]]); });
    P.filter(p => p.priceCount > 1).forEach(p => { const e = attention.find(x => x[0] === p); if (e) e[1].push(t("rs_price")); else attention.push([p, [t("rs_price")]]); });
    attention.sort((a, b) => b[1].length - a[1].length || b[0].revenue - a[0].revenue);
    $("#ins").innerHTML = `
      <div class="panel"><h3>${esc(t("in_abc"))}<small>${esc(t("in_abc_sub"))}</small></h3><div class="cbox" id="c9"></div><ul style="margin-top:10px"><li><span class="tag a">A</span> ${esc(t("in_abc_line", { n: A.length, p: pct(A.length / (P.length || 1)), r: pct(App.sum(A, p => p.revenue) / tot) }))}</li><li><span class="tag b">B</span> ${esc(t("in_abc_line", { n: B.length, p: pct(B.length / (P.length || 1)), r: pct(App.sum(B, p => p.revenue) / tot) }))}</li><li><span class="tag c">C</span> ${esc(t("in_abc_line", { n: C.length, p: pct(C.length / (P.length || 1)), r: pct(App.sum(C, p => p.revenue) / tot) }))}</li></ul></div>
      <div class="panel"><h3>${esc(t("in_best"))}<small>${esc(t("in_best_sub"))}</small></h3><ul>${byQty.slice(0, 5).map(p => li(p.name, `${N(num(p.qty))} ${esc(t("m_units"))} · ${N(money(p.revenue))}`)).join("")}</ul><h3 style="margin-top:16px">${esc(t("in_low"))}<small>${esc(t("in_low_sub", { n: single, m: P.length }))}</small></h3><ul>${[...byRev].reverse().slice(0, 5).map(p => li(p.name, `${N(num(p.qty))} ${esc(t("m_units"))} · ${N(money(p.revenue))}`)).join("")}</ul></div>
      <div class="panel"><h3>${esc(t("in_time"))}<small>${esc(t("in_time_sub", { o: O.length, d: ds }))}</small></h3><ul>${hb ? `<li>${esc(t("in_busy_hour"))}: <b class="num">${hb[0]}:00</b> — ${N(hb[1])} ${esc(t("m_orders"))}</li>` : ""}${db ? `<li>${esc(t("in_busy_day"))}: <b class="num">${esc(db[0])}</b> — ${N(money(db[1]))}</li>` : ""}${dTrend ? `<li>${esc(t("in_day_change"))}: ${dTrend}</li>` : ""}</ul><p class="meta" style="margin-top:8px">${esc(t("in_time_warn"))}</p></div>
      <div class="panel"><h3>${esc(t("in_trend"))}<small>${esc(t("in_trend_sub"))}</small></h3>${trend}</div>
      <div class="panel"><h3>${esc(t("in_bulk"))}<small>${esc(t("in_bulk_sub"))}</small></h3><ul>${bulk.slice(0, 6).map(p => li(p.name, `${N(num(+p.unitsPerOrder.toFixed(1)))} ${esc(t("col_upo"))} · ${N(p.orderCount)} ${esc(t("m_orders"))}`)).join("") || `<li>${esc(t("none_match"))}</li>`}</ul></div>
      <div class="panel"><h3>${esc(t("in_attention"))}<small>${esc(t("in_attention_sub"))}</small></h3><ul>${attention.slice(0, 10).map(a => li(a[0].name, a[1].map(x => `<span class="tag warn">${esc(x)}</span>`).join(" "))).join("") || `<li>${esc(t("none_match"))}</li>`}</ul><p class="note" style="margin-top:12px">${esc(t("in_noinv"))}</p></div>`;
    let cum = 0; const top = byRev.slice(0, 20), cumL = top.map(p => { cum += p.revenue; return 100 * cum / tot; });
    Charts.bar($("#c9"), { title: t("in_abc"), labels: top.map((p, i) => String(i + 1)), series: [{ name: t("m_revenue"), color: "#3b82f6", data: top.map(p => p.revenue), fmt: (v, i) => titleCase(top[i].name) + ": " + money(v) }], line: { name: t("in_cum"), data: cumL }, fmt: money, xTitle: t("in_rank") });
  }

  /* ---------- system / architecture ---------- */
  function renderSystem() {
    const loc = App.savedOrders();
    $("#sys").innerHTML = `
      <div class="panel"><h3>${esc(t("sy_storage"))}</h3><p>${esc(t("sy_storage_p"))}</p><ul style="margin-top:10px"><li>${esc(t("sy_dataset"))}: <b class="num">${App.orders(App.datasetRows()).length}</b> ${esc(t("m_orders"))}</li><li>${esc(t("sy_local"))}: <b class="num">${loc.length}</b> ${esc(t("m_orders"))}</li><li>${esc(t("sy_ls"))}: <b>${esc(App.storageOk ? t("yes") : t("no"))}</b></li></ul>
        <div class="acts"><button class="btn ghost sm" id="expJ" type="button">${esc(t("sy_export"))}</button><button class="btn danger sm" id="reset" type="button">${esc(t("sy_reset"))}</button></div></div>
      <div class="panel"><h3>${esc(t("sy_backend"))}</h3><p>${esc(t("sy_backend_p"))}</p><ul style="margin-top:10px"><li>${esc(t("sy_b1"))}</li><li>${esc(t("sy_b2"))}</li><li>${esc(t("sy_b3"))}</li><li>${esc(t("sy_b4"))}</li></ul><p class="meta" style="margin-top:10px">${esc(t("sy_doc"))}: <a href="docs/ARCHITECTURE.md"><span class="num">docs/ARCHITECTURE.md</span></a></p></div>
      <div class="panel"><h3>${esc(t("sy_security"))}</h3><p>${esc(t("sy_security_p"))}</p></div>
      <div class="panel"><h3>${esc(t("sy_missing"))}</h3><ul><li>${esc(t("sy_m1"))}</li><li>${esc(t("sy_m2"))}</li><li>${esc(t("sy_m3"))}</li><li>${esc(t("sy_m4"))}</li></ul></div>`;
    $("#expJ").onclick = () => App.downloadText("local-orders.json", JSON.stringify(loc, null, 2), "application/json");
    $("#reset").onclick = () => { if (confirm(t("sy_reset_q"))) { App.clearSavedOrders(); refresh(); } };
  }

  /* ---------- routing & refresh ---------- */
  const RENDER = { overview: renderOverview, charts: renderCharts, products: () => drawProducts(), orders: () => drawOrders(), pricing: renderPricing, insights: renderInsights, system: renderSystem };
  function show() {
    const h = location.hash.slice(1); view = RENDER[h] ? h : "overview";
    $$(".view").forEach(v => v.classList.toggle("on", v.id === "v-" + view)); $$("#side a").forEach(a => { a.classList.toggle("on", a.dataset.v === view); if (a.dataset.v === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("#filters").hidden = view === "system"; RENDER[view]();
  }
  function refresh() { compute(); show(); }
  addEventListener("hashchange", () => { show(); scrollTo({ top: 0 }); });

  $("#fc").innerHTML = `<option value="all">${esc(t("f_all_countries"))}</option>` + [...new Set(ALL.map(r => r.country))].sort().map(c => `<option>${esc(c)}</option>`).join("");
  $("#fd1").innerHTML = $("#fd2").innerHTML = DATES.map(d => `<option>${esc(d)}</option>`).join(""); $("#fd2").value = FIL.to;
  $("#fc").onchange = e => { FIL.country = e.target.value; refresh(); };
  $("#fd1").onchange = e => { FIL.from = e.target.value; if (FIL.from > FIL.to) { FIL.to = FIL.from; $("#fd2").value = FIL.to; } refresh(); };
  $("#fd2").onchange = e => { FIL.to = e.target.value; if (FIL.to < FIL.from) { FIL.from = FIL.to; $("#fd1").value = FIL.from; } refresh(); };
  $("#fl").onchange = e => { FIL.local = e.target.checked; refresh(); };
  App.applyI18n(); refresh(); App.mountFooter();
})();
