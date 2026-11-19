// Simboli originali in SVG (viewBox 200x200), convertiti in immagini data-URI.

function svgWrap(defs, body) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
    '<defs>' + defs +
    '<filter id="ds" x="-25%" y="-25%" width="150%" height="150%">' +
    '<feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#000" flood-opacity=".6"/></filter>' +
    '</defs><g filter="url(#ds)">' + body + '</g></svg>';
}

function symWedges(cx, cy, r0, r1, n, gapDeg, rot) {
  let d = '';
  const rad = (a) => ((a - 90 + rot) * Math.PI) / 180;
  const pt = (r, a) => (cx + r * Math.cos(rad(a))).toFixed(2) + ' ' + (cy + r * Math.sin(rad(a))).toFixed(2);
  for (let i = 0; i < n; i++) {
    const a0 = (i * 360) / n + gapDeg / 2;
    const a1 = ((i + 1) * 360) / n - gapDeg / 2;
    d += 'M' + pt(r0, a0) + 'L' + pt(r1, a0) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + pt(r1, a1) + 'L' + pt(r0, a1) + 'Z';
  }
  return d;
}

function symCitrus(c) {
  const defs =
    '<radialGradient id="rind" cx="50%" cy="42%" r="58%"><stop offset="78%" stop-color="' + c.rind1 + '"/><stop offset="100%" stop-color="' + c.rind2 + '"/></radialGradient>' +
    '<radialGradient id="pulp" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="' + c.p0 + '"/><stop offset="60%" stop-color="' + c.p1 + '"/><stop offset="100%" stop-color="' + c.p2 + '"/></radialGradient>' +
    '<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>';
  const body =
    '<circle cx="100" cy="100" r="80" fill="url(#rind)"/>' +
    '<circle cx="100" cy="100" r="80" fill="none" stroke="' + c.rind2 + '" stroke-width="3"/>' +
    '<circle cx="100" cy="100" r="71" fill="' + c.pith + '"/>' +
    '<path d="' + symWedges(100, 100, 9, 65, c.n, 7, 8) + '" fill="url(#pulp)" stroke="' + c.p2 + '" stroke-opacity=".35" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="' + symWedges(100, 100, 22, 52, c.n, 22, 8) + '" fill="#fff" fill-opacity=".18"/>' +
    '<circle cx="100" cy="100" r="9" fill="' + c.pith + '"/>' +
    '<ellipse cx="86" cy="62" rx="52" ry="30" fill="url(#gl)"/>' +
    '<path d="M38 86 A64 64 0 0 1 104 36" stroke="#fff" stroke-opacity=".75" stroke-width="5" fill="none" stroke-linecap="round"/>';
  return svgWrap(defs, body);
}

const SYM_LIME = symCitrus({ rind1: '#5cb52b', rind2: '#1d5410', pith: '#eef8d4', p0: '#f6ffd2', p1: '#c2e64f', p2: '#77b51c', n: 8 });
const SYM_ARANCIA = symCitrus({ rind1: '#ff8f1f', rind2: '#a83c00', pith: '#fff1dc', p0: '#ffe2a3', p1: '#ffad33', p2: '#f07300', n: 10 });

const SYM_CILIEGIA = svgWrap(
  '<radialGradient id="ch" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ff7a8a"/><stop offset=".35" stop-color="#e0112b"/><stop offset=".8" stop-color="#7a0016"/><stop offset="1" stop-color="#3d000b"/></radialGradient>' +
  '<linearGradient id="lf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9be15d"/><stop offset="1" stop-color="#2e7d32"/></linearGradient>',
  '<path d="M104 28 C96 58 80 84 66 112" stroke="#5d4022" stroke-width="6" fill="none" stroke-linecap="round"/>' +
  '<path d="M104 28 C112 60 126 82 136 104" stroke="#5d4022" stroke-width="6" fill="none" stroke-linecap="round"/>' +
  '<path d="M104 30 C118 6 152 10 166 24 C146 38 120 42 104 30Z" fill="url(#lf)"/>' +
  '<path d="M106 29 C126 22 144 22 162 24" stroke="#1b5e20" stroke-width="2" fill="none" stroke-opacity=".6"/>' +
  '<circle cx="66" cy="136" r="40" fill="url(#ch)"/>' +
  '<circle cx="138" cy="128" r="37" fill="url(#ch)"/>' +
  '<ellipse cx="52" cy="120" rx="12" ry="8" fill="#fff" fill-opacity=".8" transform="rotate(-30 52 120)"/>' +
  '<ellipse cx="125" cy="113" rx="11" ry="7" fill="#fff" fill-opacity=".8" transform="rotate(-30 125 113)"/>' +
  '<circle cx="80" cy="160" r="5" fill="#fff" fill-opacity=".25"/>'
);

const SYM_GHIACCIO = svgWrap(
  '<linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cdeeff"/></linearGradient>' +
  '<linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe8ff"/><stop offset="1" stop-color="#4fa9e6"/></linearGradient>' +
  '<linearGradient id="r" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6f7ff"/><stop offset="1" stop-color="#7cc4f0"/></linearGradient>',
  '<g stroke-linejoin="round">' +
  '<polygon points="100,34 164,68 100,102 36,68" fill="url(#t)" stroke="#fff" stroke-width="3"/>' +
  '<polygon points="36,68 100,102 100,174 36,140" fill="url(#l)" stroke="#e8f8ff" stroke-width="3" fill-opacity=".95"/>' +
  '<polygon points="164,68 100,102 100,174 164,140" fill="url(#r)" stroke="#e8f8ff" stroke-width="3" fill-opacity=".95"/>' +
  '</g>' +
  '<path d="M48 82 L48 128" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/>' +
  '<path d="M70 58 L116 46" stroke="#fff" stroke-opacity=".9" stroke-width="4" stroke-linecap="round"/>' +
  '<circle cx="70" cy="126" r="5" fill="#fff" fill-opacity=".6"/><circle cx="80" cy="146" r="3" fill="#fff" fill-opacity=".6"/>' +
  '<circle cx="132" cy="120" r="4" fill="#fff" fill-opacity=".55"/><circle cx="142" cy="140" r="2.5" fill="#fff" fill-opacity=".6"/>' +
  '<path d="M156 26 L161 40 L175 45 L161 50 L156 64 L151 50 L137 45 L151 40Z" fill="#fff"/>'
);

const SYM_SHAKER = svgWrap(
  '<linearGradient id="m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a5f66"/><stop offset=".16" stop-color="#f4f6f8"/><stop offset=".3" stop-color="#b9bec4"/><stop offset=".5" stop-color="#7d838a"/><stop offset=".72" stop-color="#eef1f4"/><stop offset="1" stop-color="#4b5056"/></linearGradient>' +
  '<linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6420"/><stop offset=".3" stop-color="#ffe9a3"/><stop offset=".55" stop-color="#d4a437"/><stop offset="1" stop-color="#7a5418"/></linearGradient>',
  '<rect x="84" y="18" width="32" height="20" rx="7" fill="url(#m)"/>' +
  '<rect x="80" y="34" width="40" height="7" rx="3" fill="url(#g)"/>' +
  '<path d="M80 41 L120 41 L130 72 L70 72Z" fill="url(#m)"/>' +
  '<rect x="64" y="70" width="72" height="11" rx="4" fill="url(#g)"/>' +
  '<path d="M66 81 L134 81 L148 172 Q149 184 137 184 L63 184 Q51 184 52 172Z" fill="url(#m)"/>' +
  '<rect x="55" y="160" width="90" height="8" fill="url(#g)" opacity=".95"/>' +
  '<path d="M76 90 L68 156" stroke="#fff" stroke-opacity=".85" stroke-width="5" stroke-linecap="round"/>' +
  '<circle cx="118" cy="104" r="3" fill="#fff" fill-opacity=".8"/><circle cx="124" cy="128" r="2.4" fill="#fff" fill-opacity=".7"/><circle cx="110" cy="142" r="2" fill="#fff" fill-opacity=".7"/>'
);

const SYM_COPPA = svgWrap(
  '<linearGradient id="lq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7eb3"/><stop offset=".6" stop-color="#e91e63"/><stop offset="1" stop-color="#8e0038"/></linearGradient>' +
  '<linearGradient id="gs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".15"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient>' +
  '<radialGradient id="lm" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#fff9c4"/><stop offset=".6" stop-color="#ffeb3b"/><stop offset="1" stop-color="#f9a825"/></radialGradient>',
  '<path d="M48 58 L152 58 L100 118Z" fill="url(#lq)"/>' +
  '<ellipse cx="100" cy="58" rx="52" ry="7" fill="#ffb3d1"/>' +
  '<path d="M34 44 L166 44 L100 124Z" fill="url(#gs)" stroke="#fff" stroke-opacity=".85" stroke-width="3.5" stroke-linejoin="round"/>' +
  '<rect x="96" y="122" width="8" height="48" fill="#e8f4ff" fill-opacity=".9"/>' +
  '<ellipse cx="100" cy="174" rx="42" ry="9" fill="#e8f4ff" fill-opacity=".9"/>' +
  '<ellipse cx="100" cy="172" rx="30" ry="4" fill="#fff"/>' +
  '<path d="M52 52 L92 104" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/>' +
  '<path d="M150 44 A24 24 0 0 1 174 68 L150 68Z" fill="url(#lm)" stroke="#f9a825" stroke-width="2"/>' +
  '<path d="M150 50 L168 66 M150 58 L160 66" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>'
);

const SYM_ELISIR = svgWrap(
  '<linearGradient id="am" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b2d00"/><stop offset=".25" stop-color="#ffb347"/><stop offset=".55" stop-color="#d86f00"/><stop offset="1" stop-color="#5a2300"/></linearGradient>' +
  '<linearGradient id="gd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6420"/><stop offset=".35" stop-color="#fff0b0"/><stop offset=".6" stop-color="#d4a437"/><stop offset="1" stop-color="#6e4b12"/></linearGradient>' +
  '<radialGradient id="glow" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="#ffd76a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>',
  '<circle cx="100" cy="112" r="88" fill="url(#glow)"/>' +
  '<path d="M60 96 Q60 76 80 72 L86 70 L86 42 L114 42 L114 70 L120 72 Q140 76 140 96 L140 172 Q140 186 126 186 L74 186 Q60 186 60 172Z" fill="url(#am)" stroke="#3b1500" stroke-width="2"/>' +
  '<path d="M64 98 Q66 82 82 78 L82 100Z" fill="#fff" fill-opacity=".25"/>' +
  '<rect x="87" y="16" width="26" height="22" rx="5" fill="#8d5a2b"/>' +
  '<rect x="83" y="36" width="34" height="18" rx="3" fill="url(#gd)"/>' +
  '<rect x="70" y="112" width="60" height="50" rx="5" fill="#1a0c06" stroke="url(#gd)" stroke-width="4"/>' +
  '<path d="M100 120 L116 137 L100 154 L84 137Z" fill="none" stroke="url(#gd)" stroke-width="3"/>' +
  '<path d="M100 128 L108 137 L100 146 L92 137Z" fill="url(#gd)"/>' +
  '<path d="M74 122 L84 122 M116 122 L126 122 M74 152 L84 152 M116 152 L126 152" stroke="url(#gd)" stroke-width="2"/>' +
  '<path d="M70 104 L70 172" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>'
);

const SYM_MAESTRO = svgWrap(
  '<linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset=".3" stop-color="#d4a437"/><stop offset=".55" stop-color="#8a6420"/><stop offset=".8" stop-color="#f7d775"/><stop offset="1" stop-color="#7a5418"/></linearGradient>' +
  '<radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#5a0f24"/><stop offset="1" stop-color="#16030a"/></radialGradient>' +
  '<linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#e8bd4f"/><stop offset="1" stop-color="#a87a22"/></linearGradient>' +
  '<clipPath id="cp"><circle cx="100" cy="100" r="78"/></clipPath>',
  '<circle cx="100" cy="100" r="94" fill="url(#ring)"/>' +
  '<circle cx="100" cy="100" r="84" fill="#2a0712"/>' +
  '<circle cx="100" cy="100" r="80" fill="url(#bg)" stroke="url(#ring)" stroke-width="3"/>' +
  '<g clip-path="url(#cp)">' +
  '<g stroke="#d4a437" stroke-opacity=".22" stroke-width="2">' +
  '<path d="M100 100 L100 10 M100 100 L164 36 M100 100 L190 100 M100 100 L36 36 M100 100 L10 100"/></g>' +
  '<path d="M38 200 Q40 156 76 146 L124 146 Q160 156 162 200Z" fill="url(#fg)"/>' +
  '<path d="M84 146 L100 176 L116 146Z" fill="#2a0712"/>' +
  '<path d="M86 148 L100 158 L86 168Z M114 148 L100 158 L114 168Z" fill="#b3122e"/>' +
  '<circle cx="100" cy="158" r="4" fill="#ffd54a"/>' +
  '<ellipse cx="100" cy="104" rx="25" ry="30" fill="url(#fg)"/>' +
  '<rect x="92" y="126" width="16" height="16" fill="url(#fg)"/>' +
  '<path d="M84 96 Q90 91 96 96 M104 96 Q110 91 116 96" stroke="#2a0712" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
  '<path d="M83 88 L95 86 M105 86 L117 88" stroke="#2a0712" stroke-width="2.6" stroke-linecap="round"/>' +
  '<path d="M100 112 C92 108 80 108 72 116 C70 110 76 104 82 106 C86 104 94 106 100 110 C106 106 114 104 118 106 C124 104 130 110 128 116 C120 108 108 108 100 112Z" fill="#2a0712"/>' +
  '<ellipse cx="100" cy="72" rx="42" ry="8" fill="#1a0409" stroke="url(#ring)" stroke-width="2"/>' +
  '<path d="M76 70 L80 26 Q100 20 120 26 L124 70Z" fill="#1a0409" stroke="url(#ring)" stroke-width="2"/>' +
  '<rect x="78" y="58" width="44" height="8" fill="#b3122e"/>' +
  '</g>' +
  '<path d="M100 2 L104 12 L100 22 L96 12Z M198 100 L188 104 L178 100 L188 96Z M2 100 L12 96 L22 100 L12 104Z" fill="#fff2b8"/>'
);

const SYM_GRIMORIO = svgWrap(
  '<radialGradient id="au" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe082" stop-opacity=".9"/><stop offset=".55" stop-color="#ffb300" stop-opacity=".35"/><stop offset="1" stop-color="#ffb300" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="lt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a1a7a"/><stop offset=".5" stop-color="#2b0b4f"/><stop offset="1" stop-color="#14052a"/></linearGradient>' +
  '<linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".35" stop-color="#e2b13c"/><stop offset=".65" stop-color="#9c7020"/><stop offset="1" stop-color="#f8dc84"/></linearGradient>' +
  '<linearGradient id="pg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9dcb8"/><stop offset="1" stop-color="#b9a679"/></linearGradient>',
  '<circle cx="100" cy="100" r="98" fill="url(#au)"/>' +
  '<path d="M60 30 L160 30 Q168 30 168 40 L168 170 Q168 178 160 178 L60 178Z" fill="url(#pg)"/>' +
  '<path d="M162 40 L162 170 M157 36 L157 172 M152 34 L152 174" stroke="#8d7a50" stroke-width="1.4"/>' +
  '<rect x="34" y="22" width="122" height="150" rx="10" fill="url(#lt)" stroke="url(#gd)" stroke-width="4"/>' +
  '<rect x="34" y="22" width="18" height="150" rx="6" fill="#1a0533"/>' +
  '<path d="M34 46 L52 46 M34 148 L52 148" stroke="url(#gd)" stroke-width="5"/>' +
  '<rect x="58" y="32" width="88" height="130" rx="6" fill="none" stroke="url(#gd)" stroke-width="2" stroke-dasharray="2 4"/>' +
  '<path d="M56 30 L78 30 L56 52Z M148 30 L126 30 L148 52Z M56 164 L78 164 L56 142Z M148 164 L126 164 L148 142Z" fill="url(#gd)"/>' +
  '<g transform="translate(103 97)">' +
  '<g stroke="url(#gd)" stroke-width="3" stroke-linecap="round">' +
  '<path d="M0 -42 L0 -34 M0 34 L0 42 M-42 0 L-34 0 M34 0 L42 0 M-30 -30 L-24 -24 M30 30 L24 24 M30 -30 L24 -24 M-30 30 L-24 24"/></g>' +
  '<circle r="29" fill="#14052a" stroke="url(#gd)" stroke-width="4"/>' +
  '<path d="M-17 -12 L17 -12 L0 7Z" fill="url(#gd)"/>' +
  '<rect x="-2" y="6" width="4" height="12" fill="url(#gd)"/>' +
  '<rect x="-10" y="17" width="20" height="4" rx="2" fill="url(#gd)"/>' +
  '<circle cx="9" cy="-17" r="4" fill="#ff5d73"/>' +
  '</g>' +
  '<rect x="150" y="88" width="20" height="22" rx="4" fill="url(#gd)"/>' +
  '<circle cx="160" cy="99" r="4" fill="#5a1a2a"/>'
);

const SYMBOL_SVGS = [SYM_LIME, SYM_ARANCIA, SYM_CILIEGIA, SYM_GHIACCIO, SYM_SHAKER, SYM_COPPA, SYM_ELISIR, SYM_MAESTRO, SYM_GRIMORIO];

function svgToDataUrl(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export const SYMBOL_URLS = SYMBOL_SVGS.map(svgToDataUrl);

export function symbolUrl(id) { return SYMBOL_URLS[id]; }

// Motivo Art Déco a ventaglio per lo sfondo.
export const DECO_PATTERN_URL = svgToDataUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60">' +
  '<g fill="none" stroke="#d4af37" stroke-opacity=".09" stroke-width="1.2">' +
  '<path d="M0 60 A60 60 0 0 1 120 60"/><path d="M12 60 A48 48 0 0 1 108 60"/><path d="M24 60 A36 36 0 0 1 96 60"/><path d="M36 60 A24 24 0 0 1 84 60"/>' +
  '<path d="M-60 30 A60 60 0 0 1 60 30"/><path d="M60 30 A60 60 0 0 1 180 30"/>' +
  '<path d="M60 60 L60 36 M30 60 L44 40 M90 60 L76 40"/></g></svg>'
);

export function iconSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    '<defs><radialGradient id="b" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#5a0f24"/><stop offset="1" stop-color="#12030a"/></radialGradient></defs>' +
    '<rect width="512" height="512" rx="96" fill="url(#b)"/>' +
    '<rect x="18" y="18" width="476" height="476" rx="82" fill="none" stroke="#d4af37" stroke-width="10"/>' +
    '<image href="' + SYMBOL_URLS[8] + '" x="56" y="56" width="400" height="400"/></svg>';
}
