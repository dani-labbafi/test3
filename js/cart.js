/* cart.js — cart, checkout form, order creation and receipt.
   IMPORTANT: orders are saved in this browser's LocalStorage only. They are not sent to any server. */
(function () {
  "use strict";
  const { t, esc, money, num, N, $ } = App;
  App.mountHeader("shop");
  const P = App.products(App.allRows(false)); // catalog = original dataset only (local orders never change prices)
  const countries = App.countryList();
  $("#ccountry").innerHTML = countries.map(c => `<option>${esc(c)}</option>`).join(""); $("#ccountry").value = "United Kingdom";
  $("#localNote").textContent = App.storageOk ? t("co_local_note") : t("co_no_storage");
  $("#localNote").className = "note" + (App.storageOk ? " info" : "");

  const pad = n => String(n).padStart(2, "0");
  const todayISO = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

  function renderCart() {
    const L = App.cart.lines(P), total = +App.sum(L, l => l.amount).toFixed(2), units = App.sum(L, l => l.qty);
    $("#lines").innerHTML = L.length ? L.map(l => `<div class="line" data-code="${esc(l.product.stockcode)}">
        <a href="product.html?id=${encodeURIComponent(l.product.stockcode)}">${App.productImg(l.product)}</a>
        <div><a class="nm" href="product.html?id=${encodeURIComponent(l.product.stockcode)}">${esc(App.titleCase(l.product.name))}</a><span class="meta"><span class="num">${esc(money(l.product.price))}</span></span>
          <div class="qty" style="margin-top:6px"><button type="button" data-d="-1" aria-label="-">−</button><input type="number" min="1" max="9999" value="${l.qty}" aria-label="${esc(t("co_qty"))}" data-q><button type="button" data-d="1" aria-label="+">+</button></div>
          <button class="rm" type="button" data-rm>${esc(t("btn_remove"))}</button></div>
        <div class="amt num">${esc(money(l.amount))}</div></div>`).join("") : `<p class="empty">${esc(t("cart_empty"))}</p><div style="text-align:center"><a class="btn" href="index.html">${esc(t("pd_back"))}</a></div>`;
    $("#sumBox").innerHTML = `<div class="sum"><span>${esc(t("co_items"))}</span><span class="num">${units}</span></div><div class="sum"><span>${esc(t("co_subtotal"))}</span><span class="num">${esc(money(total))}</span></div><div class="sum t"><span>${esc(t("co_total"))}</span><span class="num">${esc(money(total))}</span></div><p class="meta">${esc(t("co_notax"))}</p>`;
    $("#submit").disabled = !L.length;
  }
  $("#lines").addEventListener("click", e => {
    const row = e.target.closest(".line"); if (!row) return; const code = row.dataset.code, cur = App.cart.get()[code] || 1;
    if (e.target.closest("[data-rm]")) App.cart.remove(code);
    const d = e.target.closest("[data-d]"); if (d) App.cart.setQty(code, cur + +d.dataset.d);
  });
  $("#lines").addEventListener("change", e => { const i = e.target.closest("[data-q]"); if (!i) return; App.cart.setQty(i.closest(".line").dataset.code, parseInt(i.value, 10) || 1); });
  document.addEventListener("cart:change", renderCart);

  $("#form").addEventListener("submit", e => {
    e.preventDefault();
    const err = m => { $("#err").textContent = m || ""; return false; };
    const name = App.clean($("#cname").value, 60), email = App.clean($("#cmail").value, 80), phone = App.clean($("#cphone").value, 25), country = $("#ccountry").value;
    const L = App.cart.lines(P);
    if (!L.length) return err(t("err_empty"));
    if (name.length < 2) { $("#cname").focus(); return err(t("err_name")); }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("#cmail").focus(); return err(t("err_email")); }
    if (phone && !/^[0-9+()\-\s]{5,25}$/.test(phone)) { $("#cphone").focus(); return err(t("err_phone")); }
    if (!countries.includes(country)) return err(t("err_country"));
    err();
    const now = new Date(), code = App.newCode();
    const order = { code, customer: name, customerid: null, country, date: todayISO(now), hour: now.getHours(), createdAt: now.toISOString(), status: "registered",
      contact: { city: App.clean($("#ccity").value, 60), phone, email, address: App.clean($("#caddr").value, 200), note: App.clean($("#cnote").value, 120) },
      items: L.map(l => ({ description: l.product.name, stockcode: l.product.stockcode, unitprice: l.product.price, quantity: l.qty })) };
    if (!App.saveOrder(order)) return err(t("err_storage"));
    App.cart.clear(); showReceipt(order);
  });

  function showReceipt(o) {
    const total = +App.sum(o.items, i => i.quantity * i.unitprice).toFixed(2), base = location.href.replace(/[#?].*$/, "").replace(/cart\.html$/, "");
    const link = base + "track.html#o=" + App.encodeOrder(o);
    $("#cartView").hidden = true; $("#localNote").hidden = false;
    const r = $("#receiptView"); r.hidden = false;
    r.innerHTML = `<div class="receipt" id="rc"><div class="meta">${esc(t("rc_placed"))}</div><div class="code" id="rcCode">${esc(o.code)}</div><div class="meta">${esc(t("rc_keep"))}</div>
      <table><tbody><tr><td>${esc(t("tr_date"))}</td><td class="n"><span class="num">${esc(o.date)} ${pad(o.hour)}:00</span></td></tr><tr><td>${esc(t("co_name"))}</td><td class="n">${esc(o.customer)}</td></tr><tr><td>${esc(t("co_country"))}</td><td class="n"><span class="num">${esc(o.country)}</span></td></tr>${o.contact.city ? `<tr><td>${esc(t("co_city"))}</td><td class="n">${esc(o.contact.city)}</td></tr>` : ""}${o.contact.address ? `<tr><td>${esc(t("co_address"))}</td><td class="n">${esc(o.contact.address)}</td></tr>` : ""}</tbody></table>
      <table><thead><tr><th>${esc(t("tr_product"))}</th><th class="n">${esc(t("co_qty"))}</th><th class="n">${esc(t("tr_unit"))}</th><th class="n">${esc(t("tr_amount"))}</th></tr></thead><tbody>${o.items.map(i => `<tr><td style="direction:ltr;text-align:start">${esc(App.titleCase(i.description))}</td><td class="n"><span class="num">${i.quantity}</span></td><td class="n"><span class="num">${esc(money(i.unitprice))}</span></td><td class="n"><span class="num">${esc(money(i.quantity * i.unitprice))}</span></td></tr>`).join("")}</tbody></table>
      <div class="tot"><span>${esc(t("co_total"))}</span><span class="num">${esc(money(total))}</span></div>
      <p class="meta" style="margin-top:10px">${esc(t("rc_local"))}</p>
      <div class="acts noprint"><button class="btn sm" id="cpC" type="button">${esc(t("btn_copy_code"))}</button><button class="btn ghost sm" id="cpL" type="button">${esc(t("btn_copy_link"))}</button><button class="btn ghost sm" id="pr" type="button">${esc(t("btn_print"))}</button><a class="btn ghost sm" href="track.html?code=${encodeURIComponent(o.code)}">${esc(t("nav_track"))}</a><a class="btn ghost sm" href="index.html">${esc(t("pd_back"))}</a></div></div>`;
    const cp = (txt, msg) => { (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => App.toast(msg), () => App.toast(txt)); };
    $("#cpC").onclick = () => cp(o.code, t("toast_copied")); $("#cpL").onclick = () => cp(link, t("toast_copied")); $("#pr").onclick = () => window.print();
    scrollTo({ top: 0 });
  }
  App.applyI18n(); renderCart(); App.mountFooter();
})();
