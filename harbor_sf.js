/* The Shadow Hook · harbor_sf.js (nov1i) — PORT PACK for the San Francisco Bay Area (ILWU Local 10, code "sf").
   Framed like the San Pedro Bay map: tight on the Port of Oakland (Outer Harbor · Middle Harbor · the Estuary),
   with the San Francisco waterfront — the hall, the cruise piers, Pier 70/80/92-96 — as an inset across the Bay,
   and the Bay outports Local 10 works (Richmond, Benicia, Redwood City) as edge arrows + list rows, the way
   LA/LB carries its satellite yards. Same 1000×814 stage and classes as index.html's map.
   Main frame: lon −122.345→0 · −122.255→1000, lat 37.830→0 (11111 px/° lon · 14065 px/° lat).
   Inset: x = 20 + (lon+122.43)·2647, y = 540 + (37.817−lat)·3351. ⚠ = confirm on the ground. */
(function () {
  "use strict";
  var P = (window.HARBOR_PACKS = window.HARBOR_PACKS || {});

  /* ---------- the list — same shape as the app's TERMINALS (data-op + data-berths tie the map to the list) ---------- */
  var TERMS = [
    /* 0-6 · the Port of Oakland */
    { berths: "OAK 55-59", operator: "SSA", aka: "OICT · Oakland International Container Terminal", security: "(510) 238-4400",
      gates: [{ gate: "West gate · 1999 Middle Harbor Rd", lat: 37.7986, lng: -122.3158, addr: "1999 Middle Harbor Rd, Oakland, CA 94607" },
              { gate: "East gate · 2505 Middle Harbor Rd (Berth 58)", lat: 37.7985, lng: -122.3060, addr: "2505 Middle Harbor Rd, Oakland, CA 94607" }] },
    { berths: "OAK 25-33", operator: "TraPac", aka: "TraPac Oakland", security: "(510) 286-8600",
      gates: [{ gate: "Main · 2800 7th St (Berth 30)", lat: 37.8053, lng: -122.3177, addr: "2800 7th St, Oakland, CA 94607" }] },
    { berths: "OAK 35-38", operator: "ETS", aka: "Everport · Ben E. Nutter Terminal", security: "(510) 208-8814",
      gates: [{ gate: "Main · 5190 7th St", lat: 37.8097, lng: -122.3238, addr: "5190 7th St, Oakland, CA 94607" }] },
    { berths: "OAK 60-63", operator: "SSA", aka: "Matson Terminal", security: "(510) 446-2403",
      gates: [{ gate: "Main · 1579 Middle Harbor Rd", lat: 37.7976, lng: -122.3080, addr: "1579 Middle Harbor Rd, Oakland, CA 94607" }] },
    { berths: "OAK 67-68", operator: "Matson", aka: "Charles P. Howard Terminal · Hawaii / Guam", security: "(510) 446-2400",
      gates: [{ gate: "Main · 1 Market St", lat: 37.7925, lng: -122.2850, addr: "1 Market St, Oakland, CA 94607" }] },
    { berths: "OAK 22-24", operator: "Port of Oakland", aka: "Outer Harbor Terminal · available / occasional", security: "",
      gates: [{ gate: "1599 Maritime St", lat: 37.8108, lng: -122.3252, addr: "1599 Maritime St, Oakland, CA 94607" }] },
    { berths: "OAK 32-34", operator: "Port of Oakland", aka: "Berths 32-34 · 3050 7th St", security: "",
      gates: [{ gate: "3050 7th St", lat: 37.8073, lng: -122.3200, addr: "3050 7th St, Oakland, CA 94607" }] },
    /* 7-10 · rail & logistics behind the berths (not longshore dispatch; on the map because the trucks and the box go there) */
    { berths: "OAK Rail · OIG", operator: "Union Pacific", aka: "Oakland Intermodal Gateway · UP ramp ⚠", security: "",
      gates: [{ gate: "Intermodal ramp", lat: 37.8085, lng: -122.3005, addr: "Oakland Intermodal Gateway, Oakland, CA 94607" }] },
    { berths: "OAK Rail · BNSF", operator: "BNSF", aka: "Oakland International Gateway · BNSF ramp ⚠", security: "",
      gates: [{ gate: "Intermodal ramp · Middle Harbor Rd", lat: 37.8015, lng: -122.3015, addr: "BNSF OIG, Middle Harbor Rd, Oakland, CA 94607" }] },
    { berths: "OAK Cool Port", operator: "Lineage · Dreisbach", aka: "Cool Port Oakland · reefer transload ⚠", security: "",
      gates: [{ gate: "Burma Rd", lat: 37.8135, lng: -122.3075, addr: "Cool Port Oakland, Burma Rd, Oakland, CA 94607" }] },
    { berths: "OAK Seaport Logistics", operator: "CenterPoint", aka: "Seaport Logistics Complex · old Army Base ⚠", security: "",
      gates: [{ gate: "Maritime St", lat: 37.8145, lng: -122.3115, addr: "Seaport Logistics Complex, Maritime St, Oakland, CA 94607" }] },
    /* 11-16 · San Francisco — the city side */
    { berths: "SF Pier 27", operator: "Port of SF", aka: "James R. Herman Cruise Terminal · passenger ships", security: "",
      gates: [{ gate: "Pier 27 · the Embarcadero at Lombard", lat: 37.8035, lng: -122.4005, addr: "Pier 27, San Francisco, CA 94111" }] },
    { berths: "SF Pier 35", operator: "Port of SF", aka: "Pier 35 · second cruise berth", security: "",
      gates: [{ gate: "Pier 35 · the Embarcadero", lat: 37.8065, lng: -122.4035, addr: "Pier 35, San Francisco, CA 94133" }] },
    { berths: "SF Pier 70", operator: "BAE · Puglia", aka: "Pier 70 shipyard · ship repair ⚠ (not longshore)", security: "",
      gates: [{ gate: "20th St at Illinois", lat: 37.7600, lng: -122.3830, addr: "Pier 70, San Francisco, CA 94107" }] },
    { berths: "SF Pier 80", operator: "Pasha", aka: "Pasha Automotive · autos / ro-ro / breakbulk", security: "",
      gates: [{ gate: "Pier 80 · Cesar Chavez St at the Bay", lat: 37.7503, lng: -122.3837, addr: "Pier 80, San Francisco, CA 94124" }] },
    { berths: "SF Pier 92", operator: "Port of SF", aka: "Pier 92 · cement / dry bulk ⚠", security: "",
      gates: [{ gate: "Pier 92 · Islais Creek", lat: 37.7475, lng: -122.3870, addr: "Pier 92, San Francisco, CA 94124" }] },
    { berths: "SF Pier 94-96", operator: "Port of SF", aka: "Pier 96 · bulk / on-dock rail", security: "",
      gates: [{ gate: "Pier 96 · Amador St", lat: 37.7420, lng: -122.3785, addr: "Pier 96, San Francisco, CA 94124" }] },
    /* 17-20 · around the Bay — Local 10 territory ⚠ confirm with the hall which of these it dispatches */
    { berths: "Richmond · PPMT", operator: "AWC · Honda", aka: "Point Potrero Marine Terminal · autos ⚠", security: "",
      gates: [{ gate: "Canal Blvd", lat: 37.9120, lng: -122.3720, addr: "Point Potrero Marine Terminal, Richmond, CA 94804" }] },
    { berths: "Richmond · Levin", operator: "Levin", aka: "Levin-Richmond Terminal · dry bulk ⚠", security: "",
      gates: [{ gate: "402 Wright Ave", lat: 37.9220, lng: -122.3740, addr: "402 Wright Ave, Richmond, CA 94804" }] },
    { berths: "Benicia · Amports", operator: "Amports", aka: "Benicia auto terminal ⚠", security: "",
      gates: [{ gate: "Bayshore Rd", lat: 38.0450, lng: -122.1350, addr: "Amports Benicia, Benicia, CA 94510" }] },
    { berths: "Redwood City", operator: "Port of Redwood City", aka: "Dry bulk · aggregates ⚠", security: "",
      gates: [{ gate: "Seaport Blvd", lat: 37.5100, lng: -122.2130, addr: "Port of Redwood City, Redwood City, CA 94063" }] },
    /* 21-27 · halls & offices */
    { berths: "Local 10 Hall", operator: "ILWU Local 10", aka: "Longshore dispatch hall · 400 North Point St, SF", security: "(415) 776-8100",
      gates: [{ gate: "Hall", lat: 37.8064, lng: -122.4185, addr: "400 North Point St, San Francisco, CA 94133" }] },
    { berths: "Local 34 Hall", operator: "ILWU Local 34", aka: "Marine clerks · 4 Berry St, SF", security: "(415) 362-8852",
      gates: [{ gate: "Hall", lat: 37.7765, lng: -122.3935, addr: "4 Berry St, San Francisco, CA 94107" }] },
    { berths: "Local 75 Hall", operator: "ILWU Local 75", aka: "Gatemen · watchmen · security · 4 Berry St, SF", security: "(415) 495-5702",
      gates: [{ gate: "Hall", lat: 37.7765, lng: -122.3935, addr: "4 Berry St, San Francisco, CA 94107" }] },
    { berths: "Local 91 Hall", operator: "ILWU Local 91", aka: "Walking bosses · foremen · 1851 Embarcadero, Oakland", security: "(510) 536-3795",
      gates: [{ gate: "Hall", lat: 37.7750, lng: -122.2460, addr: "1851 Embarcadero, Oakland, CA 94606" }] },
    { berths: "PMA Oakland", operator: "PMA", aka: "Northern California office", security: "(510) 452-1200",
      gates: [{ gate: "Office · Suite 300", lat: 37.8047, lng: -122.2707, addr: "475 14th St Ste 300, Oakland, CA 94612" }] },
    { berths: "PMA HQ", operator: "PMA", aka: "Pacific Maritime Association headquarters", security: "(415) 576-3200",
      gates: [{ gate: "Office · 3rd floor", lat: 37.7900, lng: -122.4000, addr: "555 Market St, San Francisco, CA 94105" }] },
    { berths: "ILWU International", operator: "ILWU", aka: "International · Coast Longshore Division", security: "(415) 775-0533",
      gates: [{ gate: "Office", lat: 37.7865, lng: -122.4225, addr: "1188 Franklin St, San Francisco, CA 94109" }] }
  ];

  function dock(i, cls, d, label) {
    var t = TERMS[i];
    return '<path class="hm-dock ' + cls + '" data-op="' + t.operator + '" data-berths="' + t.berths + '" data-i="' + i + '" d="' + d + '" tabindex="0" role="button" aria-label="' + label + ' — ' + t.berths + '"/>';
  }
  function lbl(i, cls, x, y, big, size, sub, subSize) {
    return '<g class="hm-lblg" data-i="' + i + '"><text class="hm-lbl ' + cls + '" x="' + x + '" y="' + y + '" font-size="' + size + '">' + big + "</text>" +
      (sub ? '<text class="hm-sub" x="' + x + '" y="' + (y + subSize + 3) + '" font-size="' + subSize + '">' + sub + "</text>" : "") + "</g>";
  }

  /* ---------- the map ----------
     One frame for the whole working Bay, both cities at true scale: lon −122.43→0 · −122.26→1000 (5882 px/° lon),
     lat 37.83→0 (7446 px/° lat). 1 mile = 108 px. Every dock sits on land; the San Francisco piers are drawn as the
     fingers of fill they are. Oakland's docks are big because Oakland's docks are big. */
  var SVG =
    '<defs><pattern id="hmGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="hm-grid"/></pattern>' +
    '<filter id="hmGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    '<rect class="hm-water" width="1000" height="814"/><rect width="1000" height="814" fill="url(#hmGrid)"/>' +

    /* SAN FRANCISCO — Aquatic Park to Hunters Point, the Embarcadero piers as fingers, Pier 70, Pier 80, Islais Creek, Pier 94-96 */
    '<path class="hm-land" d="M171.6 172.5 L163.3 175.4 L162.2 176.7 L163.4 178.5 L159 183 L158.4 181.8 L162.2 174.9 L162.6 171.2 L160.3 168.8 L157.5 169 L154.8 172.8 L155.2 165.4 L150.7 163.8 L146.5 172.6 L146.4 169.6 L144.7 170.3 L146.5 173.9 L144.9 177.6 L143.8 177.1 L141.5 155.8 L135.9 155.5 L133.7 157.4 L135.6 165.3 L134.6 167.2 L131.3 168.5 L127.2 164.5 L127.8 163.2 L123.8 160.4 L122.7 161.7 L120.3 156.9 L120.7 149.5 L117.2 146 L110.6 148.2 L100.2 156.1 L96.8 155.7 L94.6 158.3 L87.9 159.2 L85.1 156.9 L83.4 157.6 L78.9 153.6 L79.4 152.3 L72.5 146.6 L63.1 148.9 L61.4 150.8 L61.5 152.7 L68.9 159.6 L67.9 160.9 L69 163.3 L68 164.6 L64.6 164.7 L63 167.9 L60.6 161.9 L59.6 164.4 L53.9 159.8 L49.9 159.4 L50 162.5 L55.8 168.3 L56.4 171.9 L55.4 174.4 L47.7 182.2 L43.9 184.2 L40 184.4 L36.6 182.7 L34.3 179.8 L32.8 167 L34.9 162 L37.1 160.7 L41.6 161.7 L43.1 156.7 L40.9 155 L37.5 155.8 L36.4 154.6 L29.8 161.1 L27.7 165.5 L26.8 171.6 L21.7 171.9 L19 175.1 L-690.1 175.9 L-682 480.7 L25 482.5 L-681.9 484.3 L-674.8 751.9 L32.8 753 L37.2 752.2 L40.1 754.5 L42.3 753.7 L44.6 756.7 L42.4 758 L41.2 756.2 L38.5 757.6 L34.5 756 L-674.7 756.8 L-674.4 1362.8 L164.3 1355.8 L163.7 755.9 L161.9 752.9 L161.8 748.6 L158.4 745.1 L158.8 742 L156.5 740.3 L156.5 737.9 L158.1 736.6 L160.4 738.9 L161.1 743.2 L164 745.4 L163.4 747.3 L164.7 751.5 L168.8 1355.5 L394.9 1343.6 L393.2 744.3 L395.8 738.7 L394.1 736.9 L391.9 737 L389 733.5 L384.1 739.3 L377.3 735.4 L372.3 736.9 L368.9 734.6 L362.8 736.1 L359.9 734.4 L354.9 736.5 L351.5 731.8 L348.1 730.2 L339.4 721.5 L336.7 721.6 L328 733.1 L326.3 733.2 L323.5 730.3 L322.8 726.6 L323.9 725.3 L323.6 715 L321.9 712.6 L319.6 712.1 L323.8 702.1 L323.7 697.2 L325.4 696.5 L327.1 699.5 L328.2 698.8 L330.5 701.1 L338.9 701.3 L343.9 699.2 L345.6 699.7 L346.1 697.9 L351 695.2 L354.4 696.2 L355.5 694.9 L362.7 693.3 L364.9 690.8 L364.3 687.7 L363.1 686.6 L358.6 686.8 L355.7 682.7 L352.9 682.2 L360.2 680.6 L362.9 678 L362.8 674.4 L359.9 670.2 L360.4 668.4 L357.6 666.7 L358.1 664.8 L356.3 662.5 L355.2 663.1 L352.3 659.6 L352.9 658.4 L355.1 659.5 L352.9 658.4 L348.7 650.6 L346.5 649.5 L341.8 641.2 L334.3 632.4 L330.4 633.9 L327 633.4 L325.9 634.7 L324.1 626.9 L317.8 622.3 L322.2 621.5 L321 618.5 L323.2 615.9 L319.8 615.5 L318.1 613.7 L315.4 618.1 L316.1 620.6 L314.4 622.5 L309.9 621.5 L309.9 618.4 L312.1 617.1 L311.5 616.5 L280.9 621.2 L276.4 620.8 L277.5 619.5 L313.7 615.2 L314.7 612.1 L312.4 587.7 L311.2 585.9 L295.1 588 L293.3 585.7 L292.1 580.2 L289.8 580.4 L289.2 578.6 L287.6 579.9 L284.7 578.2 L283.7 579.5 L280.3 579 L278 576.7 L278.4 572.4 L277.2 569.4 L278.3 568.1 L290 566.3 L285.9 557.3 L286.3 532.8 L295.2 531.1 L296.8 528.6 L293.9 502.5 L292.2 501.3 L290.6 503.2 L292.3 525.2 L291.2 525.8 L289.4 520.4 L287 494.3 L285.2 491.9 L282.4 491.4 L279.2 494.7 L276.9 493.6 L275.4 499.8 L273.1 497.4 L270.8 497 L265.9 499.1 L264.9 505.2 L255.9 503.9 L255.8 500.8 L257.4 497.7 L256.7 491 L258.4 490.3 L257.8 488.5 L259.3 482.9 L261.4 480.3 L266.4 478.8 L266.3 473.3 L270.2 471.3 L270.6 465.8 L267.2 463.5 L265.2 455 L264.7 455.7 L262.9 452.1 L261.2 451.6 L255.1 431.1 L256.7 429.8 L264 428.8 L270.3 434.6 L276.5 437.3 L278.2 436.6 L282.7 438.2 L282.1 416.8 L269.8 416.9 L254.2 418.9 L253.1 417.8 L254.2 416.5 L261.4 414.9 L264.1 412.9 L263.4 405.6 L262.2 404.4 L252.2 405.6 L249.8 401.4 L237 403.3 L234.8 402.2 L236.9 399.7 L244.7 395.6 L243.6 398.1 L239.7 400.1 L240.3 400.7 L249.8 399.6 L253.3 403.7 L258.8 403.4 L259.9 402.1 L258.1 397.9 L258 392.4 L249.1 394.1 L246.9 396.1 L244.7 395.6 L248.5 392.9 L246.2 390.6 L251.8 389.7 L248.9 388 L247.9 369.1 L258.4 366.7 L259.5 364.2 L257.7 361.2 L259.4 359.9 L263.3 359.7 L263.1 354.8 L262 353.7 L255.3 354 L254 347.4 L248.4 346.5 L258.9 342.8 L258.2 338.6 L253.2 338.9 L252.1 337.7 L263.7 335.2 L264.8 333.3 L264.5 323 L263.3 320.6 L252.7 319.9 L258.8 317.2 L259.8 315.3 L258.6 311.7 L251.9 312 L259.1 307.3 L258.4 303.1 L253.9 302.7 L247.8 305.5 L245 302.6 L243.3 302.7 L243.7 296.5 L239.8 296.1 L226.5 279.7 L223.1 277.5 L221.1 267.8 L226 262.6 L225.9 259.6 L223 256 L218.6 256.9 L216.8 252.7 L214 252.9 L214.5 249.8 L216.7 247.2 L212.5 237 L209.1 234.8 L204.6 235 L200.2 238.3 L199.2 240.8 L196.9 239.1 L204.5 233.2 L206.7 230 L206.6 227.6 L204.9 225.2 L201 226 L200.8 218.7 L196.9 217.7 L197.4 215.8 L194.4 208.6 L194 214.2 L192.9 214.2 L192.7 207.5 L189.3 205.8 L189.7 200.9 L185.1 195.7 L180 194.7 L173 203 L171.3 202.5 L173 181 Z"/>' +
    /* Alcatraz · Treasure Island · Yerba Buena */
    '<path class="hm-land hm-islet" d="M34 20 L48 18 L54 26 L46 34 L34 30 Z"/>' +
    '<path class="hm-land hm-islet" d="M320 20.5 L321.2 98.5 L326.4 107.4 L326.7 116 L323.8 133.3 L318.8 137.2 L321.3 143.8 L320.7 145.1 L324.1 146.7 L325.9 150.9 L326.5 150.3 L333.9 156 L339 157.5 L341.3 161.1 L349.7 161.3 L352.6 165.4 L362 163.7 L364.3 165.4 L367.6 164 L373.8 164.3 L376.1 167.2 L381.7 167.5 L385.9 157.5 L386.4 153.2 L384.2 135 L386.2 124.5 L396.5 113.5 L397.5 110.4 L396.8 104.9 L395.1 103.2 L390.6 102.8 L374 110.4 L365.7 110.9 L358.6 118.6 L359.2 119.2 L350.4 125.1 L340.8 121.4 L341.3 120.7 L337.3 116.6 L336.8 117.3 L335 114.3 L331.9 101 L332.9 99.8 L342.3 19.3 Z"/>' +
    /* OAKLAND — the port peninsula (Outer Harbor face west, the Middle Harbor cove, the south face on the Estuary), the city, the old Army Base at the touchdown */
    '<path class="hm-land" d="M706 0 L1000 0 L1000 306 L960 302 L900 276 L880 270 L830 270 L814 260 L758 258 L640 253 L637 208 L580 208 L572 214 L554 212 L550 170 L552 94 L600 88 L630 58 L668 40 Z"/>' +
    /* Middle Harbor Shoreline Park — the arm of fill that closes the cove */
    '<path class="hm-land hm-islet" d="M554 220 L572 222 L592 242 L636 258 L632 266 L594 262 L560 246 Z"/>' +
    /* ALAMEDA — Alameda Point west, the island running east under the Estuary */
    '<path class="hm-land" d="M558 298 L600 292 L700 290 L800 292 L900 300 L1000 330 L1000 620 L900 600 L800 560 L700 530 L640 500 L600 470 L580 430 L566 380 L556 330 Z"/>' +

    /* Bay Bridge: SF anchorage → Yerba Buena → the Oakland touchdown */
    '<line class="hm-bridge" x1="244" y1="320" x2="362" y2="176"/><line class="hm-bridge" x1="416" y1="146" x2="676" y2="67"/>' +
    '<text class="hm-b" x="312" y="236" font-size="10" transform="rotate(-50 312 236)">BAY BRIDGE</text>' +
    '<text class="hm-b" x="540" y="100" font-size="10" transform="rotate(-17 540 100)">BAY BRIDGE · EAST SPAN</text>' +

    /* ---- landmarks ---- */
    '<g class="hm-lm" aria-hidden="true">' +
    /* the east-span tower */
    '<path class="lk lk-a" d="M596 118 L600 86 M608 116 L604 84 M596 102 L608 100 M600 86 L604 84"/><path class="lk lk-a lk-thin" d="M530 140 Q570 96 602 84 Q636 90 664 72"/>' +
    /* Ferry Building clock tower · Transamerica · Salesforce */
    '<path class="lk lk-a" d="M204 258 L204 240 L212 240 L212 258 M208 240 L208 234"/>' +
    '<path class="lk lk-a" d="M156 262 L162 232 L168 262 Z"/>' +
    '<path class="lk lk-a" d="M190 300 L192 270 L198 270 L200 300 Z"/>' +
    /* cranes: Everport · TraPac · OICT · Matson */
    '<path class="lk lk-a" d="M596 172 L596 158 L608 158 L608 172 M592 158 L616 154 M596 165 L608 165"/>' +
    '<path class="lk lk-a" d="M660 190 L660 176 L672 176 L672 190 M656 176 L680 172 M660 183 L672 183"/>' +
    '<path class="lk lk-a" d="M658 226 L658 212 L670 212 L670 226 M654 212 L678 208 M658 219 L670 219"/>' +
    '<path class="lk lk-a" d="M780 222 L780 210 L792 210 L792 222 M776 210 L800 206 M780 216 L792 216"/>' +
    /* a box ship on OICT · the Hornet at Alameda Point · a car ship at Pier 80 */
    '<path class="lk lk-w" d="M664 266 L744 266 L752 271 L744 276 L664 276 L658 271 Z"/><path class="lk lk-a lk-thin" d="M672 266 L672 261 L734 261 L734 266"/>' +
    '<path class="lk lk-w" d="M590 300 L660 298 L666 302 L660 306 L590 308 Z"/><path class="lk lk-a lk-thin" d="M626 300 L626 294 L634 294 L634 300"/>' +
    '<path class="lk lk-w" d="M330 560 L360 560 L364 565 L360 570 L330 570 Z"/>' +
    "</g>" +

    /* ---- the docks (Oakland = LA palette · San Francisco = LB palette), every one on land ---- */
    dock(5, "hm-LA", "M562 100 L604 96 L606 128 L564 130 Z", "Outer Harbor Terminal") +
    dock(6, "hm-LA", "M564 132 L606 130 L606 160 L566 162 Z", "Berths 32-34") +
    dock(2, "hm-LA", "M566 164 L616 162 L618 198 L578 200 L574 208 L562 206 L560 170 Z", "Everport · Ben E. Nutter") +
    dock(1, "hm-LA", "M620 158 L700 158 L700 198 L642 200 L620 198 Z", "TraPac") +
    dock(0, "hm-LA", "M644 202 L756 202 L758 252 L644 246 Z", "SSA OICT") +
    dock(3, "hm-LA", "M760 206 L814 206 L814 254 L760 252 Z", "SSA Matson Terminal") +
    dock(4, "hm-LA", "M830 222 L880 222 L880 264 L830 264 Z", "Matson Howard Terminal") +
    dock(8, "hm-LA", "M704 150 L756 150 L756 200 L704 200 Z", "BNSF Oakland International Gateway") +
    dock(7, "hm-LA", "M760 150 L816 150 L816 202 L760 202 Z", "Union Pacific OIG") +
    dock(9, "hm-LA", "M704 102 L762 102 L762 146 L704 146 Z", "Cool Port Oakland") +
    dock(10, "hm-LA", "M632 68 L700 66 L700 100 L632 104 Z", "Seaport Logistics Complex") +
    dock(25, "hm-LA", "M930 180 L946 180 L946 196 L930 196 Z", "PMA Northern California") +
    dock(12, "hm-LB", "M170.9 172.4 L163.6 175.7 L162 176.4 L155 172.7 L149.5 166 L151.1 164.1 L154.3 164.6 Z", "Pier 35 cruise") +
    dock(11, "hm-LB", "M179.6 193.8 L172 186.2 L168 173.7 L171.7 173 L172.2 174.1 Z", "Pier 27 cruise terminal") +
    dock(13, "hm-LB", "M267.3 496.7 L297.6 496.7 L300.1 524.9 L267.3 524.9 Z", "Pier 70 shipyard") +
    dock(14, "hm-LB", "M276.8 573.6 L315.8 573.6 L317.3 601.1 L279.4 606.2 Z", "Pasha Pier 80") +
    dock(15, "hm-LB", "M247.8 639.3 L274.5 639.3 L274.5 650.4 L247.8 650.4 Z", "Pier 92") +
    dock(16, "hm-LB", "M288.2 640.5 L311.9 640.5 L335.7 660.5 L340.6 675.6 L288.2 668 Z", "Pier 94-96") +
    dock(21, "hm-LB", "M60.6 173.2 L74.6 173.2 L74.6 187.2 L60.6 187.2 Z", "ILWU Local 10 hall") +
    dock(22, "hm-LB", "M207.7 391.4 L221.7 391.4 L221.7 405.4 L207.7 405.4 Z", "Local 34 · Local 75 hall") +
    dock(26, "hm-LB", "M175.3 290.8 L189.3 290.8 L189.3 304.8 L175.3 304.8 Z", "PMA headquarters") +
    dock(27, "hm-LB", "M37.1 316.9 L51.1 316.9 L51.1 330.9 L37.1 330.9 Z", "ILWU International") +

    /* ---- labels ---- */
    lbl(5, "hm-lbl-LA", 584, 118, "OHT", 13, "22-24", 7) +
    lbl(6, "hm-lbl-LA", 585, 150, "32-34", 11, "", 0) +
    lbl(2, "hm-lbl-LA", 580, 186, "ETS", 15, "35-38", 7) +
    lbl(1, "hm-lbl-LA", 646, 180, "TraPac", 15, "25-33", 7) +
    lbl(0, "hm-lbl-LA", 712, 228, "SSA", 20, "OICT 55-59", 9) +
    lbl(3, "hm-lbl-LA", 787, 230, "SSA", 14, "MATSON 60-63", 7) +
    lbl(4, "hm-lbl-LA", 855, 244, "Matson", 12, "HOWARD 67-68", 7) +
    lbl(8, "hm-lbl-LA", 730, 176, "BNSF", 11, "OIG RAIL", 7) +
    lbl(7, "hm-lbl-LA", 788, 176, "UP", 11, "OIG RAIL", 7) +
    lbl(9, "hm-lbl-LA", 733, 124, "Cool Port", 11, "REEFER", 7) +
    lbl(10, "hm-lbl-LA", 666, 84, "Seaport Logistics", 10, "OLD ARMY BASE", 7) +
    lbl(25, "hm-lbl-LA", 938, 174, "PMA", 10, "", 0) +
    lbl(12, "hm-lbl-LB", 180, 150, "Pier 35", 10, "", 0) +
    lbl(11, "hm-lbl-LB", 222, 186, "Pier 27", 11, "CRUISE", 7) +
    lbl(13, "hm-lbl-LB", 342, 508, "Pier 70", 12, "SHIPYARD", 7) +
    lbl(14, "hm-lbl-LB", 356, 588, "Pasha", 13, "PIER 80", 8) +
    lbl(15, "hm-lbl-LB", 236, 660, "Pier 92", 8, "", 0) +
    lbl(16, "hm-lbl-LB", 392, 668, "Pier 96", 12, "BULK · RAIL", 7) +
    lbl(21, "hm-lbl-LB", 69, 196, "LOCAL 10", 10, "", 0) +
    lbl(22, "hm-lbl-LB", 204, 400, "34 · 75", 9, "", 0) +
    lbl(26, "hm-lbl-LB", 196, 324, "PMA", 9, "", 0) +
    lbl(27, "hm-lbl-LB", 26, 296, "ILWU", 9, "", 0) +

    /* places and water */
    '<text class="hm-place" x="60" y="560" font-size="22" transform="rotate(-90 60 560)">SAN FRANCISCO</text>' +
    '<text class="hm-place" x="860" y="120" font-size="22">OAKLAND</text>' +
    '<text class="hm-place" x="820" y="440" font-size="22">ALAMEDA</text>' +
    '<text class="hm-place" x="610" y="340" font-size="10">ALAMEDA POINT</text>' +
    '<text class="hm-place" x="353" y="48" font-size="10">TREASURE IS.</text>' +
    '<text class="hm-place" x="150" y="520" font-size="11">POTRERO</text><text class="hm-place" x="70" y="140" font-size="8">FISHERMAN’S WHARF</text><text class="hm-place" x="220" y="380" font-size="7">ORACLE PARK</text>' +
    '<text class="hm-place" x="370" y="800" font-size="11">HUNTERS POINT</text><text class="hm-w" x="336" y="738" font-size="8">INDIA BASIN</text><text class="hm-w" x="382" y="706" font-size="7">HERON’S HEAD</text><text class="hm-w" x="262" y="402" font-size="6" transform="rotate(-40 262 402)">McCOVEY COVE</text>' +
    '<text class="hm-place" x="920" y="280" font-size="9">JACK LONDON SQ</text>' +
    '<text class="hm-place" x="190" y="300" font-size="9" transform="rotate(-62 190 330)">EMBARCADERO</text>' +
    '<text class="hm-w" x="440" y="520" font-size="18" transform="rotate(-62 440 520)">SAN FRANCISCO BAY</text>' +
    '<text class="hm-w" x="500" y="140" font-size="10">OUTER HARBOR</text>' +
    '<text class="hm-w" x="604" y="236" font-size="7">MIDDLE HARBOR</text>' +
    '<text class="hm-w" x="800" y="288" font-size="9">INNER HARBOR · THE ESTUARY</text>' +
    '<text class="hm-w" x="292" y="547" font-size="7">CENTRAL BASIN</text>' +
    '<text class="hm-w" x="244" y="634" font-size="6">ISLAIS CREEK</text>' +
    '<text class="hm-w" x="382" y="200" font-size="8">YERBA BUENA</text>' +
    '<text class="hm-w" x="42" y="46" font-size="7">ALCATRAZ</text>' +
    '<text class="hm-w" x="630" y="316" font-size="7">USS HORNET</text>' +
    '<text class="hm-b hm-lmt" x="560" y="22" font-size="9">↑ RICHMOND 8 MI · BENICIA 25 MI</text>' +
    '<text class="hm-b hm-lmt" x="930" y="800" font-size="9">↓ REDWOOD CITY 24 MI</text>' +
    '<text class="hm-b hm-lmt" x="940" y="340" font-size="8">LOCAL 91 → 1851 EMBARCADERO</text>' +

    /* the port chips (tap for the story) */
    '<g class="hm-port hm-port-LA" data-port="OAK" tabindex="0" role="button" aria-label="Port of Oakland — the story"><rect x="730" y="30" width="190" height="30" rx="7"/><text x="825" y="51" font-size="17" text-anchor="middle">PORT OF OAKLAND</text></g>' +
    '<g class="hm-port hm-port-LB" data-port="SF" tabindex="0" role="button" aria-label="Port of San Francisco — the story"><rect x="30" y="700" width="226" height="30" rx="7"/><text x="143" y="721" font-size="17" text-anchor="middle">PORT OF SAN FRANCISCO</text></g>' +

    '<g class="hm-compass" transform="translate(958 44)"><circle r="16"/><path d="M0 -13 L5 0 L0 -4 L-5 0 Z"/><text y="-20" font-size="9" text-anchor="middle">N</text></g>' +
    '<g class="hm-scale" transform="translate(420 790)"><line x1="0" y1="0" x2="108" y2="0"/><line x1="0" y1="-4" x2="0" y2="4"/><line x1="108" y1="-4" x2="108" y2="4"/><text x="54" y="-6" font-size="10" text-anchor="middle">1 MILE</text></g>';

  P.sf = {
    code: "sf",
    short: "SF/OAK",
    title: "San Francisco Bay",
    src: "◆ SF / OAKLAND",
    aria: "Port of Oakland — Outer Harbor, Middle Harbor and the Estuary, with the San Francisco waterfront across the Bay",
    hint: "Container work is at Oakland; the hall is in San Francisco",
    svg: SVG,
    terminals: TERMS,
    groups: [["OH", "Outer Harbor"], ["IH", "Inner Harbor · the Estuary"], ["RL", "Rail & logistics"], ["SF", "San Francisco piers"], ["BY", "Around the Bay"], ["YD", "Halls & offices"]],
    groupOf: function (t) {
      var b = String(t.berths || "");
      if (/^OAK (2|3)\d/.test(b)) return "OH";
      if (/^OAK (5|6)\d/.test(b)) return "IH";
      if (/^OAK /.test(b)) return "RL";
      if (/^SF /.test(b)) return "SF";
      if (/^(Richmond|Benicia|Redwood)/.test(b)) return "BY";
      return "YD";
    },
    legend: [["hm-la", "hm-la-line", "Port of Oakland"], ["hm-lb", "hm-lb-line", "Port of San Francisco"]],
    lore: {
      ports: {
        OAK: { name: "Port of Oakland", kicker: "Outer Harbor · Middle Harbor · the Estuary", text: [
          "The Oakland Long Wharf reached two miles into the Bay in 1871 as the western end of the transcontinental railroad; the modern Port came in 1927, when the city took the waterfront back from the Southern Pacific after fifty years in court.",
          "Oakland was the first major container port on the West Coast. Matson’s Hawaiian Citizen worked here in 1962, and by the end of the decade the Outer Harbor had been rebuilt around the box; the Army Base and the Navy Supply Center next door became terminals and logistics yards when they closed in the 1990s.",
          "The 1934 strike was fought on these docks too: Bloody Thursday in San Francisco on July 5, 1934 killed Howard Sperry and Nick Bordoise and brought the Bay Area to a general strike. Local 10 came out of that summer. Middle Harbor Shoreline Park sits on the old Navy piers."
        ] },
        SF: { name: "Port of San Francisco", kicker: "The Embarcadero · China Basin · the southern piers", text: [
          "The finger piers along the Embarcadero were the whole Pacific trade for a century: the Ferry Building opened in 1898, the seawall and the numbered piers followed, and the longshore gangs worked out of the hiring shapes on the waterfront until 1934 put the hall in the union’s hands.",
          "The box left the city for Oakland in the 1960s — San Francisco had no room behind the piers for yards or rail. What stayed moved south: Pier 80 for cars and breakbulk, Pier 92 and 94-96 for bulk and the on-dock rail at Islais Creek. The cruise ships come to Pier 27.",
          "Local 10’s hall is at 400 North Point Street, four blocks from Fisherman’s Wharf, with Harry Bridges’ old Local behind the name. The dispatch is still in the city; the work is across the bridge."
        ] }
      },
      docks: {
        "SSA|OAK 55-59": "OICT — the biggest terminal in the Bay, berths 55 through 59 on the Inner Harbor; two gates on Middle Harbor Road. ⚠ confirm which gate casuals report to.",
        "TraPac|OAK 25-33": "TraPac Oakland on the Outer Harbor, main gate at 2800 7th Street by Berth 30.",
        "ETS|OAK 35-38": "Everport’s Ben E. Nutter Terminal at the corner where the Outer Harbor meets the channel.",
        "SSA|OAK 60-63": "Matson’s Oakland terminal, run by SSA, east of OICT on Middle Harbor Road.",
        "Matson|OAK 67-68": "Howard Terminal at Jack London Square — Matson’s Hawaii and Guam service. The ballpark plan came and went; the terminal stayed.",
        "Port of Oakland|OAK 22-24": "The Outer Harbor Terminal — the old Ports America berths, available for occasional calls. ⚠ check whether it is working before you count on it.",
        "Port of Oakland|OAK 32-34": "Berths 32-34 at 3050 7th Street, between TraPac and Everport.",
        "Union Pacific|OAK Rail · OIG": "The UP intermodal ramp behind the berths. Rail, not a dispatch — on the map because the boxes go there.",
        "BNSF|OAK Rail · BNSF": "BNSF’s Oakland International Gateway on Middle Harbor Road, next to the Joint Intermodal Terminal.",
        "Lineage · Dreisbach|OAK Cool Port": "Cool Port Oakland — the refrigerated transload warehouse on the old Army Base. ⚠ not longshore dispatch.",
        "CenterPoint|OAK Seaport Logistics": "The Seaport Logistics Complex on the old Oakland Army Base — warehouses and truck parking behind the Outer Harbor.",
        "Port of SF|SF Pier 27": "The James R. Herman Cruise Terminal, named for the Local 10 president who became ILWU International president. Passenger ships; Local 10 works the lines and the baggage. ⚠ confirm the dispatch.",
        "Port of SF|SF Pier 35": "Pier 35, the second cruise berth, used when two ships are in.",
        "BAE · Puglia|SF Pier 70": "The Pier 70 drydocks — ship repair since 1885. ⚠ shipyard trades, not longshore; listed so a docket that says Pier 70 is not a mystery.",
        "Pasha|SF Pier 80": "Pasha’s auto and breakbulk pier at the foot of Cesar Chavez — the last working cargo pier on the city side.",
        "Port of SF|SF Pier 92": "Pier 92 on the north side of Islais Creek — cement and dry bulk. ⚠ confirm the operator.",
        "Port of SF|SF Pier 94-96": "Pier 96 on Islais Creek: bulk cargo and the only on-dock rail in San Francisco.",
        "AWC · Honda|Richmond · PPMT": "Point Potrero Marine Terminal in Richmond — the auto port of the North Bay. ⚠ Local 10 territory, confirm with the hall.",
        "Levin|Richmond · Levin": "Levin-Richmond Terminal — dry bulk on the Santa Fe Channel. ⚠ confirm.",
        "Amports|Benicia · Amports": "Amports Benicia — autos off the ships up the Carquinez Strait. ⚠ Local 10 territory, confirm.",
        "Port of Redwood City|Redwood City": "The South Bay’s deep-water port — aggregates and dry bulk. ⚠ confirm.",
        "ILWU Local 10|Local 10 Hall": "400 North Point Street. Dispatch tape (415) 775-8803 — ⚠ 2016 listing, confirm. Records (415) 776-5882 · BA (415) 776-8105 ⚠.",
        "ILWU Local 34|Local 34 Hall": "The marine clerks’ hall, 4 Berry Street, south of the ballpark.",
        "ILWU Local 75|Local 75 Hall": "Gatemen, watchmen and security — same building as Local 34.",
        "ILWU Local 91|Local 91 Hall": "Walking bosses and foremen, 1851 Embarcadero, Oakland, up the Estuary past Jack London.",
        "PMA|PMA Oakland": "PMA Northern California, 475 14th Street, Suite 300, Oakland. Payroll is coastwise: 1-888-762-1234.",
        "PMA|PMA HQ": "PMA headquarters, 555 Market Street, 3rd floor — the employers’ side of the coastwise contract.",
        "ILWU|ILWU International": "1188 Franklin Street — the International and the Coast Longshore Division. (415) 775-0533."
      }
    }
  };
})();
