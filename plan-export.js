/* My Trip — day plan pages (one portrait page per day, paper and crayon look, real map)
 * window.PlanExport.renderDay(day, opts) -> Promise<HTMLCanvasElement>
 *   day: {tripName, dayNo, dayCount, dateLabel, entries:[{type, time, title, note, tone, icon, lat, lon, night}]}
 *   opts: {icons: {name: svgInner}, tiles: true}
 */
(function(){
  const W = 1080, H = 1920, M = 72;
  const FONT = '"Mali", "Prompt", sans-serif';
  const C = {
    paper:"#F6F0E4", ink:"#3A322D", muted:"#8C7F73", line:"#D9CBB8",
    sight:"#6FAE5B", food:"#EE8A4C", shop:"#E07A9F", stay:"#EDB23E", flight:"#5A8BE8", move:"#D9785C", night:"#C9A055", route:"#C8714F"
  };
  const TONE = {"k-sight":C.sight, "t-place":C.sight, "k-food":C.food, "k-shop":C.shop, "t-stay":C.stay, "t-flight":C.flight, "t-move":C.move};

  /* small seeded random, so a page looks the same every time it is drawn */
  function rng(seed){ let s = 0; for(const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; s = s || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* ---------- paper ---------- */
  let paperCache = null;
  function paper(){
    if(paperCache) return paperCache;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"); x.fillStyle = C.paper; x.fillRect(0, 0, W, H);
    const img = x.getImageData(0, 0, W, H), d = img.data, r = rng("paper");
    for(let i = 0; i < d.length; i += 4){ const n = (r() - 0.5) * 16; d[i] += n; d[i+1] += n; d[i+2] += n * 0.9; }
    x.putImageData(img, 0, 0);
    x.globalAlpha = 0.05; x.strokeStyle = "#9C8B76"; x.lineWidth = 1;
    for(let i = 0; i < 260; i++){ const px = r() * W, py = r() * H, a = r() * Math.PI, l = 6 + r() * 18;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l / 2 + r() * 4, py + Math.sin(a) * l / 2, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    x.globalAlpha = 1;
    return paperCache = c;
  }

  /* ---------- crayon helpers ---------- */
  function crayonLine(x, pts, color, width, r, passes = 3){
    x.save(); x.strokeStyle = color; x.lineCap = "round"; x.lineJoin = "round";
    for(let p = 0; p < passes; p++){
      x.globalAlpha = p === 0 ? 0.85 : 0.35; x.lineWidth = width * (p === 0 ? 1 : 0.6);
      x.beginPath();
      pts.forEach((q, i) => { const jx = (r() - 0.5) * width * 0.5, jy = (r() - 0.5) * width * 0.5; i ? x.lineTo(q[0] + jx, q[1] + jy) : x.moveTo(q[0] + jx, q[1] + jy); });
      x.stroke();
    }
    x.restore();
  }
  /* white specks over a coloured shape, like wax crayon on rough paper */
  function speckle(x, cx, cy, rad, r, n){
    x.save(); x.fillStyle = "#FFFDF6";
    for(let i = 0; i < n; i++){ const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad;
      x.globalAlpha = 0.25 + r() * 0.45; x.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + r() * 2, 1 + r() * 1.5); }
    x.restore();
  }
  function blob(x, cx, cy, rad, color, r){
    x.save(); x.fillStyle = color; x.beginPath();
    for(let i = 0; i <= 24; i++){ const a = i / 24 * Math.PI * 2, rr = rad * (1 + (r() - 0.5) * 0.08);
      i ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.closePath(); x.fill(); x.restore();
    speckle(x, cx, cy, rad * 0.95, r, Math.round(rad * 2.2));
  }
  /* diagonal hatch scribble, like the green grass strokes in a crayon drawing */
  function scribble(x, cx, cy, w, h, color, r){
    // short slanted strokes packed into a soft mound, like crayon grass
    for(let i = 0; i < 26; i++){
      const t = i / 25, bx = cx + t * w, mound = Math.sin(t * Math.PI) * h * (0.75 + r() * 0.35);
      crayonLine(x, [[bx + (r() - 0.5) * 6, cy + h], [bx + h * 0.28 + (r() - 0.5) * 8, cy + h - mound]], color, 6, r, 1);
    }
  }
  function sun(x, cx, cy, rad, r){
    blob(x, cx, cy, rad, "#F6BE3B", r);
    for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2 + 0.2;
      crayonLine(x, [[cx + Math.cos(a) * (rad + 14), cy + Math.sin(a) * (rad + 14)], [cx + Math.cos(a) * (rad + 32), cy + Math.sin(a) * (rad + 32)]], "#F2A93B", 6, r, 2); }
  }

  /* ---------- icons from the app's SVG set ---------- */
  function drawIcon(x, svg, cx, cy, size, color, width = 2){
    if(!svg) return;
    x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 24, size / 24);
    x.strokeStyle = color; x.lineWidth = width; x.lineCap = "round"; x.lineJoin = "round"; x.fillStyle = "none";
    const re = /<(path|circle|rect)\s([^>]*)\/?>/g; let m;
    const at = (s, k) => { const v = s.match(new RegExp('\\b' + k + '="([^"]*)"')); return v ? v[1] : null; };
    while((m = re.exec(svg))){
      const p = new Path2D();
      if(m[1] === "path") p.addPath(new Path2D(at(m[2], "d")));
      else if(m[1] === "circle") p.arc(+at(m[2], "cx"), +at(m[2], "cy"), +at(m[2], "r"), 0, Math.PI * 2);
      else { const rx = +(at(m[2], "rx") || 0), X = +at(m[2], "x"), Y = +at(m[2], "y"), Wd = +at(m[2], "width"), Ht = +at(m[2], "height");
        if(p.roundRect && rx) p.roundRect(X, Y, Wd, Ht, rx); else p.rect(X, Y, Wd, Ht); }
      x.stroke(p);
    }
    x.restore();
  }

  /* ---------- text ---------- */
  const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("th", {granularity:"word"}) : null;
  function words(s){ return seg ? [...seg.segment(s)].map(p => p.segment) : String(s).split(/(?<=\s)/); }
  function wrap(x, s, maxW, maxLines){
    const out = []; let cur = "", cut = false;
    for(const w of words(String(s || ""))){
      const next = cur + w;
      if(x.measureText(next).width <= maxW || !cur){ cur = next; continue; }
      out.push(cur.trimEnd()); cur = w.trimStart();
      if(out.length === maxLines){ cut = true; break; }
    }
    if(!cut && cur) out.push(cur);
    if(cut){ let l = out[maxLines - 1]; while(l && x.measureText(l + "…").width > maxW) l = l.slice(0, -1); out[maxLines - 1] = l + "…"; }
    return out;
  }
  function font(weight, px){ return `${weight} ${Math.round(px)}px ${FONT}`; }

  /* ---------- map ---------- */
  const TILE = 512; // Carto @2x tiles: 512 px each
  const lon2x = (lon, z) => (lon + 180) / 360 * TILE * Math.pow(2, z);
  const lat2y = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * Math.pow(2, z); };
  function loadImg(src){ return new Promise(res => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; setTimeout(() => res(null), 12000); }); }
  async function drawMap(x, box, pts, r, opts){
    const {x:bx, y:by, w:bw, h:bh} = box, pad = 90;
    let z = 16;
    if(pts.length > 1){
      for(z = 16; z > 2; z--){
        const xs = pts.map(p => lon2x(p.lon, z)), ys = pts.map(p => lat2y(p.lat, z));
        if(Math.max(...xs) - Math.min(...xs) <= bw - pad * 2 && Math.max(...ys) - Math.min(...ys) <= bh - pad * 2) break;
      }
    } else z = 15;
    const xs = pts.map(p => lon2x(p.lon, z)), ys = pts.map(p => lat2y(p.lat, z));
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const ox = cx - bw / 2, oy = cy - bh / 2; // world px at the box's top-left
    x.save();
    const clip = new Path2D(); if(clip.roundRect) clip.roundRect(bx, by, bw, bh, 36); else clip.rect(bx, by, bw, bh);
    x.clip(clip);
    x.fillStyle = "#EFE7D8"; x.fillRect(bx, by, bw, bh);
    let tilesOk = 0;
    if(opts.tiles !== false){
      const t0x = Math.floor(ox / TILE), t1x = Math.floor((ox + bw) / TILE), t0y = Math.floor(oy / TILE), t1y = Math.floor((oy + bh) / TILE), n = Math.pow(2, z);
      const jobs = [];
      for(let tx = t0x; tx <= t1x; tx++) for(let ty = t0y; ty <= t1y; ty++){
        if(ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n, sub = "abcd"[(tx + ty) & 3];
        jobs.push(loadImg(`https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${wx}/${ty}@2x.png`).then(img => { if(img){ x.drawImage(img, bx + tx * TILE - ox, by + ty * TILE - oy, TILE, TILE); tilesOk++; } }));
      }
      await Promise.all(jobs);
    }
    // soften the map into the paper: less colour, warm tint, a little grain
    x.globalCompositeOperation = "saturation"; x.fillStyle = "rgba(128,128,128,0.45)"; x.fillRect(bx, by, bw, bh);
    x.globalCompositeOperation = "multiply"; x.fillStyle = "#F4E8D3"; x.fillRect(bx, by, bw, bh);
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 0.35; x.drawImage(paper(), bx, by, bw, bh, bx, by, bw, bh); x.globalAlpha = 1;
    if(!tilesOk){ // no map available: soft grid so the dots still read as a map
      x.strokeStyle = "rgba(160,140,115,0.25)"; x.lineWidth = 2;
      for(let gx = bx; gx < bx + bw; gx += 90){ x.beginPath(); x.moveTo(gx, by); x.lineTo(gx, by + bh); x.stroke(); }
      for(let gy = by; gy < by + bh; gy += 90){ x.beginPath(); x.moveTo(bx, gy); x.lineTo(bx + bw, gy); x.stroke(); }
    }
    // route through the stops in order
    const scr = pts.map(p => [bx + lon2x(p.lon, z) - ox, by + lat2y(p.lat, z) - oy]);
    // pull apart markers that sit on top of each other
    for(let i = 0; i < scr.length; i++) for(let j = 0; j < i; j++){
      const dx = scr[i][0] - scr[j][0], dy = scr[i][1] - scr[j][1];
      if(Math.hypot(dx, dy) < 58){ const a = Math.atan2(dy, dx) || i * 2.4; scr[i] = [scr[j][0] + Math.cos(a) * 60, scr[j][1] + Math.sin(a) * 60]; }
    }
    if(scr.length > 1){
      x.save(); x.setLineDash([2, 18]); x.lineCap = "round";
      crayonLine(x, scr, C.route, 9, r, 1);
      x.restore();
    }
    scr.forEach((q, i) => {
      blob(x, q[0] + 3, q[1] + 5, 31, "rgba(58,50,45,0.18)", r);
      blob(x, q[0], q[1], 30, pts[i].color, r);
      x.fillStyle = "#FFFFFF"; x.font = font(700, 32); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(pts[i].n), q[0], q[1] + 2);
    });
    x.restore();
    // hand-drawn frame
    const fr = [], R = 36;
    const arc = (cx0, cy0, a0) => { for(let k = 0; k <= 6; k++){ const a = a0 + k / 6 * Math.PI / 2; fr.push([cx0 + Math.cos(a) * R, cy0 + Math.sin(a) * R]); } };
    arc(bx + bw - R, by + R, -Math.PI / 2); arc(bx + bw - R, by + bh - R, 0); arc(bx + R, by + bh - R, Math.PI / 2); arc(bx + R, by + R, Math.PI); fr.push(fr[0]);
    crayonLine(x, fr, "rgba(140,120,100,0.5)", 4, r, 2);
    if(tilesOk){ x.fillStyle = "rgba(90,80,70,0.7)"; x.font = font(400, 17); x.textAlign = "right"; x.textBaseline = "alphabetic"; x.fillText("© OpenStreetMap © CARTO", bx + bw - 22, by + bh - 16); }
  }

  /* ---------- page ---------- */
  async function renderDay(day, opts = {}){
    const icons = opts.icons || {};
    if(document.fonts && document.fonts.load){
      try{ await Promise.all([document.fonts.load(font(700, 40) , "วันที่ A"), document.fonts.load(font(600, 40), "ก A"), document.fonts.load(font(400, 40), "ก A")]); } catch(_){}
    }
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"); const r = rng(day.tripName + day.dayNo + day.dateLabel);
    x.drawImage(paper(), 0, 0);

    // corner doodles
    scribble(x, 40, H - 150, 150, 70, "rgba(124,166,92,0.6)", r);
    scribble(x, W - 200, H - 140, 140, 60, "rgba(124,166,92,0.5)", r);
    sun(x, W - 150, 150, 46, r);
    [[W - 250, 88, W - 236, 104], [W - 262, 140, W - 242, 142], [W - 60, 238, W - 74, 222]].forEach(l => crayonLine(x, [[l[0], l[1]], [l[2], l[3]]], "#F2B93B", 5, r, 1));

    // header
    x.textAlign = "left"; x.textBaseline = "alphabetic"; x.fillStyle = C.muted; x.font = font(600, 34);
    x.fillText(day.tripName || "", M, 120);
    if(day.dayCount){ const w0 = x.measureText(day.tripName || "").width; x.beginPath(); x.arc(M + w0 + 22, 108, 4.5, 0, Math.PI * 2); x.fill(); x.fillStyle = C.muted; x.font = font(600, 34); x.fillText(`วันที่ ${day.dayNo} จาก ${day.dayCount}`, M + w0 + 44, 120); }
    x.fillStyle = C.ink; x.font = font(700, 104); x.fillText(`วันที่ ${day.dayNo}`, M - 4, 236);
    x.fillStyle = C.ink; x.font = font(600, 42); x.fillText(day.dateLabel || "", M, 302);
    if(day.summary){ x.fillStyle = C.muted; x.font = font(400, 32); const ln = wrap(x, day.summary, W - M * 2 - 180, 1); x.fillText(ln[0] || "", M, 350); }

    // what goes on the map: stops with a position, numbered in order
    const entries = day.entries || [];
    let n = 0; const pts = [];
    entries.forEach(e => { if(e.lat != null && e.lon != null && !e.night && e.type !== "move"){ e.n = ++n; pts.push({lat:+e.lat, lon:+e.lon, n:e.n, color:TONE[e.tone] || C.sight}); } else e.n = 0; });

    const top = day.summary ? 392 : 352;
    const listBottom = H - 170;
    const layout = (mapH, s) => {
      // returns total list height for a given font scale
      x.font = font(600, 38 * s); let h = 0;
      entries.forEach(e => {
        if(e.type === "move"){ h += 58 * s; return; }
        x.font = font(600, 38 * s); const tl = wrap(x, e.title, W - M * 2 - 230 * s, 2).length;
        x.font = font(400, 30 * s); const nl = e.note ? wrap(x, e.note, W - M * 2 - 230 * s, 2).length : 0;
        h += (tl * 48 + nl * 40) * s + 34 * s;
      });
      return h;
    };
    let mapH = pts.length ? 700 : 0, s = 1;
    const room = () => listBottom - (top + (mapH ? mapH + 56 : 10));
    while(layout(mapH, s) > room()){
      if(mapH > 520) mapH -= 60; else if(s > 0.62) s -= 0.04; else if(mapH > 380) mapH -= 40; else break;
    }

    if(pts.length) await drawMap(x, {x:M, y:top, w:W - M * 2, h:mapH}, pts, r, opts);

    // timeline
    let y = top + (mapH ? mapH + 70 : 30);
    const tx = M, mx = M + 175 * s, txt = M + 230 * s, tw = W - M - txt;
    // soft dotted line down the markers column, drawn first so markers sit on it
    { let yy = y, first = null, last = null;
      entries.forEach(e => { if(e.type === "move"){ yy += 58 * s; return; }
        x.font = font(600, 38 * s); const a = wrap(x, e.title, tw, 2).length; x.font = font(400, 30 * s); const b2 = e.note ? wrap(x, e.note, tw, 2).length : 0;
        const cy = yy + 22 * s; if(first === null) first = cy; last = cy; yy += (a * 48 + b2 * 40) * s + 34 * s; });
      if(first !== null && last > first){ x.save(); x.setLineDash([1, 14]); crayonLine(x, [[mx, first], [mx, last]], "rgba(150,130,110,0.6)", 5, r, 1); x.restore(); } }
    entries.forEach(e => {
      if(e.type === "move"){
        x.fillStyle = C.muted; x.font = font(400, 29 * s); x.textAlign = "left"; x.textBaseline = "middle";
        drawIcon(x, icons[e.icon], mx, y + 14 * s, 30 * s, C.move, 2.2);
        const ln = wrap(x, e.title + (e.note ? " · " + e.note : ""), tw, 1)[0] || "";
        x.fillText(ln, txt, y + 16 * s);
        if(e.time){ x.font = font(400, 28 * s); x.fillText(e.time, tx, y + 16 * s); }
        y += 58 * s; return;
      }
      const color = TONE[e.tone] || C.sight;
      x.font = font(600, 38 * s); const tl = wrap(x, e.title, tw, 2);
      x.font = font(400, 30 * s); const nl = e.note ? wrap(x, e.note, tw, 2) : [];
      const h = (tl.length * 48 + nl.length * 40) * s;
      const cy = y + 22 * s;
      // marker: number if it is on the map, else the item's icon
      blob(x, mx, cy, 27 * s, e.night ? "#EFD9A6" : color, r);
      if(e.n){ x.fillStyle = "#FFFFFF"; x.font = font(700, 30 * s); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(e.n), mx, cy + 2 * s); }
      else drawIcon(x, icons[e.icon], mx, cy, 30 * s, e.night ? "#8A6A2E" : "#FFFFFF", 2.4);
      x.textAlign = "left"; x.textBaseline = "alphabetic";
      if(!e.night){ x.fillStyle = C.ink; x.font = font(600, 36 * s); x.fillText(e.time || "", tx, y + 36 * s); }
      x.fillStyle = C.ink; x.font = font(600, 38 * s);
      tl.forEach((l, i) => x.fillText(l, txt, y + 36 * s + i * 48 * s));
      x.fillStyle = C.muted; x.font = font(400, 30 * s);
      nl.forEach((l, i) => x.fillText(l, txt, y + 36 * s + tl.length * 48 * s + i * 40 * s - 4 * s));
      y += h + 34 * s;
    });
    if(!entries.length){ x.fillStyle = C.muted; x.font = font(400, 36); x.textAlign = "center"; x.fillText("วันนี้ยังว่าง พักผ่อนให้เต็มที่", W / 2, top + 120); y = top + 180; }
    // a quiet day (often a travel day) leaves room: fill it with a small crayon landscape, like the app's icon
    if(!pts.length && listBottom - y > 520){
      const cy = Math.min(listBottom - 120, y + (listBottom - y) / 2 + 160), cx = W / 2;
      const ridge = [[cx - 330, cy], [cx - 120, cy - 230], [cx + 10, cy - 100], [cx + 140, cy - 260], [cx + 340, cy]];
      x.save(); x.fillStyle = "rgba(124,166,92,0.22)"; x.beginPath(); ridge.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.fill(); x.restore();
      crayonLine(x, ridge, "#7A5A3E", 14, r, 3);
      drawIcon(x, icons.flight, cx + 120, cy - 400, 120, C.flight, 2.2);
      [[-260, 1], [-60, 0.7], [180, 0.9]].forEach(([dx, k]) => scribble(x, cx + dx, cy - 6 - 40 * k, 90 * k, 40 * k, "rgba(124,166,92,0.55)", r));
    }

    // footer
    x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillStyle = C.muted; x.font = font(400, 30);
    x.fillText(opts.footer || "Good days, good trips", W / 2, H - 70);
    return c;
  }

  window.PlanExport = { renderDay, W, H };
})();
