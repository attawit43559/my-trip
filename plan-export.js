/* My Trip — day plan pages: one portrait page per day, drawn like the app (same fonts, colours, cards), with a real map
 * window.PlanExport.renderDay(day, opts) -> Promise<HTMLCanvasElement>
 *   day: {tripName, tone, dayNo, dayCount, dateLabel, entries:[{type, time, title, note, tone, icon, lat, lon, night}]}
 *   opts: {icons: {name: svgInner}, tiles: true}
 */
(function(){
  const W = 1080, H = 1920, M = 60;
  const DISPLAY = '"Mitr", "Prompt", sans-serif', BODY = '"Prompt", sans-serif';
  const C = {bg:"#FFFDF9", surface:"#FFFFFF", tile:"#F6F1EA", ink:"#2B211C", muted:"#6E6259", line:"#EFE9E0", accent:"#FFB020"};
  /* the app's category colours: deep / soft / mid */
  const TONES = {
    "t-flight":["#1958BD","#E3EEFF","#2F80FF"], "t-stay":["#8A5300","#FFF1CC","#FFB020"], "t-place":["#2B7A1C","#E2F6D6","#3FB02A"],
    "t-move":["#C23B1C","#FFE5DB","#FF6A3D"], "k-sight":["#14806F","#D9F6EF","#1FB89E"], "k-food":["#C2510F","#FFE8D4","#FF8A3D"], "k-shop":["#B4246A","#FFE2EF","#F0559A"]
  };
  const tone = k => TONES[k] || TONES["t-place"];
  const font = (w, px, fam = BODY) => `${w} ${Math.round(px)}px ${fam}`;

  function rng(seed){ let s = 0; for(const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; s = s || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* warm page with a whisper of paper grain */
  let paperCache = null;
  function paper(){
    if(paperCache) return paperCache;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"); x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
    const img = x.getImageData(0, 0, W, H), d = img.data, r = rng("paper");
    for(let i = 0; i < d.length; i += 4){ const n = (r() - 0.5) * 7; d[i] += n; d[i+1] += n; d[i+2] += n; }
    x.putImageData(img, 0, 0);
    return paperCache = c;
  }
  function rrect(x, X, Y, w, h, rad){ x.beginPath(); x.moveTo(X + rad, Y); x.arcTo(X + w, Y, X + w, Y + h, rad); x.arcTo(X + w, Y + h, X, Y + h, rad); x.arcTo(X, Y + h, X, Y, rad); x.arcTo(X, Y, X + w, Y, rad); x.closePath(); }
  function card(x, X, Y, w, h, rad, fill, shadow){
    x.save();
    if(shadow){ x.shadowColor = "rgba(43,33,28,0.10)"; x.shadowBlur = 18; x.shadowOffsetY = 4; }
    rrect(x, X, Y, w, h, rad); x.fillStyle = fill; x.fill(); x.restore();
  }

  /* icons from the app's SVG set */
  function drawIcon(x, svg, cx, cy, size, color, width = 2){
    if(!svg) return;
    x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 24, size / 24);
    x.strokeStyle = color; x.lineWidth = width; x.lineCap = "round"; x.lineJoin = "round";
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

  /* text wrapping that understands Thai word breaks */
  const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("th", {granularity:"word"}) : null;
  const words = s => seg ? [...seg.segment(s)].map(p => p.segment) : String(s).split(/(?=\s)/);
  function wrap(x, s, maxW, maxLines){
    const out = []; let cur = "", cut = false;
    for(const w of words(String(s || ""))){
      const next = cur + w;
      if(x.measureText(next).width <= maxW || !cur){ cur = next; continue; }
      out.push(cur.trimEnd()); cur = w.trimStart();
      if(out.length === maxLines){ cut = true; break; }
    }
    if(!cut && cur) out.push(cur);
    if(cut || (out.length && x.measureText(out[out.length - 1]).width > maxW)){ let l = out[out.length - 1]; while(l && x.measureText(l + "…").width > maxW) l = l.slice(0, -1); out[out.length - 1] = l + "…"; }
    return out;
  }

  /* ---------- map ---------- */
  const TILE = 512; // Carto @2x tiles
  const lon2x = (lon, z) => (lon + 180) / 360 * TILE * Math.pow(2, z);
  const lat2y = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * Math.pow(2, z); };
  function loadImg(src){ return new Promise(res => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; setTimeout(() => res(null), 12000); }); }
  async function drawMap(x, box, pts, opts){
    const {x:bx, y:by, w:bw, h:bh} = box, pad = 80;
    let z = 15;
    if(pts.length > 1) for(z = 16; z > 2; z--){
      const xs = pts.map(p => lon2x(p.lon, z)), ys = pts.map(p => lat2y(p.lat, z));
      if(Math.max(...xs) - Math.min(...xs) <= bw - pad * 2 && Math.max(...ys) - Math.min(...ys) <= bh - pad * 2) break;
    }
    const xs = pts.map(p => lon2x(p.lon, z)), ys = pts.map(p => lat2y(p.lat, z));
    const ox = (Math.max(...xs) + Math.min(...xs)) / 2 - bw / 2, oy = (Math.max(...ys) + Math.min(...ys)) / 2 - bh / 2;
    x.save(); rrect(x, bx, by, bw, bh, 44); x.clip();
    x.fillStyle = "#F2EEE6"; x.fillRect(bx, by, bw, bh);
    let tilesOk = 0;
    if(opts.tiles !== false){
      const n = Math.pow(2, z), jobs = [];
      for(let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + bw) / TILE); tx++) for(let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + bh) / TILE); ty++){
        if(ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        jobs.push(loadImg(`https://${"abcd"[(tx + ty) & 3]}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${wx}/${ty}@2x.png`).then(img => { if(img){ x.drawImage(img, bx + tx * TILE - ox, by + ty * TILE - oy, TILE, TILE); tilesOk++; } }));
      }
      await Promise.all(jobs);
    }
    // a touch warmer and calmer than a normal map, so the stops stand out
    x.globalCompositeOperation = "saturation"; x.fillStyle = "rgba(128,128,128,0.3)"; x.fillRect(bx, by, bw, bh);
    x.globalCompositeOperation = "multiply"; x.fillStyle = "#FFF7EA"; x.fillRect(bx, by, bw, bh);
    x.globalCompositeOperation = "source-over";
    if(!tilesOk){
      x.strokeStyle = "rgba(160,140,115,0.18)"; x.lineWidth = 2;
      for(let gx = bx; gx < bx + bw; gx += 80){ x.beginPath(); x.moveTo(gx, by); x.lineTo(gx, by + bh); x.stroke(); }
      for(let gy = by; gy < by + bh; gy += 80){ x.beginPath(); x.moveTo(bx, gy); x.lineTo(bx + bw, gy); x.stroke(); }
    }
    const scr = pts.map(p => [bx + lon2x(p.lon, z) - ox, by + lat2y(p.lat, z) - oy]);
    for(let i = 0; i < scr.length; i++) for(let j = 0; j < i; j++){
      const dx = scr[i][0] - scr[j][0], dy = scr[i][1] - scr[j][1];
      if(Math.hypot(dx, dy) < 60){ const a = Math.atan2(dy, dx) || i * 2.4; scr[i] = [scr[j][0] + Math.cos(a) * 62, scr[j][1] + Math.sin(a) * 62]; }
    }
    if(scr.length > 1){
      x.save(); x.strokeStyle = "rgba(43,33,28,0.55)"; x.lineWidth = 6; x.lineCap = "round"; x.lineJoin = "round"; x.setLineDash([2, 16]);
      x.beginPath(); scr.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.stroke(); x.restore();
    }
    scr.forEach((q, i) => {
      x.save(); x.shadowColor = "rgba(43,33,28,0.25)"; x.shadowBlur = 10; x.shadowOffsetY = 3;
      x.beginPath(); x.arc(q[0], q[1], 31, 0, Math.PI * 2); x.fillStyle = "#FFFFFF"; x.fill(); x.restore();
      x.beginPath(); x.arc(q[0], q[1], 25, 0, Math.PI * 2); x.fillStyle = tone(pts[i].tone)[2]; x.fill();
      x.fillStyle = "#FFFFFF"; x.font = font(600, 28, DISPLAY); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(pts[i].n), q[0], q[1] + 1);
    });
    x.restore();
    x.save(); rrect(x, bx, by, bw, bh, 44); x.strokeStyle = C.line; x.lineWidth = 3; x.stroke(); x.restore();
    if(tilesOk){ x.fillStyle = "rgba(90,80,70,0.75)"; x.font = font(400, 17); x.textAlign = "right"; x.textBaseline = "alphabetic"; x.fillText("© OpenStreetMap © CARTO", bx + bw - 26, by + bh - 18); }
  }

  /* the trip card at the top, like the one in the app: soft colour, mountains and sun */
  function header(x, day, X, Y, w, h){
    const [deep, soft, mid] = tone("t-" + (day.tone || "flight"));
    card(x, X, Y, w, h, 56, soft);
    x.save(); rrect(x, X, Y, w, h, 56); x.clip();
    const k = 2.15, ax = X + w - 40 - 180 * k * 0.93, ay = Y + h - 110 * k;
    x.translate(ax, ay); x.scale(k, k);
    x.fillStyle = C.accent; x.beginPath(); x.arc(138, 32, 16, 0, Math.PI * 2); x.fill();
    x.fillStyle = mid; x.fill(new Path2D("M14 110 L80 46 L146 110 Z"));
    x.fillStyle = "#FFFFFF"; x.fill(new Path2D("M66 60 L80 46 L94 60 L87 57 L80 63 L73 57 Z"));
    x.fillStyle = deep; x.fill(new Path2D("M98 110 L146 66 L194 110 Z"));
    x.restore();
    x.textAlign = "left"; x.textBaseline = "alphabetic";
    const tw = w - 88 - 300;
    x.fillStyle = C.muted; x.font = font(500, 32);
    const top = (day.tripName || "") + (day.dayCount ? `  ·  ${day.dayNo}/${day.dayCount}` : "");
    x.fillText(wrap(x, top, tw + 160, 1)[0] || "", X + 48, Y + 78);
    x.fillStyle = C.ink; x.font = font(600, 88, DISPLAY); x.fillText(`วันที่ ${day.dayNo}`, X + 44, Y + 212);
    x.fillStyle = C.ink; x.font = font(400, 36); x.fillText(day.dateLabel || "", X + 48, Y + 276);
  }

  async function renderDay(day, opts = {}){
    const icons = opts.icons || {};
    if(document.fonts && document.fonts.load){
      try{ await Promise.all([document.fonts.load(font(600, 40, DISPLAY), "วันที่ 1"), document.fonts.load(font(500, 40), "ก A"), document.fonts.load(font(400, 40), "ก A")]); } catch(_){}
    }
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.drawImage(paper(), 0, 0);

    const HH = 320; header(x, day, M, M, W - M * 2, HH);

    const entries = day.entries || [];
    let n = 0; const pts = [];
    entries.forEach(e => { if(e.lat != null && e.lon != null && !e.night && e.type !== "move"){ e.n = ++n; pts.push({lat:+e.lat, lon:+e.lon, n:e.n, tone:e.tone}); } else e.n = 0; });

    // list sizes for a given scale (s): big rows for stops, slim rows for travel legs
    const P = 40, inner = W - M * 2 - P * 2;
    const rowsOf = s => {
      const timeW = 118 * s, thumb = 72 * s, gap = 26 * s, textX = timeW + thumb + gap * 1.6, textW = inner - textX;
      return entries.map(e => {
        if(e.type === "move"){ x.font = font(400, 29 * s); return {e, h:62 * s, line:wrap(x, e.title + (e.note ? "  ·  " + e.note : ""), textW, 1)[0] || "", textX, timeW, thumb}; }
        x.font = font(500, 36 * s); const tl = wrap(x, e.title, textW, 2);
        x.font = font(400, 29 * s); const nl = e.note ? wrap(x, e.note, textW, 2) : [];
        return {e, h:Math.max(thumb, tl.length * 50 * s + nl.length * 42 * s) + 40 * s, tl, nl, textX, timeW, thumb};
      });
    };
    const top = M + HH + 28, foot = H - 110;
    let mapH = pts.length ? 700 : 0, s = 1, rows = rowsOf(s);
    const listH = () => rows.reduce((a, r) => a + r.h, 0) + P * 1.4;
    while(top + (mapH ? mapH + 28 : 0) + listH() > foot){
      if(mapH > 520) mapH -= 60; else if(s > 0.66){ s -= 0.04; rows = rowsOf(s); } else if(mapH > 380) mapH -= 40; else break;
    }
    if(pts.length) await drawMap(x, {x:M, y:top, w:W - M * 2, h:mapH}, pts, opts);

    // the day's list on a white card, rows like the app's plan
    const ly = top + (mapH ? mapH + 28 : 0);
    if(entries.length){
      const h = Math.min(foot - ly, listH());
      card(x, M, ly, W - M * 2, h, 48, C.surface, true);
      let y = ly + P * 0.7;
      const L = M + P;
      rows.forEach((r, i) => {
        const e = r.e;
        if(e.type === "move"){
          const cy = y + r.h / 2;
          x.fillStyle = C.muted; x.font = font(400, 27 * s, DISPLAY); x.textAlign = "left"; x.textBaseline = "middle";
          if(e.time) x.fillText(e.time, L, cy);
          const tc = L + r.timeW + r.thumb / 2;
          x.beginPath(); x.arc(tc, cy, 22 * s, 0, Math.PI * 2); x.fillStyle = TONES["t-move"][1]; x.fill();
          drawIcon(x, icons[e.icon], tc, cy, 28 * s, TONES["t-move"][0], 2.2);
          x.fillStyle = C.muted; x.font = font(400, 29 * s); x.fillText(r.line, L + r.textX, cy + 1);
        } else {
          const [deep, soft, mid] = tone(e.tone);
          const ty = y + 20 * s, tc = L + r.timeW + r.thumb / 2;
          x.textAlign = "left"; x.textBaseline = "alphabetic";
          if(e.night){
            x.beginPath(); x.arc(tc, ty + r.thumb / 2, r.thumb / 2 - 3, 0, Math.PI * 2); x.strokeStyle = TONES["t-stay"][2]; x.lineWidth = 3.5; x.stroke();
            drawIcon(x, icons.moon, tc, ty + r.thumb / 2, 34 * s, TONES["t-stay"][0], 2.2);
          } else {
            rrect(x, tc - r.thumb / 2, ty, r.thumb, r.thumb, 22 * s); x.fillStyle = mid; x.fill();
            if(e.n){ x.fillStyle = "#FFFFFF"; x.font = font(600, 32 * s, DISPLAY); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(e.n), tc, ty + r.thumb / 2 + 1); x.textAlign = "left"; x.textBaseline = "alphabetic"; }
            else drawIcon(x, icons[e.icon], tc, ty + r.thumb / 2, 36 * s, e.tone === "t-stay" ? "#2B211C" : "#FFFFFF", 2.2);
            x.fillStyle = C.ink; x.font = font(500, 32 * s, DISPLAY); x.fillText(e.time || "", L, ty + 44 * s);
          }
          x.fillStyle = C.ink; x.font = font(500, 36 * s);
          r.tl.forEach((l, k) => x.fillText(l, L + r.textX, ty + 40 * s + k * 50 * s));
          x.fillStyle = C.muted; x.font = font(400, 29 * s);
          r.nl.forEach((l, k) => x.fillText(l, L + r.textX, ty + 40 * s + r.tl.length * 50 * s + k * 42 * s));
        }
        y += r.h;
        const nx = rows[i + 1];
        if(nx && e.type !== "move" && nx.e.type !== "move"){ x.fillStyle = C.line; x.fillRect(L + r.textX, y - 2, inner - r.textX, 2); }
      });
    } else {
      card(x, M, ly, W - M * 2, 180, 48, C.surface, true);
      x.fillStyle = C.muted; x.font = font(400, 34); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("ยังไม่มีแผนสำหรับวันนี้", W / 2, ly + 90);
    }

    // a quiet day (often a travel day) leaves room at the bottom: soft mountains, like the trip card
    const used = entries.length ? ly + Math.min(foot - ly, listH()) : ly + 180;
    if(foot - used > 480){
      const [, soft, mid] = tone("t-" + (day.tone || "flight")), k = 3.4, ax = W / 2 - 104 * k, ay = foot - 30 - 110 * k;
      x.save(); x.globalAlpha = 0.55; x.translate(ax, ay); x.scale(k, k);
      x.fillStyle = C.accent; x.beginPath(); x.arc(150, 30, 13, 0, Math.PI * 2); x.fill();
      x.fillStyle = soft; x.fill(new Path2D("M14 110 L80 46 L146 110 Z")); x.fill(new Path2D("M98 110 L146 66 L194 110 Z"));
      x.globalAlpha = 0.35; x.fillStyle = mid; x.fill(new Path2D("M98 110 L146 66 L194 110 Z"));
      x.restore();
      drawIcon(x, icons.flight, W / 2 - 150, ay + 40, 90, tone("t-flight")[2], 2);
    }

    // footer: the app's name with its little mark
    x.textAlign = "left"; x.textBaseline = "alphabetic"; x.font = font(500, 28, DISPLAY);
    const label = "My Trip", lw = x.measureText(label).width, fx = (W - lw - 54) / 2, fy = H - 62;
    x.save(); x.strokeStyle = "#5C3B22"; x.lineWidth = 4; x.lineCap = "round"; x.lineJoin = "round";
    x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + 12, fy - 13); x.lineTo(fx + 20, fy - 6); x.lineTo(fx + 28, fy - 15); x.lineTo(fx + 40, fy); x.stroke(); x.restore();
    x.fillStyle = C.muted; x.fillText(label, fx + 54, fy);
    return c;
  }

  window.PlanExport = { renderDay, W, H };
})();
