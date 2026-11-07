/* My Trip — day plan pages: one portrait page per day, a cozy timeline on warm paper (the app's fonts)
 * window.PlanExport.renderDay(day, opts) -> Promise<HTMLCanvasElement>
 *   day: {tripName, tone, dayNo, dayCount, dateLabel, entries:[{type, time, title, note, spot, ride, mode, minutes, night}]}
 *   opts: {icons: {name: svgInner}, tiles: true}
 */
/* English: the app's translator swaps Thai labels drawn on the page (layout is measured on the swapped text too) */
const tr2d = x => { const T = window.myTripT; if(!T) return x; const f = x.fillText.bind(x), m = x.measureText.bind(x); x.fillText = (s, ...a) => f(T(String(s)), ...a); x.measureText = s => m(T(String(s))); return x; };
(function(){
  const W = 1080, H = 1920, M = 60;
  const DISPLAY = '"Mitr", "Prompt", sans-serif', BODY = '"Prompt", sans-serif';
  const C = {bg:"#FFFDF9", surface:"#FFFFFF", tile:"#F6F1EA", ink:"#2B211C", muted:"#6E6259", line:"#EFE9E0", accent:"#FFB020"};
  /* the app's category colours: deep / soft / mid */
  const TONES = {
    "t-flight":["#B4501A","#FFE8D6","#F2802F"], "t-stay":["#6A3A86","#F1E5F6","#9B5BC0"], "t-place":["#358834","#E2F5E2","#4CC24A"],
    "t-move":["#18767F","#DCF1F3","#22A9B5"], "k-sight":["#358834","#E2F5E2","#4CC24A"],
    /* trip covers */
    "cv-flight":["#A3204F","#FFD6E4","#F0457E"], "cv-stay":["#8A5300","#FFE7A8","#FFB000"], "cv-place":["#237A17","#D4F5C4","#36C22A"], "cv-move":["#B33A10","#FFD9C7","#FF6A2B"], "cv-plum":["#642D99","#EBD9FA","#A35BE0"], "cv-caramel":["#8E4A10","#FBE0C4","#E68A2E"], "cv-olive":["#5A7310","#EAF5B8","#9CC21A"], "cv-spruce":["#136F60","#C9F2EA","#1FB89E"], "cv-coral":["#A62219","#FFDAD6","#F2483C"], "cv-sun":["#7A6200","#FFF3A6","#F2CC00"], "cv-sky":["#1A5FA8","#D3E8FF","#3B8EEA"], "cv-indigo":["#3A3FA8","#DFE0FF","#5B63E6"], "k-food":["#8A6A00","#FFF4C7","#E0B000"], "k-shop":["#B83A68","#FCE4EC","#E0608E"], "k-cafe":["#6F4A2F","#F1E7DE","#9A6A44"]
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
    const x = tr2d(c.getContext("2d")); x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
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
    const x = tr2d(c.getContext("2d")); x.fillStyle = Z.bg; x.fillRect(0, 0, W, H);
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
    const x = tr2d(c.getContext("2d"));
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

  /* ---------- A4 trip book: one overview page, then one page per day (photos, timeline, AI tips) ---------- */
  const PW = 1588, PH = 2246, PM = 104;                       // A4 at 2x (794 x 1123 css px)
  const B = {bg:"#FFFDF9", tile:"#F6F1EA", ink:"#2B211C", muted:"#6E6259", line:"#EFE9E0", rule:"#E8DFD3", accent:"#B4501A",
    plum:["#F1E5F6","#6A3A86","#4F3A5C"], teal:["#EEF8F9","#12626A","#24464A"], blue:["#E0ECFF","#2B61B2","#1F3354"]};
  const DAYTONE = [["#FFE8D6","#B4501A"],["#E2F5E2","#2F7A2E"],["#E0ECFF","#2B61B2"],["#F1E5F6","#6A3A86"],["#FFF4C7","#8A6A00"],["#EEF8F9","#12626A"],["#FCE4EC","#B83A68"],["#F1E7DE","#6F4A2F"]];
  async function fontsReady(){
    await logoImg();
    if(document.fonts && document.fonts.load){
      try{ await Promise.all([document.fonts.load(font(600, 40, DISPLAY), "วันที่ 1"), document.fonts.load(font(500, 40), "ก A"), document.fonts.load(font(400, 40), "ก A")]); } catch(_){}
    }
  }
  function page(bg){ const c = document.createElement("canvas"); c.width = PW; c.height = PH; const x = tr2d(c.getContext("2d")); x.fillStyle = bg; x.fillRect(0, 0, PW, PH); return [c, x]; }
  function pill(x, text, X, Y, soft, ink, size){
    x.font = font(600, size); const w = x.measureText(text).width + size * 1.4, h = size * 2;
    rrect(x, X, Y, w, h, h / 2); x.fillStyle = soft; x.fill();
    x.fillStyle = ink; x.textBaseline = "middle"; x.textAlign = "left"; x.fillText(text, X + size * 0.7, Y + h / 2 + 1);
    return w;
  }
  /* the app's logo (mountain and plane) with its name, bottom left; the trip and page on the right */
  let logo = null;
  async function logoImg(){ if(logo === null) logo = await loadImg("icons/icon-192.png") || false; return logo; }
  function footer(x, left, right){
    const y = PH - 62, L = 58;
    x.textBaseline = "alphabetic";
    let lx = PM;
    if(logo){ rrect(x, PM, y - 42, L, L, 14); x.fillStyle = "#FFFFFF"; x.fill(); x.save(); x.strokeStyle = B.line; x.lineWidth = 2; x.stroke(); x.restore(); x.drawImage(logo, PM + 1, y - 41, L - 2, L - 2); lx += L + 14; }
    x.fillStyle = B.ink; x.font = font(600, 30, DISPLAY); x.textAlign = "left"; x.fillText("My Trip", lx, y - 4);
    if(left){ const w = x.measureText("My Trip").width; x.fillStyle = B.muted; x.font = font(400, 22); x.fillText(left, lx + w + 14, y); }
    x.fillStyle = B.muted; x.font = font(400, 22); x.textAlign = "right"; x.fillText(right, PW - PM, y);
  }
  const BED = "M3 18V7 M3 14h18v4 M21 14v-2a3 3 0 0 0-3-3h-7v5 M9 11a2 2 0 1 1 -4 0 a2 2 0 1 1 4 0";

  /* o: {tripName, sub, chips:[{label, soft, ink}], days:[{n, date, dow, title, stops:[{t, name}], stay}], pageNo, pageCount} */
  async function renderOverview(o){
    await fontsReady();
    const [c, x] = page(B.tile);
    let y = PM + 20;
    x.textAlign = "left"; x.textBaseline = "alphabetic";
    x.fillStyle = B.accent; x.font = font(600, 24); x.fillText("TRAVEL PLAN", PM, y + 4);
    x.fillStyle = B.ink; x.font = font(600, 88, DISPLAY);
    const tl = wrap(x, o.tripName || "My Trip", PW - PM * 2 - 40, 1)[0]; x.fillText(tl, PM, y + 108);
    x.fillStyle = B.muted; x.font = font(400, 29); x.fillText(o.sub || "", PM, y + 160);
    let cx = PM; (o.chips || []).forEach(ch => { cx += pill(x, ch.label, cx, y + 190, ch.soft, ch.ink, 22) + 12; });
    const top = y + 270, bottom = PH - 120, n = o.days.length, cols = 3, rows = Math.max(1, Math.ceil(n / cols)), gap = 24;
    const cw = (PW - PM * 2 - gap * (cols - 1)) / cols, ch = Math.min(560, (bottom - top - gap * (rows - 1)) / rows);
    o.days.forEach((d, i) => {
      const X = PM + (i % cols) * (cw + gap), Y = top + Math.floor(i / cols) * (ch + gap), P = 30, [soft, ink] = DAYTONE[(d.n - 1) % DAYTONE.length];
      card(x, X, Y, cw, ch, 34, "#FFFFFF", true);
      rrect(x, X + P, Y + P, 78, 78, 22); x.fillStyle = soft; x.fill();
      x.fillStyle = ink; x.font = font(600, 38, DISPLAY); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(d.n), X + P + 39, Y + P + 41);
      x.textAlign = "left"; x.textBaseline = "alphabetic";
      x.fillStyle = B.ink; x.font = font(600, 28); x.fillText(d.date, X + P + 98, Y + P + 34);
      x.fillStyle = B.muted; x.font = font(400, 22); x.fillText(d.dow, X + P + 98, Y + P + 68);
      let yy = Y + P + 126;
      x.fillStyle = B.ink; x.font = font(600, 30);
      wrap(x, d.title, cw - P * 2, 2).forEach(l => { x.fillText(l, X + P, yy); yy += 40; });
      yy += 6;
      const stayH = d.stay ? 64 : 0, room = Y + ch - P - stayH - yy, per = 34, can = Math.max(0, Math.floor(room / per));
      const stops = d.stops.length > can ? d.stops.slice(0, Math.max(0, can - 1)).concat([{t:"", name:`และอีก ${d.stops.length - can + 1} ที่`}]) : d.stops;
      stops.forEach(s => {
        x.font = font(400, 22); x.fillStyle = B.muted; x.fillText(s.t || "", X + P, yy);
        x.fillStyle = B.ink; x.fillText(wrap(x, s.name, cw - P * 2 - 70, 1)[0] || "", X + P + 70, yy); yy += per;
      });
      if(d.stay){
        const sy = Y + ch - P - 40;
        x.save(); x.strokeStyle = "#E4DBCF"; x.lineWidth = 2; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(X + P, sy - 14); x.lineTo(X + cw - P, sy - 14); x.stroke(); x.restore();
        strokeD(x, BED, X + P, sy - 2, 1.15, B.plum[1], 2);
        x.fillStyle = B.plum[1]; x.font = font(500, 22); x.fillText(wrap(x, d.stay, cw - P * 2 - 40, 1)[0] || "", X + P + 38, sy + 20);
      }
    });
    footer(x, "", o.pageCount > 1 ? `ภาพรวม ${o.pageNo}/${o.pageCount}` : "ภาพรวมทั้งทริป");
    return c;
  }

  /* d: {tripName, dayNo, dayCount, dateLong, title, entries, photos:[{img, name}], tips:[], stay:{name, sub}, travel:[lines]} */
  async function renderBookDay(d, opts = {}){
    await fontsReady();
    const icons = opts.icons || {};
    const [c, x] = page(B.bg);
    x.textAlign = "left"; x.textBaseline = "alphabetic";
    const num = String(d.dayNo).padStart(2, "0");
    x.fillStyle = B.accent; x.font = font(600, 150, DISPLAY); x.fillText(num, PM - 6, PM + 140);
    const nw = x.measureText(num).width + 30;
    x.fillStyle = B.muted; x.font = font(400, 26); x.fillText(d.dateLong || "", PM + nw, PM + 82);
    x.fillStyle = B.ink; x.font = font(600, 54, DISPLAY);
    x.fillText(wrap(x, d.title || "", PW - PM * 2 - nw - 220, 1)[0] || "", PM + nw, PM + 140);
    x.fillStyle = B.muted; x.font = font(400, 23); x.textAlign = "right"; x.fillText(wrap(x, d.tripName || "", 260, 1)[0] || "", PW - PM, PM + 140); x.textAlign = "left";
    x.fillStyle = B.ink; x.fillRect(PM, PM + 176, PW - PM * 2, 3);
    let y = PM + 216;

    // photos of the day's places
    const ph = (d.photos || []).filter(p => p && p.img).slice(0, 3);
    if(ph.length){
      const H2 = 336, gap = 20, total = PW - PM * 2, fr = ph.length === 1 ? [1] : ph.length === 2 ? [1, 1] : [2, 1, 1], unit = (total - gap * (ph.length - 1)) / fr.reduce((a, b) => a + b, 0);
      let px = PM;
      ph.forEach((p, i) => {
        const w = unit * fr[i];
        x.save(); rrect(x, px, y, w, H2, 32); x.clip();
        const s2 = Math.max(w / p.img.width, H2 / p.img.height), iw = p.img.width * s2, ih = p.img.height * s2;
        x.drawImage(p.img, px + (w - iw) / 2, y + (H2 - ih) / 2, iw, ih);
        const g = x.createLinearGradient(0, y + H2 - 110, 0, y + H2); g.addColorStop(0, "rgba(20,14,10,0)"); g.addColorStop(1, "rgba(20,14,10,0.55)");
        x.fillStyle = g; x.fillRect(px, y + H2 - 110, w, 110);
        x.fillStyle = "#FFFFFF"; x.font = font(500, 24); x.fillText(wrap(x, p.name, w - 48, 1)[0] || "", px + 24, y + H2 - 24);
        x.restore(); px += w + gap;
      });
      x.fillStyle = B.muted; x.font = font(400, 18); x.textAlign = "right"; x.fillText("รูปจาก Google Maps" + (ph.some(p => p.by) ? " · " + [...new Set(ph.map(p => p.by).filter(Boolean))].slice(0, 3).join(", ") : ""), PW - PM, y + H2 + 28); x.textAlign = "left";
      y += H2 + 56;
    }

    // timeline on the left, stay / travel / tips on the right
    const side = 472, gapC = 56, LW = PW - PM * 2 - side - gapC, bottom = PH - 130, ents = d.entries || [];
    const rowsOf = s => ents.map(e => {
      if(e.type === "move"){ x.font = font(400, 23 * s); const label = [e.mode, e.minutes ? fmtMin(e.minutes) : ""].filter(Boolean).join(" · ") || e.title; return {e, h:56 * s, line:wrap(x, label, LW - 180 * s, 1)[0] || ""}; }
      x.font = font(500, 30 * s); const tl = wrap(x, e.title, LW - 190 * s, 2);
      x.font = font(400, 23 * s); const nl = e.note ? wrap(x, e.note, LW - 190 * s, 1) : [];
      const th = tl.length * 40 * s + nl.length * 32 * s; return {e, h:Math.max(92 * s, th + 28 * s), tl, nl, th};
    });
    let s = 1, rows = rowsOf(s); const tot = () => rows.reduce((a, r) => a + r.h, 0);
    while(y + tot() > bottom && s > 0.55){ s -= 0.03; rows = rowsOf(s); }
    while(rows.length && y + tot() < bottom - 260 && s < 1.25){ s += 0.03; rows = rowsOf(s); }   // a light day gets roomier rows
    if(y + tot() > bottom){ s -= 0.03; rows = rowsOf(s); }
    const tX = PM, icX = PM + 108 * s, txX = icX + 54 * s;
    if(rows.length){
      // one quiet line through the stops
      let first = null, last = null, yy = y; rows.forEach(r => { if(r.e.type !== "move"){ const cy = yy + r.h / 2; if(first == null) first = cy; last = cy; } yy += r.h; });
      if(first != null && last > first){ x.fillStyle = B.rule; x.fillRect(icX - 2, first, 4, last - first); }
      let ry = y;
      rows.forEach(r => {
        const e = r.e, cy = ry + r.h / 2;
        if(e.type === "move"){
          const k = 0.95 * s; ride(x, e.ride || "car", txX - 6 * s, cy - 15 * k, k, icons);
          x.fillStyle = (RIDE[e.ride] || RIDE.car)[1]; x.font = font(400, 23 * s); x.textBaseline = "middle"; x.fillText(r.line, txX + 46 * k + 8 * s, cy + 1); x.textBaseline = "alphabetic";
        } else {
          x.beginPath(); x.arc(icX, cy, 38 * s, 0, Math.PI * 2); x.fillStyle = B.bg; x.fill();
          spot(x, e.spot || "sight", icX, cy, 32 * s, icons);
          x.textBaseline = "middle"; x.textAlign = "right";
          if(e.night){ x.fillStyle = SPOT.night[1]; x.font = font(500, 24 * s, DISPLAY); x.fillText("คืนนี้", tX + 62 * s, cy + 1); }
          else if(e.time){ x.fillStyle = B.ink; x.font = font(600, 27 * s, DISPLAY); x.fillText(e.time, tX + 62 * s, cy + 1); }
          x.textAlign = "left"; x.textBaseline = "alphabetic";
          let ty = cy - r.th / 2 + 30 * s;
          x.fillStyle = B.ink; x.font = font(500, 30 * s); r.tl.forEach(l => { x.fillText(l, txX, ty); ty += 40 * s; });
          x.fillStyle = B.muted; x.font = font(400, 23 * s); r.nl.forEach(l => { x.fillText(l, txX, ty - 4 * s); ty += 32 * s; });
        }
        ry += r.h;
      });
    } else { x.fillStyle = B.muted; x.font = font(400, 28); x.fillText("ยังไม่มีแผนสำหรับวันนี้", PM, y + 40); }

    // side cards
    const SX = PW - PM - side; let sy = y;
    const box = (title, tone, lines, big) => {
      x.font = font(big ? 600 : 400, big ? 29 : 24); const ls = []; lines.forEach((l, i) => { x.font = i === 0 && big ? font(600, 29) : font(400, 24); wrap(x, l, side - 60, 3).forEach(w => ls.push([w, i === 0 && big])); });
      const h = 76 + ls.reduce((a, [, b]) => a + (b ? 40 : 34), 0);
      if(sy + h > bottom) return;
      rrect(x, SX, sy, side, h, 32); x.fillStyle = tone[0]; x.fill();
      x.fillStyle = tone[1]; x.font = font(600, 21); x.fillText(title, SX + 30, sy + 46);
      let ly = sy + 46;
      ls.forEach(([w, b]) => { ly += b ? 40 : 34; x.fillStyle = b ? B.ink : tone[2]; x.font = b ? font(600, 29) : font(400, 24); x.fillText(w, SX + 30, ly); });
      sy += h + 22;
    };
    if(d.stay) box("ที่พักคืนนี้", B.plum, [d.stay.name, d.stay.sub].filter(Boolean), true);
    if(d.travel && d.travel.length) box("เดินทางวันนี้", B.teal, d.travel, false);
    if(d.tips && d.tips.length){
      x.font = font(400, 24); const lines = []; d.tips.forEach(t => wrap(x, t, side - 84, 4).forEach((w, i) => lines.push([w, i === 0])));
      let h = 84 + lines.length * 36 + d.tips.length * 8;
      if(sy + h > bottom){ h = bottom - sy; }
      if(h > 160){
        rrect(x, SX, sy, side, h, 32); x.fillStyle = B.blue[0]; x.fill();
        drawIcon(x, '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>', SX + 42, sy + 38, 26, B.blue[1], 2);
        x.fillStyle = B.blue[1]; x.font = font(600, 21); x.fillText("TIPS จาก AI", SX + 64, sy + 46);
        let ly = sy + 46; x.save(); rrect(x, SX, sy, side, h, 32); x.clip();
        lines.forEach(([w, firstLine]) => { if(firstLine){ ly += 8; } ly += 36; if(ly > sy + h - 20) return; if(firstLine){ x.fillStyle = B.blue[1]; x.fillText("•", SX + 30, ly); } x.fillStyle = B.blue[2]; x.font = font(400, 24); x.fillText(w, SX + 54, ly); });
        x.restore();
      }
    }
    footer(x, d.tripName ? "· " + d.tripName : "", `วันที่ ${d.dayNo} / ${d.dayCount}`);
    return c;
  }

  window.PlanExport = { renderDay, renderOverview, renderBookDay, W, H, PW, PH };
})();
