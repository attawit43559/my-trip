/* My Trip — day plan pages: one portrait page per day, a cozy timeline on warm paper (the app's fonts)
 * window.PlanExport.renderDay(day, opts) -> Promise<HTMLCanvasElement>
 *   day: {tripName, tone, dayNo, dayCount, dateLabel, entries:[{type, time, title, note, spot, ride, mode, minutes, night}]}
 *   opts: {icons: {name: svgInner}, tiles: true}
 */
(function(){
  const W = 1080, H = 1920, M = 60;
  const DISPLAY = '"Mitr", "Prompt", sans-serif', BODY = '"Prompt", sans-serif';
  const C = {bg:"#FFFDF9", surface:"#FFFFFF", tile:"#F6F1EA", ink:"#2B211C", muted:"#6E6259", line:"#EFE9E0", accent:"#FFB020"};
  /* the app's category colours: deep / soft / mid */
  const TONES = {
    "t-flight":["#2B61B2","#E0ECFF","#3D8BFF"], "t-stay":["#634BB2","#EDE7FF","#8E6BFF"], "t-place":["#358834","#E2F5E2","#4CC24A"],
    "t-move":["#18767F","#DCF1F3","#22A9B5"], "k-sight":["#358834","#E2F5E2","#4CC24A"],
    /* trip covers */
    "cv-flight":["#1958BD","#E3EEFF","#2F80FF"], "cv-stay":["#8A5300","#FFF1CC","#FFB020"], "cv-place":["#2B7A1C","#E2F6D6","#3FB02A"], "cv-move":["#C23B1C","#FFE5DB","#FF6A3D"], "k-food":["#B26C2B","#FFEFE0","#FF9A3D"], "k-shop":["#B24271","#FFE5F0","#FF5FA2"]
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
  /* map tiles are 256 px; they are drawn 1.5x so street names stay readable on a phone screen */
  const TILE = 384, SRC = 256;
  const tileUrls = (z, x, y) => [
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`];
  const lon2x = (lon, z) => (lon + 180) / 360 * TILE * Math.pow(2, z);
  const lat2y = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * Math.pow(2, z); };
  function loadImg(src){ return new Promise(res => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; setTimeout(() => res(null), 12000); }); }
  async function drawMap(x, box, pts, opts){
    const {x:bx, y:by, w:bw, h:bh} = box, pad = 80;
    // never closer than a neighbourhood view, so a lone stop still shows its surroundings
    let z = 14;
    if(pts.length > 1) for(z = 15; z > 2; z--){
      const xs = pts.map(p => lon2x(p.lon, z)), ys = pts.map(p => lat2y(p.lat, z));
      if(Math.max(...xs) - Math.min(...xs) <= bw - pad * 2 && Math.max(...ys) - Math.min(...ys) <= bh - pad * 2) break;
    }
    const xs = pts.map(p => lon2x(p.lon, z)), ys = pts.map(p => lat2y(p.lat, z));
    const ox = (Math.max(...xs) + Math.min(...xs)) / 2 - bw / 2, oy = (Math.max(...ys) + Math.min(...ys)) / 2 - bh / 2;
    x.save(); rrect(x, bx, by, bw, bh, 44); x.clip();
    x.fillStyle = "#F2EEE6"; x.fillRect(bx, by, bw, bh);
    let tilesOk = 0, usedOsm = false;
    if(opts.tiles !== false){
      const n = Math.pow(2, z), jobs = [];
      for(let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + bw) / TILE); tx++) for(let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + bh) / TILE); ty++){
        if(ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        const [main, spare] = tileUrls(z, wx, ty);
        jobs.push(loadImg(main).then(img => img || loadImg(spare).then(i2 => { if(i2) usedOsm = true; return i2; })).then(img => {
          if(img){ x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, SRC, SRC, bx + tx * TILE - ox, by + ty * TILE - oy, TILE, TILE); tilesOk++; } }));
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
    if(tilesOk){ x.fillStyle = "rgba(90,80,70,0.75)"; x.font = font(400, 17); x.textAlign = "right"; x.textBaseline = "alphabetic"; x.fillText(usedOsm ? "© OpenStreetMap contributors" : "© Esri · OpenStreetMap", bx + bw - 26, by + bh - 18); }
  }

  /* ---------- the cozy page: warm paper, one soft card, a line of stops joined by a winding dashed path ---------- */
  const fmtMin = m => { m = Math.round(m); if(!m) return ""; const h = Math.floor(m / 60), r = m % 60; return h ? `${h} ชม.${r ? ` ${r} น.` : ""}` : `${r} นาที`; };
  const Z = {bg:"#F7F1E6", card:"#FFFCF6", ink:"#3B2F28", head:"#4A3527", muted:"#8A7B6E", sub:"#7A6A5C", time:"#A9692A", path:"#D2B48C", hill1:"#E9DFCC", hill2:"#DED0B6", sun:"#E6B565", ridge:"#B9A48C"};
  /* soft circle colour and line colour for each kind of stop / ride */
  const SPOT = {plane:["#E7EEF3","#5F7F9C"], hotel:["#F3E4DC","#B0654A"], sight:["#E8ECDD","#6F8A5B"], park:["#E8ECDD","#6F8A5B"], food:["#F6E6D3","#A9692A"], shop:["#F1E1E6","#A05C74"], night:["#ECE7F0","#7E6E9A"]};
  const RIDE = {car:["#F1E2C8","#8A6A4A"], train:["#E7EEF3","#5F7F9C"], bus:["#E7EEF3","#5F7F9C"], walk:["#E8ECDD","#6F8A5B"], boat:["#E7EEF3","#5F7F9C"], plane:["#E7EEF3","#5F7F9C"]};
  const PLANE = "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

  let cozyPaper = null;
  function cozyBg(){
    if(cozyPaper) return cozyPaper;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"); x.fillStyle = Z.bg; x.fillRect(0, 0, W, H);
    const img = x.getImageData(0, 0, W, H), d = img.data, r = rng("cozy");
    for(let i = 0; i < d.length; i += 4){ const n = (r() - 0.5) * 6; d[i] += n; d[i+1] += n; d[i+2] += n; }
    x.putImageData(img, 0, 0);
    return cozyPaper = c;
  }
  /* an svg-style path string drawn at (X, Y), scaled by k */
  function strokeD(x, d, X, Y, k, color, w, fill){
    x.save(); x.translate(X, Y); x.scale(k, k);
    const p = new Path2D(d);
    if(fill){ x.fillStyle = fill; x.fill(p); }
    x.strokeStyle = color; x.lineWidth = w; x.lineCap = "round"; x.lineJoin = "round"; x.stroke(p);
    x.restore();
  }
  /* the round sticker for a stop (a 52-unit drawing) at (cx, cy) with radius r */
  function spot(x, kind, cx, cy, r, icons){
    const [soft, line] = SPOT[kind] || SPOT.sight, k = r / 24, X = cx - 26 * k, Y = cy - 26 * k;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = soft; x.fill();
    if(kind === "plane") strokeD(x, PLANE, X + 13 * k, Y + 13 * k, 1.1 * k, line, 1.7);
    else if(kind === "hotel") strokeD(x, "M15 22 L26 14 L37 22 M17 22 h18 v17 h-18 z M23 39 v-6 h6 v6 M20 26 h4 M28 26 h4", X, Y, k, line, 2);
    else if(kind === "park") strokeD(x, "M37 23 a11 11 0 1 1 -22 0 a11 11 0 1 1 22 0 M26 12 V34 M15 23 H37 M18.5 15.5 L33.5 30.5 M33.5 15.5 L18.5 30.5 M20 41 L26 25 L32 41", X, Y, k, line, 1.6);
    else if(kind === "night") strokeD(x, "M33 31 A11 11 0 0 1 20 16 A11 11 0 1 0 33 31 Z", X, Y, k, line, 2);
    else drawIcon(x, icons[kind === "food" ? "food" : kind === "shop" ? "shop" : "pin"], cx, cy, 26 * k, line, 1.8);
  }
  /* a small vehicle beside a travel leg (a 46x30-unit drawing) at (X, Y) */
  function ride(x, kind, X, Y, k, icons){
    const [soft, line] = RIDE[kind] || RIDE.car;
    const dot = (a, b, r) => { x.beginPath(); x.arc(X + a * k, Y + b * k, r * k, 0, Math.PI * 2); x.fillStyle = line; x.fill(); };
    if(kind === "car"){
      strokeD(x, "M5 20 v-6 l5 -8 h22 l7 8 h3 a2 2 0 0 1 2 2 v4 z", X, Y, k, line, 2, soft);
      dot(13, 22, 4); dot(34, 22, 4);
    } else if(kind === "train"){
      strokeD(x, "M4 22 h34 a6 6 0 0 0 6 -6 v-4 a8 8 0 0 0 -8 -8 h-32 z", X, Y, k, line, 2, soft);
      strokeD(x, "M8 9 h7 M18 9 h7", X, Y, k, line, 2);
      dot(11, 24, 3); dot(31, 24, 3);
    } else if(kind === "plane"){
      strokeD(x, PLANE, X + 10 * k, Y + 1 * k, 1.15 * k, line, 1.7);
    } else {
      const ic = kind === "walk" ? "walk" : kind === "boat" ? "move" : "bus";
      x.beginPath(); x.arc(X + 23 * k, Y + 15 * k, 15 * k, 0, Math.PI * 2); x.fillStyle = soft; x.fill();
      drawIcon(x, icons[ic], X + 23 * k, Y + 15 * k, 22 * k, line, 2);
    }
  }

  async function renderDay(day, opts = {}){
    const icons = opts.icons || {};
    if(document.fonts && document.fonts.load){
      try{ await Promise.all([document.fonts.load(font(500, 40, DISPLAY), "วันที่ 1"), document.fonts.load(font(500, 40), "ก A"), document.fonts.load(font(400, 40), "ก A")]); } catch(_){}
    }
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.drawImage(cozyBg(), 0, 0);

    // hills along the bottom, and a line-drawn mountain with its sun in the top corner
    x.save(); x.globalAlpha = 0.55;
    x.fillStyle = Z.hill1; x.fill(new Path2D("M-20 1800 C 220 1692, 420 1744, 580 1772 C 740 1724, 920 1684, 1120 1744 V1960 H-20 Z"));
    x.fillStyle = Z.hill2; x.fill(new Path2D("M-20 1860 C 260 1792, 540 1836, 700 1856 C 860 1820, 980 1808, 1120 1828 V1960 H-20 Z"));
    x.restore();
    x.save(); x.globalAlpha = 0.9;
    x.beginPath(); x.arc(904, 144, 30, 0, Math.PI * 2); x.fillStyle = Z.sun; x.fill();
    strokeD(x, "M352 150 L404 98 L438 132 L462 110 L506 150 M392 110 L404 98 L414 108", 0, 0, 2, Z.ridge, 2.5);
    x.restore();

    // heading
    const L0 = 72;
    x.textAlign = "left"; x.textBaseline = "alphabetic";
    x.fillStyle = Z.muted; x.font = font(400, 28);
    x.fillText([day.tripName, day.dayCount ? `วันที่ ${day.dayNo} จาก ${day.dayCount}` : ""].filter(Boolean).join(" · "), L0, 128);
    x.fillStyle = Z.head; x.font = font(500, 104, DISPLAY); x.fillText(`วันที่ ${day.dayNo}`, L0, 246);
    x.fillStyle = Z.sub; x.font = font(400, 34); x.fillText(day.dateLabel || "", L0, 304);

    const entries = day.entries || [];
    const CX = 72, CY = 364, CW = W - 144, PT = 44, PL = 28, PR = 40;
    const foot = H - 100;
    const rowsOf = s => {
      const timeW = 124 * s, iconW = 104 * s, gap = 24 * s, textX = timeW + iconW + gap * 2, textW = CW - PL - PR - textX;
      return entries.map(e => {
        if(e.type === "move"){
          x.font = font(400, 28 * s);
          const label = [e.mode, e.minutes ? fmtMin(e.minutes) : ""].filter(Boolean).join(" ") || e.title;
          return {e, h:108 * s, line:wrap(x, label, textW - 100 * s, 1)[0] || "", timeW, iconW, gap, textX, textW};
        }
        x.font = font(500, 36 * s); const tl = wrap(x, e.title, textW, 2);
        x.font = font(400, 28 * s); const nl = e.note ? wrap(x, e.note, textW, 2) : [];
        const th = tl.length * 50 * s + nl.length * 40 * s;
        return {e, h:Math.max(104 * s, th) + 28 * s, tl, nl, th, timeW, iconW, gap, textX, textW};
      });
    };
    let s = 1, rows = rowsOf(s);
    const cardH = () => rows.reduce((a, r) => a + r.h, 0) + PT * 2;
    while(CY + cardH() > foot - 40 && s > 0.6){ s -= 0.03; rows = rowsOf(s); }

    if(entries.length){
      const h = Math.min(foot - 40 - CY, cardH());
      card(x, CX, CY, CW, h, 52, Z.card, true);
      x.save(); rrect(x, CX, CY, CW, h, 52); x.clip();
      let y = CY + PT, flip = false;
      // stops that follow each other with no travel leg between them get a soft solid line
      { let yy = CY + PT; const ic0 = CX + PL + rows[0].timeW + rows[0].gap + rows[0].iconW / 2;
        rows.forEach((r, i) => { const nx = rows[i + 1];
          if(nx && r.e.type !== "move" && nx.e.type !== "move"){
            x.save(); x.strokeStyle = "#EADFCF"; x.lineWidth = 5 * s; x.lineCap = "round";
            x.beginPath(); x.moveTo(ic0, yy + r.h / 2 + 52 * s); x.lineTo(ic0, yy + r.h + nx.h / 2 - 52 * s); x.stroke(); x.restore(); }
          yy += r.h; }); }
      rows.forEach(r => {
        const e = r.e, L = CX + PL, ic = L + r.timeW + r.gap + r.iconW / 2, cy = y + r.h / 2;
        if(e.type === "move"){
          // a winding dashed path, bending the other way on each leg
          const dir = (flip = !flip) ? -1 : 1, top = y - 4 * s, bot = y + r.h + 4 * s, q = r.h / 3;
          x.save(); x.strokeStyle = Z.path; x.lineWidth = 5 * s; x.lineCap = "round"; x.setLineDash([3 * s, 14 * s]);
          x.beginPath(); x.moveTo(ic, top); x.bezierCurveTo(ic + dir * 28 * s, top + q, ic - dir * 28 * s, bot - q, ic, bot); x.stroke(); x.restore();
          const k = 1.5 * s, vx = L + r.textX, vy = cy - 15 * k;
          ride(x, e.ride || "car", vx, vy, k, icons);
          const line = (RIDE[e.ride] || RIDE.car)[1];
          x.fillStyle = line; x.font = font(400, 28 * s); x.textBaseline = "middle"; x.textAlign = "left";
          x.fillText(r.line, vx + 46 * k + 16 * s, cy + 1);
          if(e.time){ x.fillStyle = Z.muted; x.font = font(400, 26 * s, DISPLAY); x.textAlign = "right"; x.fillText(e.time, L + r.timeW, cy + 1); }
        } else {
          spot(x, e.spot || "sight", ic, cy, 48 * s, icons);
          x.textBaseline = "middle"; x.textAlign = "right";
          if(e.night){ x.fillStyle = SPOT.night[1]; x.font = font(500, 32 * s, DISPLAY); x.fillText("คืนนี้", L + r.timeW, cy + 1); }
          else if(e.time){ x.fillStyle = Z.time; x.font = font(500, 38 * s, DISPLAY); x.fillText(e.time, L + r.timeW, cy + 1); }
          x.textAlign = "left"; x.textBaseline = "alphabetic";
          let ty = cy - r.th / 2 + 38 * s;
          x.fillStyle = Z.ink; x.font = font(500, 36 * s);
          r.tl.forEach(l => { x.fillText(l, L + r.textX, ty); ty += 50 * s; });
          x.fillStyle = Z.muted; x.font = font(400, 28 * s);
          r.nl.forEach(l => { x.fillText(l, L + r.textX, ty - 6 * s); ty += 40 * s; });
        }
        y += r.h;
      });
      x.restore();
    } else {
      card(x, CX, CY, CW, 200, 52, Z.card, true);
      x.fillStyle = Z.muted; x.font = font(400, 34); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("ยังไม่มีแผนสำหรับวันนี้", W / 2, CY + 100);
    }

    // footer: the app's name with its little mark
    x.textAlign = "left"; x.textBaseline = "alphabetic"; x.font = font(500, 28, DISPLAY);
    const label = "My Trip", lw = x.measureText(label).width, fx = (W - lw - 54) / 2, fy = H - 54;
    x.save(); x.strokeStyle = "#5C3B22"; x.lineWidth = 4; x.lineCap = "round"; x.lineJoin = "round";
    x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + 12, fy - 13); x.lineTo(fx + 20, fy - 6); x.lineTo(fx + 28, fy - 15); x.lineTo(fx + 40, fy); x.stroke(); x.restore();
    x.fillStyle = Z.sub; x.fillText(label, fx + 54, fy);
    return c;
  }

  window.PlanExport = { renderDay, W, H };
})();
