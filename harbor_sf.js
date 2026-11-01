/* The Shadow Hook · harbor_sf.js (nov1h) — PORT PACK for the San Francisco Bay Area (ILWU Local 10, code "sf").
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

  var SVG_OAK =
    '<defs><pattern id="hmGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="hm-grid"/></pattern></defs><rect class="hm-water" width="1000" height="814"/><rect width="1000" height="814" fill="url(#hmGrid)"/><path class="hm-land" d="M 449.6 0 L 1005 0 L 1005 578 L 929.4 570.5 L 816.1 521.4 L 778.3 510 L 683.9 510 L 653.6 491.1 L 547.9 487.4 L 325 477.9 L 319.3 392.9 L 211.6 392.9 L 196.5 404.2 L 162.5 400.5 L 155 321.1 L 158.7 177.6 L 249.4 166.2 L 306.1 109.6 L 377.9 75.6 Z"/><path class="hm-land hm-islet" d="M 162.5 415.6 L 196.5 419.4 L 234.3 457.1 L 317.4 487.4 L 309.8 502.5 L 238.1 494.9 L 173.8 464.7 Z"/><path class="hm-land" d="M 170.1 562.9 L 249.4 551.6 L 438.3 547.8 L 627.2 551.6 L 816.1 566.7 L 1005 623.4 L 1005 1171.2 L 816.1 1133.4 L 627.2 1057.8 L 438.3 1001.2 L 325 944.5 L 249.4 887.8 L 211.6 812.3 L 185.2 717.8 L 166.3 623.4 Z"/><line class="hm-bridge" x1="-98.2" y1="275.8" x2="393" y2="126.6"/><text class="hm-b" x="136.1" y="188.9" font-size="14.5" transform="rotate(-17 136.1 188.9)">BAY BRIDGE · EAST SPAN</text><g class="hm-lm" aria-hidden="true"><path class="lk lk-a" d="M 241.8 222.9 L 249.4 162.5 M 264.5 219.1 L 257 158.7 M 241.8 192.7 L 264.5 188.9 M 249.4 162.5 L 257 158.7"/><path class="lk lk-a lk-thin" d="M 117.2 264.5 Q 192.7 181.3 253.2 158.7 Q 317.4 170 370.3 136"/><path class="lk lk-a" d="M -498.6 487.4 L -498.6 453.4 L -483.5 453.4 L -483.5 487.4 M -491.1 453.4 L -491.1 442"/><path class="lk lk-a" d="M -589.3 494.9 L -578 438.2 L -566.6 494.9 Z"/><path class="lk lk-a" d="M -525.1 566.7 L -521.3 510 L -510 510 L -506.2 566.7 Z"/><path class="lk lk-a" d="M 241.8 324.9 L 241.8 298.5 L 264.5 298.5 L 264.5 324.9 M 234.3 298.5 L 279.6 290.9 M 241.8 311.7 L 264.5 311.7"/><path class="lk lk-a" d="M 362.7 358.9 L 362.7 332.5 L 385.4 332.5 L 385.4 358.9 M 355.2 332.5 L 400.5 324.9 M 362.7 345.7 L 385.4 345.7"/><path class="lk lk-a" d="M 359 426.9 L 359 400.5 L 381.6 400.5 L 381.6 426.9 M 351.4 400.5 L 396.7 392.9 M 359 413.7 L 381.6 413.7"/><path class="lk lk-a" d="M 589.4 419.4 L 589.4 396.7 L 612.1 396.7 L 612.1 419.4 M 581.9 396.7 L 627.2 389.1 M 589.4 408 L 612.1 408"/><path class="lk lk-w" d="M 370.3 502.5 L 521.4 502.5 L 536.5 511.9 L 521.4 521.4 L 370.3 521.4 L 359 511.9 Z"/><path class="lk lk-a lk-thin" d="M 385.4 502.5 L 385.4 493 L 502.5 493 L 502.5 502.5"/><path class="lk lk-w" d="M 230.5 566.7 L 362.7 562.9 L 374.1 570.5 L 362.7 578 L 230.5 581.8 Z"/><path class="lk lk-a lk-thin" d="M 298.5 566.7 L 298.5 555.4 L 313.6 555.4 L 313.6 566.7"/><path class="lk lk-w" d="M -260.6 1057.8 L -204 1057.8 L -196.4 1067.3 L -204 1076.7 L -260.6 1076.7 Z"/></g><path class="hm-dock hm-LA" data-op="Port of Oakland" data-berths="OAK 22-24" data-i="5" d="M 177.6 188.9 L 257 181.3 L 260.7 241.8 L 181.4 245.6 Z" tabindex="0" role="button" aria-label="Outer Harbor Terminal — OAK 22-24"/><path class="hm-dock hm-LA" data-op="Port of Oakland" data-berths="OAK 32-34" data-i="6" d="M 181.4 249.3 L 260.7 245.6 L 260.7 302.2 L 185.2 306 Z" tabindex="0" role="button" aria-label="Berths 32-34 — OAK 32-34"/><path class="hm-dock hm-LA" data-op="ETS" data-berths="OAK 35-38" data-i="2" d="M 185.2 309.8 L 279.6 306 L 283.4 374 L 207.8 377.8 L 200.3 392.9 L 177.6 389.1 L 173.8 321.1 Z" tabindex="0" role="button" aria-label="Everport · Ben E. Nutter — OAK 35-38"/><path class="hm-dock hm-LA" data-op="TraPac" data-berths="OAK 25-33" data-i="1" d="M 287.2 298.5 L 438.3 298.5 L 438.3 374 L 328.7 377.8 L 287.2 374 Z" tabindex="0" role="button" aria-label="TraPac — OAK 25-33"/><path class="hm-dock hm-LA" data-op="SSA" data-berths="OAK 55-59" data-i="0" d="M 332.5 381.6 L 544.1 381.6 L 547.9 476 L 332.5 464.7 Z" tabindex="0" role="button" aria-label="SSA OICT — OAK 55-59"/><path class="hm-dock hm-LA" data-op="SSA" data-berths="OAK 60-63" data-i="3" d="M 551.6 389.1 L 653.6 389.1 L 653.6 479.8 L 551.6 476 Z" tabindex="0" role="button" aria-label="SSA Matson Terminal — OAK 60-63"/><path class="hm-dock hm-LA" data-op="Matson" data-berths="OAK 67-68" data-i="4" d="M 683.9 419.4 L 778.3 419.4 L 778.3 498.7 L 683.9 498.7 Z" tabindex="0" role="button" aria-label="Matson Howard Terminal — OAK 67-68"/><path class="hm-dock hm-LA" data-op="BNSF" data-berths="OAK Rail · BNSF" data-i="8" d="M 445.9 283.4 L 544.1 283.4 L 544.1 377.8 L 445.9 377.8 Z" tabindex="0" role="button" aria-label="BNSF Oakland International Gateway — OAK Rail · BNSF"/><path class="hm-dock hm-LA" data-op="Union Pacific" data-berths="OAK Rail · OIG" data-i="7" d="M 551.6 283.4 L 657.4 283.4 L 657.4 381.6 L 551.6 381.6 Z" tabindex="0" role="button" aria-label="Union Pacific OIG — OAK Rail · OIG"/><path class="hm-dock hm-LA" data-op="Lineage · Dreisbach" data-berths="OAK Cool Port" data-i="9" d="M 445.9 192.7 L 555.4 192.7 L 555.4 275.8 L 445.9 275.8 Z" tabindex="0" role="button" aria-label="Cool Port Oakland — OAK Cool Port"/><path class="hm-dock hm-LA" data-op="CenterPoint" data-berths="OAK Seaport Logistics" data-i="10" d="M 309.8 128.5 L 438.3 124.7 L 438.3 188.9 L 309.8 196.5 Z" tabindex="0" role="button" aria-label="Seaport Logistics Complex — OAK Seaport Logistics"/><path class="hm-dock hm-LA" data-op="PMA" data-berths="PMA Oakland" data-i="25" d="M 872.8 340 L 903 340 L 903 370.2 L 872.8 370.2 Z" tabindex="0" role="button" aria-label="PMA Northern California — PMA Oakland"/><g class="hm-lblg" data-i="5"><text class="hm-lbl hm-lbl-LA" x="219.2" y="222.9" font-size="18.85">OHT</text><text class="hm-sub" x="219.2" y="241.8" font-size="10.15">22-24</text></g><g class="hm-lblg" data-i="6"><text class="hm-lbl hm-lbl-LA" x="221.1" y="283.4" font-size="15.95">32-34</text></g><g class="hm-lblg" data-i="2"><text class="hm-lbl hm-lbl-LA" x="211.6" y="351.4" font-size="21.75">ETS</text><text class="hm-sub" x="211.6" y="370.2" font-size="10.15">35-38</text></g><g class="hm-lblg" data-i="1"><text class="hm-lbl hm-lbl-LA" x="336.3" y="340" font-size="21.75">TraPac</text><text class="hm-sub" x="336.3" y="358.9" font-size="10.15">25-33</text></g><g class="hm-lblg" data-i="0"><text class="hm-lbl hm-lbl-LA" x="461" y="430.7" font-size="26">SSA</text><text class="hm-sub" x="461" y="453.4" font-size="13.05">OICT 55-59</text></g><g class="hm-lblg" data-i="3"><text class="hm-lbl hm-lbl-LA" x="602.6" y="434.5" font-size="20.3">SSA</text><text class="hm-sub" x="602.6" y="453.4" font-size="10.15">MATSON 60-63</text></g><g class="hm-lblg" data-i="4"><text class="hm-lbl hm-lbl-LA" x="731.1" y="460.9" font-size="17.4">Matson</text><text class="hm-sub" x="731.1" y="479.8" font-size="10.15">HOWARD 67-68</text></g><g class="hm-lblg" data-i="8"><text class="hm-lbl hm-lbl-LA" x="495" y="332.5" font-size="15.95">BNSF</text><text class="hm-sub" x="495" y="351.4" font-size="10.15">OIG RAIL</text></g><g class="hm-lblg" data-i="7"><text class="hm-lbl hm-lbl-LA" x="604.5" y="332.5" font-size="15.95">UP</text><text class="hm-sub" x="604.5" y="351.4" font-size="10.15">OIG RAIL</text></g><g class="hm-lblg" data-i="9"><text class="hm-lbl hm-lbl-LA" x="500.6" y="234.2" font-size="15.95">Cool Port</text><text class="hm-sub" x="500.6" y="253.1" font-size="10.15">REEFER</text></g><g class="hm-lblg" data-i="10"><text class="hm-lbl hm-lbl-LA" x="374.1" y="158.7" font-size="14.5">Seaport Logistics</text><text class="hm-sub" x="374.1" y="177.6" font-size="10.15">OLD ARMY BASE</text></g><g class="hm-lblg" data-i="25"><text class="hm-lbl hm-lbl-LA" x="887.9" y="328.7" font-size="14.5">PMA</text></g><text class="hm-place" x="740.5" y="226.7" font-size="26">OAKLAND</text><text class="hm-place" x="760" y="760" font-size="26">ALAMEDA</text><text class="hm-place" x="268.3" y="642.3" font-size="14.5">ALAMEDA POINT</text><text class="hm-place" x="853.9" y="528.9" font-size="13.05">JACK LONDON SQ</text><text class="hm-w" x="60.5" y="264.5" font-size="14.5">OUTER HARBOR</text><text class="hm-w" x="257" y="445.8" font-size="10.15">MIDDLE HARBOR</text><text class="hm-w" x="627.2" y="544" font-size="13.05">INNER HARBOR · THE ESTUARY</text><text class="hm-w" x="306.1" y="596.9" font-size="10.15">USS HORNET</text><text class="hm-b hm-lmt" x="173.8" y="41.6" font-size="13.05">↑ RICHMOND 8 MI · BENICIA 25 MI · ← SAN FRANCISCO ACROSS THE BAY</text><text class="hm-b hm-lmt" x="872.8" y="1511.2" font-size="13.05">↓ REDWOOD CITY 24 MI</text><text class="hm-b hm-lmt" x="891.7" y="642.3" font-size="11.6">LOCAL 91 → 1851 EMBARCADERO</text><g class="hm-port hm-port-LA" data-port="OAK" tabindex="0" role="button" aria-label="Port of Oakland — the story"><rect x="700" y="40" width="190" height="30" rx="7"/><text x="795" y="61" font-size="17" text-anchor="middle">PORT OF OAKLAND</text></g><text class="hm-w" x="150" y="700" font-size="11">SAN FRANCISCO BAY</text><g class="hm-compass" transform="translate(958 44)"><circle r="16"/><path d="M0 -13 L5 0 L0 -4 L-5 0 Z"/><text y="-20" font-size="9" text-anchor="middle">N</text></g><g class="hm-scale" transform="translate(30 790)"><line x1="0" y1="0" x2="203" y2="0"/><line x1="0" y1="-4" x2="0" y2="4"/><line x1="203" y1="-4" x2="203" y2="4"/><text x="101" y="-6" font-size="10" text-anchor="middle">1 MILE</text></g>';

  var SVG_CITY =
    '<defs><pattern id="hmGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="hm-grid"/></pattern></defs><rect class="hm-water" width="1000" height="814"/><rect width="1000" height="814" fill="url(#hmGrid)"/><path class="hm-land" d="M165.1 228.6 L163.3 234 L164.1 236.3 L162.9 236.6 L163.7 240.8 L162.6 241.1 L163.4 243.4 L166.5 243.2 L168.9 252 L166.9 251.8 L161.1 242.1 L156.8 238.8 L152.2 239.9 L150.3 243.5 L152.7 246.7 L153.1 249.7 L150.4 249.1 L148.8 246.4 L144.2 243.8 L141.9 244.3 L141.9 246.2 L138.8 248.2 L140 251.7 L146.7 260 L145.5 260.3 L142.8 257.9 L141.6 258.1 L142.4 260.4 L144.8 261.7 L145.9 261.4 L145.5 260.3 L148.2 260.9 L151.7 265.6 L150.2 266.6 L129.7 256.1 L122 253.7 L117.4 260.4 L119 263.1 L117.9 263.4 L118.3 264.6 L129.4 268 L131 270.8 L130.3 275.9 L122.2 278 L121.1 276.4 L119.2 278.1 L114.6 279.2 L115.4 281.5 L107.7 281 L98.8 275.1 L91.9 276.8 L91.2 283.8 L89.7 286.7 L91.3 296.9 L89.8 297.9 L91.8 305.5 L88.8 309.4 L90.4 314 L86.6 323 L81.6 324.9 L81.3 327.5 L72.8 330.2 L71.7 328.6 L59.4 332.9 L56.8 338 L57.2 341 L55.3 346.4 L56.5 349.9 L58.9 351.2 L73 347 L73.8 349.3 L77.7 349.6 L78.5 351.9 L77.3 352.2 L76.2 356.2 L79 360.5 L74.7 361 L69.7 359.1 L72.1 362.3 L62.1 366 L58.7 370.6 L62.6 372.7 L74.1 369.9 L75.2 371.5 L79.1 371.7 L81.4 374.9 L85.4 390.1 L85.1 396.5 L83.6 397.5 L82.5 401.5 L77.9 404.5 L72.5 405.2 L55.5 397.6 L50.8 391.3 L50.8 387.5 L55.4 382.6 L55 381.5 L53.8 381.8 L53.4 378.8 L50.3 377 L46.5 378.6 L45 383.4 L42.7 383.9 L45.9 396.9 L49.8 402.8 L55.2 405.8 L56.8 408.5 L53.8 412.4 L53.4 415 L55.4 420.7 L-468.7 1305.6 L-349.2 1371.4 L-273 1414.9 L-261 1420.6 L-259.8 1422.2 L-82.6 1521.1 L443 640.9 L-78 1523.7 L-30.8 1550.1 L-28.9 1550.2 L-8.4 1562.6 L-7.2 1562.3 L-6 1563.9 L229.9 1695.6 L231.1 1695.3 L260.9 1712.9 L786.1 831.5 L788.4 825.3 L793.3 823.4 L794.1 820.1 L799.4 819.4 L800.6 821 L799.5 823.1 L796.4 823.3 L796.1 827.7 L791.1 831.5 L267 1716.4 L272.1 1718.2 L272.5 1719.4 L1022.9 2164.7 L1635.1 1113.6 L886.6 670.3 L881.6 670.3 L878.9 667.9 L876.6 668.5 L876.2 667.3 L869.3 669 L865.8 666.1 L864.6 666.4 L865 667.6 L862 667.7 L858.9 666 L858.5 663 L863.1 661.8 L865.4 663.1 L867.7 662.6 L868.9 664.1 L870.8 662.4 L873.8 662.3 L875.8 664.3 L878.8 664.1 L1638.1 1107.9 L1790.6 817 L1042.1 375.6 L1038.6 369 L1037 368.1 L1033.6 369 L1032.1 371.9 L1028.2 371.6 L1025.6 372.9 L1029.1 383.2 L1019.2 388.8 L1017.4 396.1 L1012 398.7 L1009.4 407.5 L1005.2 409.8 L1005.3 415.4 L1004.1 417.5 L995.7 418.4 L991.1 421.4 L973.9 425.7 L972 429.3 L979.9 448.5 L978.7 450.7 L973 452.1 L968 450.3 L967.2 448 L954 440.6 L949.8 441 L947.5 443.5 L945.2 442.2 L938.2 430.8 L934.7 427.9 L932 427.4 L932.3 424.8 L935.8 423.9 L936.2 425.1 L937.3 424.8 L937.3 422.9 L941.9 421.8 L948.3 411.4 L949.8 406.7 L949.4 403.7 L951.3 402 L949.4 399.9 L949.6 391.7 L953.5 388.3 L952.7 386 L956 375.8 L954.4 371.2 L950.2 369.8 L947.9 370.3 L944.9 376.1 L937.6 376.6 L934.9 379.8 L935.6 374.6 L938.3 369.6 L937 364.3 L935.9 364.6 L932.4 361.7 L925.1 362.3 L923.2 360.3 L919 362.5 L917 360.5 L912.8 361 L912.8 362.8 L906.3 363.8 L905.1 362.2 L908.6 361.4 L908.2 360.2 L905.1 362.2 L900.5 361.5 L895.9 362.7 L892.4 361.7 L889.4 363.7 L881.7 363.1 L879 364.4 L875.5 363.4 L859 366.2 L857.9 372.1 L854.9 376 L855.7 378.3 L851.8 378 L849.9 376 L844.5 374.8 L837.6 376.5 L836.5 378.7 L834.2 379.3 L836.4 373.1 L831.8 372.4 L830.2 367.8 L829.1 368.1 L827.2 371.6 L823.7 372.5 L827.3 379.1 L830.7 380.1 L831.9 383.6 L830.8 383.9 L830.4 386.5 L827.4 388.5 L823.5 386.3 L823.5 382.6 L822.3 382.9 L815.6 399.5 L814 400.5 L805.5 424.5 L801.7 429.8 L800.9 427.5 L815.1 392.8 L822.3 379.1 L819.1 375.5 L787.1 360.4 L784 360.5 L774.6 382.2 L770.4 382.7 L766.5 380.5 L762.7 380.2 L761.2 383.1 L758.5 382.5 L758.9 385.5 L758.1 387 L754.7 387.8 L755.5 390.1 L752.5 394 L747.9 395.1 L742.8 391.4 L738.2 390.7 L737.4 388.4 L742.7 378.3 L743.8 372.4 L739.5 371 L729.5 371 L729.1 369.8 L714.8 362.8 L713.3 360 L699.3 352.3 L703.8 339.9 L701.8 336 L667.1 320.3 L664.4 321.6 L665.6 325.1 L674.9 330.3 L684.9 334 L694.2 339.2 L694.2 341 L691.9 341.6 L686.1 339.3 L670.6 330.7 L662.6 328.9 L651.7 322.9 L647.5 323.3 L644.8 326.5 L646.5 333 L643.4 335 L644.2 337.3 L650 341.4 L645.4 342.6 L643.1 345 L642.1 352.8 L649 358.5 L646 360.5 L644.9 364.6 L640.7 368.7 L636.8 366.6 L634.1 362.3 L625.2 358.2 L625.6 355.6 L622.9 355.1 L617 349 L615.4 344.4 L617.3 337.1 L610.3 333.2 L609.5 330.9 L610.6 326.9 L604 322.3 L598.7 324.9 L597.5 323.3 L594.8 324.6 L591.4 321.7 L586.7 321 L587.1 322.1 L581.4 321.7 L579.5 323.4 L549.4 315.9 L549 312.9 L553.1 303.1 L556.9 301.5 L557.3 302.7 L565 299.5 L567.6 296.4 L573 293.8 L573.3 291.2 L577.5 288.9 L578.7 286.8 L578.3 285.6 L571.3 281.7 L563.6 279.3 L551.6 271.6 L550.4 271.9 L550.8 273.1 L542.5 287 L542.9 288.2 L533.5 308 L531.2 308.5 L530.4 306.2 L533.8 296 L533.4 291.2 L523.7 286.7 L521.4 287.3 L519.5 289 L515.4 300.6 L508.5 300.5 L503.2 310.5 L501.4 317.9 L498.3 319.9 L496.7 315.3 L497.3 302.6 L498.5 302.3 L499.7 305.8 L499.4 312.1 L500.5 311.8 L506.1 299.2 L513.8 297.9 L517.6 290.7 L516.8 288.4 L510.2 287.5 L508.3 285.5 L503.3 283.7 L501.8 290.3 L498.8 296 L499.6 300.2 L497.3 302.6 L496.9 295.9 L492.7 298.2 L492.3 297 L495.3 289.4 L491.1 291.7 L466.7 279 L467 274.6 L471.5 264.1 L469.2 260.9 L464.2 260.9 L463.8 257.9 L466.4 254.7 L466.4 252.9 L465.3 253.2 L460.2 249.4 L457.9 250 L453.4 258.6 L444.2 255.3 L438.8 261.6 L438.4 258.6 L442.5 248.8 L442.1 245.8 L436.3 243.5 L434.8 244.5 L432.9 250 L430.6 250.5 L436.2 234.2 L434.7 231.4 L421.5 224.1 L417.7 223.8 L409 236.6 L410 226.9 L408.4 224.2 L403 223.1 L400.4 230 L398.5 231.7 L398 219.3 L392.2 217 L388.4 222.3 L388.9 227.2 L387.4 231.9 L381.6 233.4 L380.5 235.5 L377.8 235 L373.1 230.5 L369.7 235.1 L339.4 239.5 L334.1 242.1 L320.6 237.3 L317 228.9 L318.1 228.6 L317.7 227.4 L313.9 225.3 L307.4 226.3 L305.1 232.4 L304 232.7 L302.8 231.1 L298.6 231.6 L299 232.7 L296.7 235.2 L293.2 232.3 L291.6 227.7 L284.7 225.7 L280.1 226.8 L275.8 225.4 L270.5 227.9 L269.7 231.3 L267.5 233.7 L267.1 236.3 L269.1 240.2 L268.3 241.6 L270.7 244.8 L266.8 246.3 L264.4 233.8 L265.1 232.4 L262.8 227.4 L259.7 225.6 L255.5 226.1 L254.3 228.2 L254.7 231.2 L253.6 231.5 L251.7 229.5 L245.5 227.9 L244.3 226.3 L240.1 230.5 L238.2 228.5 L227 226.9 L233.6 231.5 L234 232.7 L232.9 232.9 L224.3 228.2 L219.8 231.2 L213.9 227 L209 228.9 L204 228.9 L204.4 230 L199 234.5 L204.2 249.4 L202.3 251.2 L176.7 233.2 L170.5 229.7 L168.2 230.3 L167.1 228.7 Z"/><path class="hm-land hm-islet" d="M85.4 -69 L183.6 -12.7 L198.6 -12.7 L209.4 -6.6 L228.8 9.8 L230.4 14.4 L228.9 15.4 L230.1 18.8 L237.8 21.3 L240.1 20.7 L241.3 22.3 L245.9 19.3 L246.3 20.4 L252.4 20.1 L252 19 L257.8 17.6 L264.6 14 L270.4 8.8 L276.5 8.5 L276.5 6.6 L282.2 1.5 L282.9 -1.8 L290.2 -2.4 L293.2 -8.1 L293.2 -11.9 L295.1 -15.5 L298.9 -17 L299.6 -22.2 L304.5 -29.7 L307.2 -31 L307.6 -29.8 L309.9 -30.4 L309.9 -32.3 L314.4 -37.1 L314 -38.3 L312.1 -38.4 L305.1 -49.8 L300 -53.5 L275.7 -64.3 L272.6 -67.9 L267.2 -71 L264.1 -74.6 L260.9 -83.8 L261.2 -88.2 L258.1 -95.5 L255.7 -96.8 L254.9 -99.1 L247.6 -102.3 L244.1 -101.5 L240.4 -96.1 L237.6 -69.8 L233.8 -64.5 L234.6 -62.2 L231.9 -59.1 L238.7 -39.5 L237.2 -38.5 L239.1 -36.5 L238.4 -29.5 L226.6 -20.3 L226.2 -21.4 L218.1 -19.4 L218.5 -18.3 L213.5 -18.3 L205.4 -21.9 L194.6 -24.2 L193.8 -26.5 L100.4 -97.7 Z"/><line class="hm-bridge" x1="402.9" y1="247.5" x2="288.5" y2="-4"/><text class="hm-b" x="371.7" y="121.75" font-size="10" transform="rotate(-30 371.7 121.75)">BAY BRIDGE · TO OAKLAND</text><path class="hm-bw hm-st" d="M302.2 237.3 L432.5 726.4" style="fill:none;stroke-width:1.1;opacity:.35"/><path class="hm-bw hm-st" d="M437.9 273.2 L556.4 348.5 L737.7 466.1 L902.7 569" style="fill:none;stroke-width:1.1;opacity:.35"/><path class="hm-bw hm-st" d="M460.7 594.3 L608.8 344.9" style="fill:none;stroke-width:1.1;opacity:.35"/><path class="hm-bw hm-st" d="M606 730.2 L767.2 458.8" style="fill:none;stroke-width:1.1;opacity:.35"/><path class="hm-bw hm-st" d="M82.8 384.8 L260.9 307" style="fill:none;stroke-width:1.1;opacity:.35"/><path class="hm-bw hm-st" d="M76.3 395.8 L410.5 594.2" style="fill:none;stroke-width:1.1;opacity:.35"/><path class="hm-bw hm-st" d="M402.9 247.5 L431.5 368.6 L470.3 451.2" style="fill:none;stroke-width:1.1;opacity:.35"/><path class="hm-bw hm-st" d="M470.3 451.2 L688.8 590.8 L847.2 704.7" style="fill:none;stroke-width:1.1;opacity:.35"/><path class="hm-bw hm-st" d="M476.7 355.8 L620.9 451.3 L806.6 561.6" style="fill:none;stroke-width:1.1;opacity:.35"/><g class="hm-lm" aria-hidden="true"><path class="lk lk-a" d="M297.2 239.3 L297.2 217.3 L307.2 217.3 L307.2 239.3 M302.2 217.3 L302.2 209.3"/><path class="lk lk-a" d="M256.5 311.2 L264.5 267.2 L272.5 311.2 Z"/><path class="lk lk-a" d="M335.3 298.2 L337.3 250.2 L345.3 250.2 L347.3 298.2 Z"/><path class="lk lk-a" d="M180.6 293.5 L181.6 267.5 L187.6 267.5 L188.6 293.5 Z"/><path class="lk lk-a lk-thin" d="M463.4 299.7 Q477.4 283.7 491.4 299.7 Z"/></g><g class="hm-lm" aria-hidden="true"><path class="lk lk-w" d="M813.025 325.85 L863.025 325.85 L869.025 331.85 L863.025 337.85 L813.025 337.85 Z"/><path class="lk lk-w" d="M196.142 204.368 L246.142 176.368 L252.142 182.368 L202.142 210.368 Z"/></g>' +
    dock(12, "hm-LB", "M164.5 229.4 L163.1 241 L162.8 243.4 L153.1 249.4 L140.6 251.3 L139.5 248 L142.4 244.3 Z", "Pier 35 cruise") +
    dock(11, "hm-LB", "M197.6 234.4 L182.5 238.2 L164 233.9 L165.7 228.9 L167.6 228.9 Z", "Pier 27 cruise terminal") +
    dock(13, "hm-LB", "M640.2 349.3 L662.6 311.5 L699.7 329.2 L675.3 370.2 Z", "Pier 70 shipyard") +
    dock(14, "hm-LB", "M743.1 394.3 L771.9 345.7 L807.4 364.2 L785.7 415.2 Z", "Pasha Pier 80") +
    dock(15, "hm-LB", "M803.6 479 L823.2 445.8 L837.1 454.2 L817.5 487.3 Z", "Pier 92") +
    dock(16, "hm-LB", "M835 429.7 L852.6 400.1 L895.1 385.3 L917.5 390.3 L869.4 450 Z", "Pier 94-96") +
    dock(21, "hm-LB", "M88.7 354.9 L106.7 354.9 L106.7 372.9 L88.7 372.9 Z", "ILWU Local 10 hall") +
    dock(22, "hm-LB", "M469.6 333 L487.6 333 L487.6 351 L469.6 351 Z", "Local 34 · Local 75 hall") +
    dock(26, "hm-LB", "M320.3 299 L338.3 299 L338.3 317 L320.3 317 Z", "PMA headquarters") +
    dock(27, "hm-LB", "M250.5 490.6 L268.5 490.6 L268.5 508.6 L250.5 508.6 Z", "ILWU International") +
    '<g class="hm-lblg" data-i="12"><text class="hm-lbl hm-lbl-LB" x="122.3" y="217.8" font-size="12">Pier 35</text></g><g class="hm-lblg" data-i="11"><text class="hm-lbl hm-lbl-LB" x="211.5" y="210.9" font-size="13">Pier 27</text><text class="hm-sub" x="211.5" y="220.9" font-size="7">CRUISE TERMINAL</text></g><g class="hm-lblg" data-i="13"><text class="hm-lbl hm-lbl-LB" x="669.5" y="306.1" font-size="14">Pier 70</text><text class="hm-sub" x="669.5" y="316.1" font-size="7">SHIPYARD</text></g><g class="hm-lblg" data-i="14"><text class="hm-lbl hm-lbl-LB" x="777" y="345.9" font-size="15">Pasha</text><text class="hm-sub" x="777" y="355.9" font-size="7">PIER 80 · AUTOS</text></g><g class="hm-lblg" data-i="15"><text class="hm-lbl hm-lbl-LB" x="820.4" y="488.6" font-size="10">Pier 92</text></g><g class="hm-lblg" data-i="16"><text class="hm-lbl hm-lbl-LB" x="873.9" y="381.1" font-size="14">Pier 96</text><text class="hm-sub" x="873.9" y="391.1" font-size="7">BULK · RAIL</text></g><g class="hm-lblg" data-i="21"><text class="hm-lbl hm-lbl-LB" x="89.7" y="345.9" font-size="11">LOCAL 10</text><text class="hm-sub" x="89.7" y="355.9" font-size="7">THE HALL</text></g><g class="hm-lblg" data-i="22"><text class="hm-lbl hm-lbl-LB" x="478.6" y="326" font-size="10">34 · 75</text><text class="hm-sub" x="478.6" y="336" font-size="7">BERRY ST</text></g><g class="hm-lblg" data-i="26"><text class="hm-lbl hm-lbl-LB" x="299.3" y="310" font-size="10">PMA</text><text class="hm-sub" x="299.3" y="320" font-size="7">HQ</text></g><g class="hm-lblg" data-i="27"><text class="hm-lbl hm-lbl-LB" x="259.5" y="483.6" font-size="10">ILWU</text><text class="hm-sub" x="259.5" y="493.6" font-size="7">INTERNATIONAL</text></g><text class="hm-place" x="51.5" y="177.2" font-size="9">FISHERMAN’S WHARF</text><text class="hm-place" x="188.6" y="263.5" font-size="9">NORTH BEACH</text><text class="hm-place" x="298.9" y="289.3" font-size="9">FINANCIAL DISTRICT</text><text class="hm-place" x="422.6" y="228.9" font-size="8">SOUTH BEACH</text><text class="hm-place" x="541.1" y="304.2" font-size="9">MISSION BAY</text><text class="hm-place" x="665.6" y="348.3" font-size="8">DOGPATCH</text><text class="hm-place" x="622.1" y="421.7" font-size="9">POTRERO HILL</text><text class="hm-place" x="893.9" y="513.7" font-size="9">BAYVIEW</text><text class="hm-place" x="1094.5" y="345.1" font-size="9">HUNTERS POINT</text><text class="hm-place" x="405" y="491.2" font-size="22">SAN FRANCISCO</text><text class="hm-place" x="361.8" y="415.9" font-size="7">MARKET ST</text><text class="hm-place" x="805.5" y="451.2" font-size="7">THIRD ST</text><text class="hm-place" x="680.7" y="555.7" font-size="7">CESAR CHAVEZ ST</text><text class="hm-place" x="238.7" y="179.2" font-size="7">EMBARCADERO</text><text class="hm-w" x="641.3" y="135.5" font-size="20">SAN FRANCISCO BAY</text><text class="hm-w" x="499.4" y="279.4" font-size="6">McCOVEY COVE</text><text class="hm-w" x="743.3" y="255.6" font-size="7">CENTRAL BASIN</text><text class="hm-w" x="784.1" y="423.7" font-size="7">ISLAIS CREEK</text><text class="hm-w" x="954.3" y="390.8" font-size="8">INDIA BASIN</text><text class="hm-w" x="924.5" y="303.6" font-size="7">HERON’S HEAD</text><text class="hm-w" x="556" y="184" font-size="7">CHINA BASIN</text><text class="hm-w" x="231.7" y="-147.4" font-size="8">YERBA BUENA</text><g class="hm-port hm-port-LB" data-port="SF" tabindex="0" role="button" aria-label="Port of San Francisco — the story"><rect x="30" y="40" width="226" height="30" rx="7"/><text x="143" y="61" font-size="17" text-anchor="middle">PORT OF SAN FRANCISCO</text></g><text class="hm-b hm-lmt" x="700" y="100" font-size="9">OAKLAND → 4 MI ACROSS THE BAY</text><g class="hm-compass" transform="translate(958 60) rotate(-59.3)"><circle r="16"/><path d="M0 -13 L5 0 L0 -4 L-5 0 Z"/><text y="-20" font-size="9" text-anchor="middle">N</text></g><g class="hm-scale" transform="translate(30 790)"><line x1="0" y1="0" x2="156.099" y2="0"/><line x1="0" y1="-4" x2="0" y2="4"/><line x1="156.099" y1="-4" x2="156.099" y2="4"/><text x="78.0495" y="-6" font-size="10" text-anchor="middle">1 MILE</text></g>';

  P.sf = {
    code: "sf",
    short: "SF/OAK",
    title: "San Francisco Bay",
    src: "◆ SF / OAKLAND",
    aria: "Port of Oakland — Outer Harbor, Middle Harbor and the Estuary, with the San Francisco waterfront across the Bay",
    hint: "Container work is at Oakland; the hall is in San Francisco",
    svg: SVG_OAK,
    views: [
      { key: "oak", label: "Oakland", svg: SVG_OAK, title: "The Port of Oakland", aria: "Port of Oakland — Outer Harbor, Middle Harbor and the Estuary" },
      { key: "city", label: "San Francisco", svg: SVG_CITY, title: "The San Francisco waterfront", aria: "San Francisco — Aquatic Park to India Basin, traced from the Port’s own map; the Bay on top, north up-left" },
      { key: "bay", label: "The Bay", svg: SVG, title: "San Francisco Bay", aria: "San Francisco Bay — both cities at one scale" }
    ],
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
