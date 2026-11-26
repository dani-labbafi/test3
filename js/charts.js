/* charts.js — small dependency-free SVG charts (line, bar/horizontal bar with optional cumulative line, donut).
   Interactive tooltips on hover/touch; redraws on resize. Works offline and on GitHub Pages without any CDN. */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PALETTE = ["#3b82f6", "#22d3ee", "#7dd3fc", "#1d4ed8", "#2dd4bf", "#60a5fa", "#0ea5e9", "#818cf8", "#67e8f9", "#93c5fd"];
  const GRID = "rgba(141,166,212,.18)", TXT = "#8da6d4";
  const reg = new Set();
  let tip;

  function showTip(e, html) {
    if (!tip) { tip = document.createElement("div"); tip.className = "ctip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = "block";
    const w = tip.offsetWidth, h = tip.offsetHeight, x = Math.min(innerWidth - w - 8, Math.max(8, e.clientX + 14)), y = Math.max(8, e.clientY - h - 12);
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  const hideTip = () => { if (tip) tip.style.display = "none"; };
  const pt = e => (e.touches && e.touches[0]) ? e.touches[0] : e;

  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  const short = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const compact = v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : (+v.toFixed(2)).toString();

  function box(el, h) {
    const w = Math.max(260, el.clientWidth || 300);
    return { w, h: h || +el.dataset.h || 280 };
  }
  function legend(series) {
    return series.length > 1 ? `<ul class="legend">${series.map((s, i) => `<li><i style="background:${s.color || PALETTE[i % PALETTE.length]}"></i>${esc(s.name)}</li>`).join("")}</ul>` : "";
  }
  function empty(el, msg) { el.innerHTML = `<p class="empty">${esc(msg || "—")}</p>`; }

  /* ---------- line ---------- */
  function line(el, c) {
    const { w, h } = box(el), L = c.labels, S = c.series.map((s, i) => ({ ...s, color: s.color || PALETTE[i % PALETTE.length] }));
    if (!L.length) return empty(el, c.empty);
    const m = { l: 50, r: 26, t: 14, b: 34 }, iw = w - m.l - m.r, ih = h - m.t - m.b, fmt = c.fmt || compact;
    const max = niceMax(Math.max(...S.flatMap(s => s.data), 0)), X = i => m.l + (L.length === 1 ? iw / 2 : iw * i / (L.length - 1)), Y = v => m.t + ih - ih * v / max;
    let g = "";
    for (let k = 0; k <= 4; k++) { const v = max * k / 4, y = Y(v); g += `<line x1="${m.l}" x2="${w - m.r}" y1="${y}" y2="${y}" stroke="${GRID}"/><text x="${m.l - 8}" y="${y + 4}" text-anchor="end" fill="${TXT}" font-size="11">${compact(v)}</text>`; }
    const step = Math.ceil(L.length / Math.max(1, Math.floor(iw / 70)));
    L.forEach((l, i) => { if (i % step === 0) g += `<text x="${X(i)}" y="${h - 10}" text-anchor="${i === L.length - 1 && L.length > 1 ? "end" : "middle"}" fill="${TXT}" font-size="11">${esc(short(l, 10))}</text>`; });
    S.forEach((s, si) => {
      const pts = s.data.map((v, i) => [X(i), Y(v)]), d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      if (si === 0 && c.area !== false && pts.length > 1) g += `<defs><linearGradient id="ar${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".35"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${pts[pts.length - 1][0]} ${Y(0)} L${pts[0][0]} ${Y(0)} Z" fill="url(#ar${si})"/>`;
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      pts.forEach((p, i) => { g += `<circle class="dot" data-i="${i}" cx="${p[0]}" cy="${p[1]}" r="4" fill="#0a1a38" stroke="${s.color}" stroke-width="2"><title>${esc(s.name)} — ${esc(L[i])}: ${esc(fmt(s.data[i]))}</title></circle>`; });
    });
    g += `<line id="gd" y1="${m.t}" y2="${m.t + ih}" stroke="${TXT}" stroke-dasharray="3 3" opacity="0"/><rect id="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(c.title || "")}">${g}</svg>${legend(S)}`;
    const svg = el.querySelector("svg"), hit = svg.querySelector("#hit"), gd = svg.querySelector("#gd");
    const move = e => {
      const p = pt(e), r = svg.getBoundingClientRect(), x = (p.clientX - r.left) * (w / r.width);
      const i = L.length === 1 ? 0 : Math.max(0, Math.min(L.length - 1, Math.round((x - m.l) / iw * (L.length - 1))));
      gd.setAttribute("x1", X(i)); gd.setAttribute("x2", X(i)); gd.setAttribute("opacity", 1);
      showTip(p, `<b>${esc(L[i])}</b>` + S.map(s => `<div><i style="background:${s.color}"></i>${esc(s.name)}: <b dir="ltr">${esc(fmt(s.data[i]))}</b></div>`).join(""));
    };
    hit.addEventListener("mousemove", move); hit.addEventListener("touchstart", move, { passive: true }); hit.addEventListener("touchmove", move, { passive: true });
    hit.addEventListener("mouseleave", () => { hideTip(); gd.setAttribute("opacity", 0); });
  }

  /* ---------- bar (vertical / horizontal, optional cumulative % line) ---------- */
  function bar(el, c) {
    const L = c.labels, S = c.series.map((s, i) => ({ ...s, color: s.color || PALETTE[i % PALETTE.length] })), hz = !!c.horizontal, fmt = c.fmt || compact;
    if (!L.length) return empty(el, c.empty);
    const w = Math.max(260, el.clientWidth || 300), rowH = hz ? Math.max(22, 14 + 9 * S.length) : 0, h = hz ? Math.max(120, L.length * rowH + 30) : (+el.dataset.h || 280);
    const labW = hz ? Math.min(150, Math.max(80, w * .34)) : 0, m = hz ? { l: labW, r: 44, t: 8, b: 22 } : { l: 50, r: c.line ? 40 : 14, t: 14, b: 44 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b, max = niceMax(Math.max(...S.flatMap(s => s.data), 0));
    let g = "";
    if (hz) {
      for (let k = 0; k <= 4; k++) { const x = m.l + iw * k / 4; g += `<line x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ih}" stroke="${GRID}"/><text x="${x}" y="${h - 6}" text-anchor="middle" fill="${TXT}" font-size="11">${compact(max * k / 4)}</text>`; }
      const band = ih / L.length, bw = Math.min(18, (band - 6) / S.length);
      L.forEach((l, i) => {
        g += `<text x="${m.l - 8}" y="${m.t + band * i + band / 2 + 4}" text-anchor="end" fill="#cfe0ff" font-size="11.5">${esc(short(l, Math.floor(labW / 6.4)))}</text>`;
        S.forEach((s, si) => { const bwid = iw * s.data[i] / max, y = m.t + band * i + (band - bw * S.length) / 2 + bw * si; g += `<rect class="bar" data-i="${i}" x="${m.l}" y="${y}" width="${Math.max(1, bwid)}" height="${bw - 2}" rx="4" fill="${s.color}"><title>${esc(l)} — ${esc(s.name)}: ${esc(fmt(s.data[i]))}</title></rect>`; });
        g += `<rect class="hit" data-i="${i}" x="0" y="${m.t + band * i}" width="${w}" height="${band}" fill="transparent"/>`;
      });
    } else {
      for (let k = 0; k <= 4; k++) { const v = max * k / 4, y = m.t + ih - ih * k / 4; g += `<line x1="${m.l}" x2="${w - m.r}" y1="${y}" y2="${y}" stroke="${GRID}"/><text x="${m.l - 8}" y="${y + 4}" text-anchor="end" fill="${TXT}" font-size="11">${compact(v)}</text>`; if (c.line) g += `<text x="${w - m.r + 6}" y="${y + 4}" fill="#7dd3fc" font-size="11">${k * 25}%</text>`; }
      const band = iw / L.length, bw = Math.min(36, (band - 6) / S.length), step = Math.ceil(L.length / Math.max(1, Math.floor(iw / 56)));
      L.forEach((l, i) => {
        if (i % step === 0) g += `<text x="${m.l + band * i + band / 2}" y="${h - 22}" text-anchor="middle" fill="${TXT}" font-size="11">${esc(short(l, Math.max(9, Math.floor(band / 6.5))))}</text>`;
        S.forEach((s, si) => { const bh = ih * s.data[i] / max, x = m.l + band * i + (band - bw * S.length) / 2 + bw * si; g += `<rect class="bar" data-i="${i}" x="${x}" y="${m.t + ih - bh}" width="${bw - 2}" height="${Math.max(0, bh)}" rx="4" fill="${s.color}"><title>${esc(l)} — ${esc(s.name)}: ${esc(fmt(s.data[i]))}</title></rect>`; });
        g += `<rect class="hit" data-i="${i}" x="${m.l + band * i}" y="${m.t}" width="${band}" height="${ih}" fill="transparent"/>`;
      });
      if (c.line) {
        const pts = c.line.data.map((v, i) => [m.l + band * i + band / 2, m.t + ih - ih * v / 100]);
        g += `<path d="${pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ")}" fill="none" stroke="#7dd3fc" stroke-width="2.2"/>` + pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#7dd3fc"/>`).join("");
      }
      if (c.xTitle) g += `<text x="${m.l + iw / 2}" y="${h - 4}" text-anchor="middle" fill="${TXT}" font-size="11">${esc(c.xTitle)}</text>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(c.title || "")}">${g}</svg>${legend(c.line ? S.concat([{ name: c.line.name, color: "#7dd3fc" }]) : S)}`;
    el.querySelectorAll(".hit").forEach(r => {
      const i = +r.dataset.i, f = e => showTip(pt(e), `<b>${esc(L[i])}</b>` + S.map(s => `<div><i style="background:${s.color}"></i>${esc(s.name)}: <b dir="ltr">${esc((s.fmt || fmt)(s.data[i], i))}</b></div>`).join("") + (c.line ? `<div><i style="background:#7dd3fc"></i>${esc(c.line.name)}: <b dir="ltr">${c.line.data[i].toFixed(1)}%</b></div>` : "") + (c.extra ? `<div class="ex">${esc(c.extra(i))}</div>` : ""));
      r.addEventListener("mousemove", f); r.addEventListener("touchstart", f, { passive: true }); r.addEventListener("mouseleave", hideTip);
    });
  }

  /* ---------- donut ---------- */
  function donut(el, c) {
    let items = c.items.filter(i => i.value > 0).sort((a, b) => b.value - a.value);
    if (!items.length) return empty(el, c.empty);
    if (items.length > 7) { const rest = items.slice(6); items = items.slice(0, 6).concat([{ label: c.otherLabel || "Other", value: rest.reduce((s, x) => s + x.value, 0) }]); }
    items = items.map((x, i) => ({ ...x, color: PALETTE[i % PALETTE.length] }));
    const fmt = c.fmt || compact, total = items.reduce((s, x) => s + x.value, 0), size = Math.min(220, Math.max(160, el.clientWidth - 20)), R = size / 2 - 6, r = R * .62, cx = size / 2;
    let a0 = -Math.PI / 2, g = "";
    items.forEach((it, i) => {
      const a1 = a0 + (it.value / total) * Math.PI * 2 - (items.length > 1 ? .012 : 0), big = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, a) => [cx + rad * Math.cos(a), cx + rad * Math.sin(a)];
      const [x1, y1] = p(R, a0), [x2, y2] = p(R, a1), [x3, y3] = p(r, a1), [x4, y4] = p(r, a0);
      g += items.length === 1 ? `<circle class="seg" data-i="${i}" cx="${cx}" cy="${cx}" r="${(R + r) / 2}" fill="none" stroke="${it.color}" stroke-width="${R - r}"/>` : `<path class="seg" data-i="${i}" d="M${x1} ${y1} A${R} ${R} 0 ${big} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${big} 0 ${x4} ${y4} Z" fill="${it.color}"><title>${esc(it.label)}: ${esc(fmt(it.value))} (${(it.value / total * 100).toFixed(1)}%)</title></path>`;
      a0 += (it.value / total) * Math.PI * 2;
    });
    g += `<text x="${cx}" y="${cx - 2}" text-anchor="middle" fill="#fff" font-size="${size < 190 ? 15 : 18}" font-weight="700" direction="ltr">${esc(fmt(total))}</text><text x="${cx}" y="${cx + 16}" text-anchor="middle" fill="${TXT}" font-size="11">${esc(c.centerLabel || "")}</text>`;
    el.innerHTML = `<div class="donut"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(c.title || "")}">${g}</svg><ul class="legend v">${items.map(i => `<li><i style="background:${i.color}"></i><span>${esc(i.label)}</span><b dir="ltr">${(i.value / total * 100).toFixed(1)}%</b></li>`).join("")}</ul></div>`;
    el.querySelectorAll(".seg").forEach(s => {
      const it = items[+s.dataset.i], f = e => showTip(pt(e), `<b>${esc(it.label)}</b><div><b dir="ltr">${esc(fmt(it.value))}</b> · ${(it.value / total * 100).toFixed(1)}%</div>`);
      s.addEventListener("mousemove", f); s.addEventListener("touchstart", f, { passive: true }); s.addEventListener("mouseleave", hideTip);
    });
  }

  const TYPES = { line, bar, donut };
  function draw(el, type, cfg) { el._chart = { type, cfg }; reg.add(el); try { TYPES[type](el, cfg); } catch (err) { console.error("chart error", err); el.innerHTML = '<p class="empty">Chart error</p>'; } }
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => reg.forEach(el => { if (!el.isConnected) { reg.delete(el); return; } if (el._w !== el.clientWidth) { el._w = el.clientWidth; TYPES[el._chart.type](el, el._chart.cfg); } }), 180); });
  document.addEventListener("scroll", hideTip, { passive: true });
  window.Charts = { line: (el, c) => draw(el, "line", c), bar: (el, c) => draw(el, "bar", c), donut: (el, c) => draw(el, "donut", c), PALETTE };
})();
