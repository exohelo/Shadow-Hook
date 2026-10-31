/* The Shadow Hook · harbor_sf.js (nov1b) — PORT PACK for the San Francisco Bay Area (ILWU Local 10, code "sf").
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

  /* ---------- the map ---------- */
  var SVG =
    '<defs><pattern id="hmGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="hm-grid"/></pattern>' +
    '<filter id="hmGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    '<rect class="hm-water" width="1000" height="814"/><rect width="1000" height="814" fill="url(#hmGrid)"/>' +

    /* OAKLAND — the port peninsula: Outer Harbor face on the west, Middle Harbor to the south-west, the Estuary along the south.
       West Oakland and downtown behind it; the ex-Army Base at the top. */
    '<path class="hm-land" d="M330 0 L1000 0 L1000 560 L905 568 L860 574 L800 572 L748 560 L700 548 L660 544 L600 542 L540 536 L470 522 L420 516 L380 512 L330 506 L300 494 L275 474 L250 460 L222 448 L205 420 L198 380 L200 345 L205 310 L208 270 L214 236 L228 200 L252 160 L285 120 L312 70 Z"/>' +
    /* Middle Harbor Shoreline Park — the old Navy piers, now a hook of land west of OICT */
    '<path class="hm-land hm-islet" d="M205 420 L222 448 L250 460 L275 474 L300 494 L300 520 L262 512 L228 500 L205 480 L190 452 Z"/>' +
    /* ALAMEDA — south of the Estuary: Alameda Point (the old Naval Air Station) west, the city east */
    '<path class="hm-land" d="M250 600 L340 582 L440 578 L560 582 L660 590 L760 596 L860 602 L1000 596 L1000 814 L250 814 Z"/>' +
    '<text class="hm-w" x="760" y="584" font-size="10">OAKLAND ESTUARY · INNER HARBOR</text>' +

    /* Bay Bridge comes in from Yerba Buena at the top-left corner and lands north of the port */
    '<line class="hm-bridge" x1="0" y1="150" x2="312" y2="70"/>' +
    '<text class="hm-b" x="150" y="100" font-size="11" transform="rotate(-14 150 100)">BAY BRIDGE · TO YERBA BUENA &amp; SAN FRANCISCO</text>' +
    /* the 7th St / Middle Harbor Rd spine the trucks use, as a thin track */
    '<path class="hm-bw" d="M235 300 L330 345 L420 440 L540 470 L700 520" style="fill:none;stroke-width:1.4;opacity:.35;stroke-dasharray:2 4"/>' +

    /* ---- the docks (Oakland = LA palette · San Francisco = LB palette) ---- */
    dock(5, "hm-LA", "M214 236 L286 232 L288 272 L208 272 Z", "Outer Harbor Terminal") +
    dock(2, "hm-LA", "M208 274 L300 274 L300 320 L202 322 Z", "Everport · Ben E. Nutter") +
    dock(6, "hm-LA", "M202 324 L270 324 L270 352 L200 354 Z", "Berths 32-34") +
    dock(1, "hm-LA", "M200 356 L360 356 L360 420 L222 420 L205 420 L198 380 Z", "TraPac") +
    dock(0, "hm-LA", "M302 424 L470 424 L470 522 L420 516 L380 512 L330 506 L300 494 Z", "SSA OICT") +
    dock(3, "hm-LA", "M474 440 L600 440 L600 542 L540 536 L474 522 Z", "SSA Matson Terminal") +
    dock(4, "hm-LA", "M640 500 L720 500 L722 554 L700 548 L660 544 L640 540 Z", "Matson Howard Terminal") +
    dock(8, "hm-LA", "M474 360 L560 360 L560 436 L474 436 Z", "BNSF Oakland International Gateway") +
    dock(7, "hm-LA", "M474 260 L560 260 L560 356 L474 356 Z", "Union Pacific OIG") +
    dock(9, "hm-LA", "M372 200 L470 200 L470 256 L372 256 Z", "Cool Port Oakland") +
    dock(10, "hm-LA", "M300 130 L470 118 L470 196 L300 196 Z", "Seaport Logistics Complex") +
    dock(25, "hm-LA", "M818 344 L834 344 L834 360 L818 360 Z", "PMA Northern California") +

    /* ---- labels ---- */
    lbl(5, "hm-lbl-LA", 248, 258, "OHT", 16, "22-24", 9) +
    lbl(2, "hm-lbl-LA", 252, 298, "ETS", 20, "EVERPORT 35-38", 9) +
    lbl(6, "hm-lbl-LA", 236, 343, "32-34", 13, "", 0) +
    lbl(1, "hm-lbl-LA", 282, 388, "TraPac", 22, "25-33", 10) +
    lbl(0, "hm-lbl-LA", 386, 468, "SSA", 26, "OICT 55-59", 11) +
    lbl(3, "hm-lbl-LA", 537, 488, "SSA", 20, "MATSON 60-63", 10) +
    lbl(4, "hm-lbl-LA", 681, 524, "Matson", 16, "HOWARD 67-68", 9) +
    lbl(8, "hm-lbl-LA", 517, 396, "BNSF", 15, "OIG RAIL", 9) +
    lbl(7, "hm-lbl-LA", 517, 306, "UP", 15, "OIG RAIL", 9) +
    lbl(9, "hm-lbl-LA", 421, 226, "Cool Port", 14, "REEFER", 9) +
    lbl(10, "hm-lbl-LA", 385, 160, "Seaport Logistics", 13, "OLD ARMY BASE", 9) +
    lbl(25, "hm-lbl-LA", 826, 338, "PMA", 12, "", 0) +

    /* places and water */
    '<text class="hm-place" x="820" y="200" font-size="22">OAKLAND</text>' +
    '<text class="hm-place" x="700" y="330" font-size="12">WEST OAKLAND</text>' +
    '<text class="hm-place" x="760" y="470" font-size="11">JACK LONDON SQ</text>' +
    '<text class="hm-place" x="740" y="720" font-size="22">ALAMEDA</text>' +
    '<text class="hm-place" x="380" y="700" font-size="13">ALAMEDA POINT</text>' +
    '<text class="hm-w" x="110" y="300" font-size="14" transform="rotate(-90 110 300)">OUTER HARBOR</text>' +
    '<text class="hm-w" x="120" y="470" font-size="12">MIDDLE HARBOR</text>' +
    '<text class="hm-w" x="275" y="530" font-size="8">SHORELINE PARK</text>' +
    '<text class="hm-w" x="400" y="560" font-size="12">INNER HARBOR</text>' +
    '<text class="hm-w" x="110" y="420" font-size="11">SAN FRANCISCO BAY</text>' +
    /* edge arrows — the outports in the list */
    '<text class="hm-b hm-lmt" x="120" y="22" font-size="9">↑ RICHMOND 8 MI · BENICIA 25 MI</text>' +
    '<text class="hm-b hm-lmt" x="930" y="800" font-size="9">↓ REDWOOD CITY 24 MI</text>' +
    '<text class="hm-b hm-lmt" x="930" y="616" font-size="9">LOCAL 91 → 1851 EMBARCADERO</text>' +

    /* ---- the inset: San Francisco across the Bay (x = 20 + (lon+122.43)·2647 · y = 540 + (37.817−lat)·3351) ---- */
    '<g class="hm-inset">' +
    '<rect x="20" y="540" width="210" height="258" rx="8" class="hm-water" style="stroke:var(--hm-shore);stroke-width:1.2"/>' +
    '<path class="hm-land" d="M22 556 L50 562 L80 572 L100 582 L120 612 L128 650 L133 690 L140 720 L145 750 L150 780 L152 796 L22 796 Z"/>' +
    '<text class="hm-place" x="44" y="730" font-size="11" transform="rotate(-90 44 730)">SAN FRANCISCO</text>' +
    '<text class="hm-b hm-lmt" x="125" y="552" font-size="8">ACROSS THE BAY · THE CITY SIDE</text>' +
    '<text class="hm-w" x="200" y="700" font-size="8" transform="rotate(-90 200 700)">THE BAY</text>' +
    dock(21, "hm-LB", "M42 568 L58 568 L58 584 L42 584 Z", "ILWU Local 10 hall") +
    dock(12, "hm-LB", "M86 568 L98 566 L100 578 L88 580 Z", "Pier 35 cruise") +
    dock(11, "hm-LB", "M98 580 L114 578 L116 594 L100 596 Z", "Pier 27 cruise terminal") +
    dock(26, "hm-LB", "M92 624 L104 624 L104 636 L92 636 Z", "PMA headquarters") +
    dock(27, "hm-LB", "M34 636 L46 636 L46 648 L34 648 Z", "ILWU International") +
    dock(22, "hm-LB", "M112 670 L124 670 L124 682 L112 682 Z", "Local 34 · Local 75 hall") +
    dock(13, "hm-LB", "M138 722 L164 720 L164 740 L140 740 Z", "Pier 70 shipyard") +
    dock(14, "hm-LB", "M140 756 L170 754 L170 772 L142 772 Z", "Pasha Pier 80") +
    dock(15, "hm-LB", "M126 774 L144 774 L144 786 L128 786 Z", "Pier 92") +
    dock(16, "hm-LB", "M150 788 L190 786 L190 798 L152 798 Z", "Pier 94-96") +
    lbl(21, "hm-lbl-LB", 50, 565, "LOCAL 10", 9, "", 0) +
    lbl(12, "hm-lbl-LB", 92, 563, "35", 8, "", 0) +
    lbl(11, "hm-lbl-LB", 137, 590, "Pier 27", 10, "CRUISE", 7) +
    lbl(26, "hm-lbl-LB", 116, 634, "PMA", 9, "", 0) +
    lbl(27, "hm-lbl-LB", 60, 646, "ILWU", 9, "", 0) +
    lbl(22, "hm-lbl-LB", 143, 680, "34 · 75", 9, "", 0) +
    lbl(13, "hm-lbl-LB", 184, 733, "Pier 70", 10, "", 0) +
    lbl(14, "hm-lbl-LB", 194, 766, "Pasha", 10, "PIER 80", 7) +
    lbl(15, "hm-lbl-LB", 118, 783, "92", 8, "", 0) +
    lbl(16, "hm-lbl-LB", 206, 796, "96", 10, "", 0) +
    "</g>" +

    /* the port chips (tap for the story) */
    '<g class="hm-port hm-port-LA" data-port="OAK" tabindex="0" role="button" aria-label="Port of Oakland — the story"><rect x="640" y="40" width="190" height="30" rx="7"/><text x="735" y="61" font-size="17" text-anchor="middle">PORT OF OAKLAND</text></g>' +
    '<g class="hm-port hm-port-LB" data-port="SF" tabindex="0" role="button" aria-label="Port of San Francisco — the story"><rect x="30" y="506" width="200" height="26" rx="7"/><text x="130" y="524" font-size="13" text-anchor="middle">PORT OF SAN FRANCISCO</text></g>' +

    /* compass and scale (1 mile = 203 px in the main frame) */
    '<g class="hm-compass" transform="translate(958 44)"><circle r="16"/><path d="M0 -13 L5 0 L0 -4 L-5 0 Z"/><text y="-20" font-size="9" text-anchor="middle">N</text></g>' +
    '<g class="hm-scale" transform="translate(300 790)"><line x1="0" y1="0" x2="203" y2="0"/><line x1="0" y1="-4" x2="0" y2="4"/><line x1="203" y1="-4" x2="203" y2="4"/><text x="101" y="-6" font-size="10" text-anchor="middle">1 MILE</text></g>';

  P.sf = {
    code: "sf",
    short: "SF/OAK",
    title: "The Port of Oakland",
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
