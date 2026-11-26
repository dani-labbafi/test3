/* ui.js — shared page chrome and small UI helpers */
(function () {
  "use strict";
  const { t, esc, money, num, N } = App;

  App.mountHeader = function (active, opts) {
    opts = opts || {};
    const link = (id, href, key) => `<a href="${href}" class="${active === id ? "on" : ""}" ${active === id ? 'aria-current="page"' : ""} data-i18n="${key}"></a>`;
    const el = document.createElement("header");
    el.className = "nav";
    el.innerHTML = `<a class="logo" href="index.html" aria-label="BlueStore"><svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs><path d="M16 2 28 9v14L16 30 4 23V9z" fill="url(#lm)"/><path d="M16 2v14m0 0 12-7M16 16 4 9M16 16v14" stroke="#fff" stroke-opacity=".45" fill="none"/></svg><span>Blue<b>Store</b></span>${opts.admin ? `<span class="chip-admin" data-i18n="nav_admin_tag"></span>` : ""}</a>
      <nav class="links" aria-label="Main">${link("shop", "index.html", "nav_shop")}${link("track", "track.html", "nav_track")}${link("admin", "admin.html", "nav_admin")}</nav>
      <div class="tools"><button class="lang" id="langBtn" type="button" aria-label="Language">${App.lang === "fa" ? "EN" : "فا"}</button>
      <a class="cartbtn" href="cart.html" data-i18n-aria="nav_cart" aria-label="Cart"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L20.5 8H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/></svg><span class="badge num" id="cartBadge" hidden>0</span></a></div>`;
    document.body.prepend(el);
    document.getElementById("langBtn").addEventListener("click", () => App.setLang(App.lang === "fa" ? "en" : "fa"));
    const upd = () => { const c = App.cart.count(), b = document.getElementById("cartBadge"); b.textContent = c > 99 ? "99+" : c; b.hidden = !c; };
    document.addEventListener("cart:change", upd); upd();
    App.applyI18n(el);
  };

  App.mountFooter = function () {
    const f = document.createElement("footer");
    f.className = "foot";
    f.innerHTML = `<div class="wrap"><p data-i18n="foot_data"></p><p class="meta" data-i18n="foot_images"></p></div>`;
    document.body.appendChild(f); App.applyI18n(f);
  };

  App.toast = function (msg) {
    let h = document.getElementById("toasts");
    if (!h) { h = document.createElement("div"); h.id = "toasts"; h.setAttribute("role", "status"); h.setAttribute("aria-live", "polite"); document.body.appendChild(h); }
    const d = document.createElement("div"); d.className = "toast"; d.textContent = msg; h.appendChild(d);
    setTimeout(() => { d.classList.add("out"); setTimeout(() => d.remove(), 300); }, 2200);
  };

  App.productImg = (p, cls) => `<img class="${cls || ""}" src="${esc(App.imgUrl(p.stockcode))}" alt="${esc(App.titleCase(p.name))}" loading="lazy" decoding="async" width="300" height="300" onerror="this.onerror=null;this.classList.add('noimg');this.removeAttribute('src')">`;

  App.productCard = p => `<article class="pcard">
    <a class="pimg tilt" href="product.html?id=${encodeURIComponent(p.stockcode)}" aria-label="${esc(App.titleCase(p.name))}">${App.productImg(p)}</a>
    <div class="pbody"><a class="pname" href="product.html?id=${encodeURIComponent(p.stockcode)}">${esc(App.titleCase(p.name))}</a>
      <div class="price">${N(money(p.price))}</div>
      <div class="meta"><span>${t("c_units_sold")}: <b>${N(num(p.qty))}</b></span><span>${t("c_in_orders")}: <b>${N(p.orderCount)}</b></span></div>
      <button class="btn sm" type="button" data-add="${esc(p.stockcode)}">${t("btn_add_cart")}</button></div></article>`;

  // 3D tilt on any .tilt element (mouse only, skipped when the user prefers reduced motion)
  App.enableTilt = function (root) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.addEventListener("mousemove", e => {
      const c = e.target.closest(".tilt"); if (!c) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = `perspective(700px) rotateX(${(-y * 14).toFixed(1)}deg) rotateY(${(x * 18).toFixed(1)}deg) translateZ(0)`;
    });
    root.addEventListener("mouseout", e => { const c = e.target.closest(".tilt"); if (c && !c.contains(e.relatedTarget)) c.style.transform = ""; });
  };

  // one delegated "add to cart" handler per page
  App.bindAddButtons = function (root) {
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-add]"); if (!b) return;
      App.cart.add(b.dataset.add, 1);
      b.classList.add("done"); setTimeout(() => b.classList.remove("done"), 700);
      App.toast(t("toast_added"));
    });
  };

  App.emptyBox = (text) => `<p class="empty">${esc(text)}</p>`;
})();
