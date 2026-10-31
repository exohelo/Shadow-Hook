/* The Shadow Hook · harbor_sd.js (nov1a) — PORT PACK for San Diego (ILWU Local 29, code "sd").
   Same stage and classes as the San Pedro Bay map. The research pass for San Diego is NOT done: terminal
   addresses, gates and the Harbor Police line are directory facts, every one marked ⚠ until someone on the
   ground confirms. Framed like the San Pedro map: the whole working bay from the entrance to the South Bay. */
(function () {
  "use strict";
  var P = (window.HARBOR_PACKS = window.HARBOR_PACKS || {});

  var TERMS = [
    { berths: "SD 10th Ave", operator: "Port of San Diego", aka: "Tenth Avenue Marine Terminal (TAMT) · breakbulk / bulk / reefer ⚠", security: "(619) 686-6272",
      gates: [{ gate: "Main · 687 Switzer St ⚠", lat: 32.6990, lng: -117.1540, addr: "687 Switzer St, San Diego, CA 92101" }] },
    { berths: "SD National City", operator: "Pasha", aka: "National City Marine Terminal (NCMT) · autos / ro-ro ⚠", security: "(619) 686-6272",
      gates: [{ gate: "Main · Bay Marina Dr ⚠", lat: 32.6567, lng: -117.1130, addr: "National City Marine Terminal, National City, CA 91950" }] },
    { berths: "SD B Street", operator: "Port of San Diego", aka: "B Street Cruise Ship Terminal ⚠", security: "(619) 686-6272",
      gates: [{ gate: "1140 N Harbor Dr", lat: 32.7175, lng: -117.1740, addr: "1140 N Harbor Dr, San Diego, CA 92101" }] },
    { berths: "SD Broadway Pier", operator: "Port of San Diego", aka: "Broadway Pier · second cruise berth ⚠", security: "(619) 686-6272",
      gates: [{ gate: "1000 N Harbor Dr", lat: 32.7155, lng: -117.1735, addr: "1000 N Harbor Dr, San Diego, CA 92101" }] },
    { berths: "SD Dole · TAMT", operator: "Dole", aka: "Dole fresh fruit · at Tenth Avenue ⚠", security: "(619) 686-6272",
      gates: [{ gate: "TAMT gate", lat: 32.6975, lng: -117.1525, addr: "Tenth Avenue Marine Terminal, San Diego, CA 92101" }] },
    { berths: "SD Harbor Police", operator: "Harbor Police", aka: "Port of San Diego Harbor Police · 24h dispatch ⚠", security: "(619) 686-6272",
      gates: [{ gate: "3380 N Harbor Dr", lat: 32.7275, lng: -117.1990, addr: "3380 N Harbor Dr, San Diego, CA 92101" }] },
    { berths: "Local 29 Hall", operator: "ILWU Local 29", aka: "Dispatch hall · 1000 Bay Marina Dr, National City", security: "(619) 477-4593",
      gates: [{ gate: "Hall", lat: 32.6612, lng: -117.1095, addr: "1000 Bay Marina Dr, National City, CA 91950" }] },
    { berths: "PMA San Diego", operator: "PMA", aka: "San Diego office", security: "(619) 321-6914",
      gates: [{ gate: "Office · Suite 420", lat: 32.7153, lng: -117.1655, addr: "402 W Broadway Ste 420, San Diego, CA 92101" }] }
  ];

  /* frame: lon −117.235→0 · −117.085→1000 (6667 px/°), lat 32.738→0 (7937 px/°). 1 mile = 115 px */
  var SVG =
    '<defs><pattern id="hmGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="hm-grid"/></pattern>' +
    '<filter id="hmGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    '<rect class="hm-water" width="1000" height="814"/><rect width="1000" height="814" fill="url(#hmGrid)"/>' +

    /* the mainland: Point Loma down the left edge, the airport and the north shore across the top, then the city shore
       running south-east — Embarcadero, Tenth Avenue, the shipyards, the Naval Base, National City, Chula Vista */
    '<path class="hm-land" d="M0 0 L1000 0 L1000 814 L887 814 L867 714 L847 659 L820 603 L753 524 L647 437 L587 365 L540 302 L513 278 L467 238 L420 183 L367 127 L300 100 L240 80 L180 70 L120 75 L80 110 L62 160 L52 230 L54 330 L50 460 L44 560 L20 606 L0 606 Z"/>' +
    /* Harbor Island and Shelter Island */
    '<path class="hm-land hm-islet" d="M160 92 L300 104 L302 116 L160 104 Z"/>' +
    '<path class="hm-land hm-islet" d="M54 200 L105 218 L102 230 L52 214 Z"/>' +
    /* North Island · Coronado · the Silver Strand down to the bottom edge */
    '<path class="hm-land" d="M60 183 L300 183 L400 262 L467 317 L500 381 L513 500 L600 659 L733 778 L760 814 L567 814 L400 619 L133 460 L33 302 Z"/>' +

    /* San Diego–Coronado Bridge: Barrio Logan over to Coronado */
    '<path class="hm-bridge" d="M613 380 Q540 420 447 405" fill="none"/>' +
    '<text class="hm-b" x="530" y="430" font-size="11">CORONADO BRIDGE</text>' +

    /* ---- the docks (Port of San Diego = LA palette · National City = LB palette) ---- */
    '<path class="hm-dock hm-LA" data-op="Port of San Diego" data-berths="SD B Street" data-i="2" d="M400 148 L432 166 L424 180 L392 162 Z" tabindex="0" role="button" aria-label="B Street Cruise Ship Terminal — SD B Street"/>' +
    '<path class="hm-dock hm-LA" data-op="Port of San Diego" data-berths="SD Broadway Pier" data-i="3" d="M408 182 L438 198 L432 210 L402 194 Z" tabindex="0" role="button" aria-label="Broadway Pier — SD Broadway Pier"/>' +
    '<path class="hm-dock hm-LA" data-op="Port of San Diego" data-berths="SD 10th Ave" data-i="0" d="M520 288 L566 278 L602 350 L584 376 L540 322 Z" tabindex="0" role="button" aria-label="Tenth Avenue Marine Terminal — SD 10th Ave"/>' +
    '<path class="hm-dock hm-LA" data-op="Dole" data-berths="SD Dole · TAMT" data-i="4" d="M604 352 L630 346 L642 378 L616 386 Z" tabindex="0" role="button" aria-label="Dole fresh fruit — at TAMT"/>' +
    '<path class="hm-dock hm-LA" data-op="Harbor Police" data-berths="SD Harbor Police" data-i="5" d="M232 72 L248 72 L248 88 L232 88 Z" tabindex="0" role="button" aria-label="Harbor Police — 3380 N Harbor Dr"/>' +
    '<path class="hm-dock hm-LA" data-op="PMA" data-berths="PMA San Diego" data-i="7" d="M458 168 L474 168 L474 184 L458 184 Z" tabindex="0" role="button" aria-label="PMA San Diego — 402 W Broadway"/>' +
    '<path class="hm-dock hm-LB" data-op="Pasha" data-berths="SD National City" data-i="1" d="M806 628 L862 636 L874 698 L842 712 L812 682 Z" tabindex="0" role="button" aria-label="National City Marine Terminal — Pasha autos"/>' +
    '<path class="hm-dock hm-LB" data-op="ILWU Local 29" data-berths="Local 29 Hall" data-i="6" d="M872 600 L888 600 L888 616 L872 616 Z" tabindex="0" role="button" aria-label="ILWU Local 29 hall — Bay Marina Dr"/>' +

    /* ---- labels ---- */
    '<g class="hm-lblg" data-i="2"><text class="hm-lbl hm-lbl-LA" x="360" y="140" font-size="12">B STREET</text><text class="hm-sub" x="360" y="151" font-size="8">CRUISE</text></g>' +
    '<g class="hm-lblg" data-i="3"><text class="hm-lbl hm-lbl-LA" x="372" y="212" font-size="10">BROADWAY PIER</text></g>' +
    '<g class="hm-lblg" data-i="0"><text class="hm-lbl hm-lbl-LA" x="558" y="322" font-size="18">10th Ave</text><text class="hm-sub" x="558" y="336" font-size="9">TAMT · BREAKBULK</text></g>' +
    '<g class="hm-lblg" data-i="4"><text class="hm-lbl hm-lbl-LA" x="668" y="366" font-size="12">Dole</text><text class="hm-sub" x="668" y="377" font-size="8">FRUIT</text></g>' +
    '<g class="hm-lblg" data-i="5"><text class="hm-lbl hm-lbl-LA" x="240" y="66" font-size="9">HARBOR POLICE</text></g>' +
    '<g class="hm-lblg" data-i="7"><text class="hm-lbl hm-lbl-LA" x="494" y="180" font-size="12">PMA</text></g>' +
    '<g class="hm-lblg" data-i="1"><text class="hm-lbl hm-lbl-LB" x="838" y="668" font-size="18">Pasha</text><text class="hm-sub" x="838" y="682" font-size="9">NCMT · AUTOS</text></g>' +
    '<g class="hm-lblg" data-i="6"><text class="hm-lbl hm-lbl-LB" x="930" y="612" font-size="12">LOCAL 29</text></g>' +

    /* places and water */
    '<text class="hm-place" x="720" y="150" font-size="22">SAN DIEGO</text>' +
    '<text class="hm-place" x="330" y="40" font-size="11">LINDBERGH FIELD</text>' +
    '<text class="hm-place" x="690" y="280" font-size="11">BARRIO LOGAN</text>' +
    '<text class="hm-place" x="720" y="420" font-size="9">NASSCO · BAE SHIPYARDS</text>' +
    '<text class="hm-place" x="860" y="500" font-size="11">NAVAL BASE SAN DIEGO</text>' +
    '<text class="hm-place" x="880" y="515" font-size="8">32ND STREET</text>' +
    '<text class="hm-place" x="940" y="700" font-size="13">NATIONAL CITY</text>' +
    '<text class="hm-place" x="940" y="800" font-size="11">CHULA VISTA</text>' +
    '<text class="hm-place" x="230" y="300" font-size="14">NAS NORTH ISLAND</text>' +
    '<text class="hm-place" x="420" y="360" font-size="14">CORONADO</text>' +
    '<text class="hm-place" x="585" y="600" font-size="11" transform="rotate(55 585 600)">SILVER STRAND</text>' +
    '<text class="hm-place" x="30" y="440" font-size="10" transform="rotate(-90 30 440)">POINT LOMA</text>' +
    '<text class="hm-w" x="430" y="470" font-size="18" transform="rotate(46 430 470)">SAN DIEGO BAY</text>' +
    '<text class="hm-w" x="720" y="760" font-size="11">SOUTH BAY</text>' +
    '<text class="hm-w" x="200" y="700" font-size="14">PACIFIC OCEAN</text>' +
    '<text class="hm-w" x="470" y="300" font-size="8">FERRY LANDING</text>' +
    '<text class="hm-w" x="230" y="128" font-size="8">HARBOR ISLAND</text>' +
    '<text class="hm-w" x="66" y="240" font-size="8">SHELTER IS.</text>' +
    '<text class="hm-w" x="70" y="590" font-size="8">THE ENTRANCE</text>' +

    '<g class="hm-port hm-port-LA" data-port="SD" tabindex="0" role="button" aria-label="Port of San Diego — the story"><rect x="640" y="60" width="210" height="30" rx="7"/><text x="745" y="81" font-size="17" text-anchor="middle">PORT OF SAN DIEGO</text></g>' +
    '<g class="hm-port hm-port-LB" data-port="NC" tabindex="0" role="button" aria-label="National City — the story"><rect x="780" y="736" width="170" height="28" rx="7"/><text x="865" y="756" font-size="15" text-anchor="middle">NATIONAL CITY</text></g>' +

    '<g class="hm-compass" transform="translate(958 44)"><circle r="16"/><path d="M0 -13 L5 0 L0 -4 L-5 0 Z"/><text y="-20" font-size="9" text-anchor="middle">N</text></g>' +
    '<g class="hm-scale" transform="translate(30 790)"><line x1="0" y1="0" x2="115" y2="0"/><line x1="0" y1="-4" x2="0" y2="4"/><line x1="115" y1="-4" x2="115" y2="4"/><text x="57" y="-6" font-size="10" text-anchor="middle">1 MILE</text></g>';

  P.sd = {
    code: "sd",
    short: "SD",
    title: "San Diego Bay",
    src: "◆ SAN DIEGO",
    aria: "San Diego Bay — the Port of San Diego and National City, every dock Local 29 works",
    hint: "⚠ research pass not done — gates and lines to confirm",
    svg: SVG,
    terminals: TERMS,
    groups: [["SD", "Port of San Diego"], ["NC", "National City"], ["YD", "Halls & offices"]],
    groupOf: function (t) {
      var b = String(t.berths || "");
      if (/^SD National/.test(b)) return "NC";
      if (/Harbor Police/.test(b)) return "YD";
      if (/^SD /.test(b)) return "SD";
      return "YD";
    },
    legend: [["hm-la", "hm-la-line", "Port of San Diego"], ["hm-lb", "hm-lb-line", "National City"]],
    lore: {
      ports: {
        SD: { name: "Port of San Diego", kicker: "The Embarcadero · Tenth Avenue · the bay", text: [
          "The Port District was formed in 1962 to run the tidelands of five cities around the bay — San Diego, National City, Chula Vista, Imperial Beach and Coronado. Before that the waterfront belonged to the Navy, the tuna fleet and the Santa Fe.",
          "Tenth Avenue Marine Terminal opened in 1959 as the general-cargo pier of a Navy town: breakbulk, bulk, refrigerated fruit and, lately, wind-turbine blades. It is the longshore work on the city side.",
          "The B Street pier took the cruise ships when the cargo moved south; the Coronado Bridge opened August 2, 1969 and ended the ferry."
        ] },
        NC: { name: "National City", kicker: "The auto port", text: [
          "National City Marine Terminal is where the cars come off: Pasha’s ro-ro terminal handles more vehicles than anywhere else on the bay, with the rail yard right behind it.",
          "ILWU Local 29’s hall is on Bay Marina Drive, within sight of the terminal. ⚠ The research pass for this hall is not done — numbers, gates and the dispatch shape are still to confirm."
        ] }
      },
      docks: {
        "Port of San Diego|SD 10th Ave": "Tenth Avenue Marine Terminal — the breakbulk and bulk pier on the city side. ⚠ gate and address to confirm.",
        "Pasha|SD National City": "National City Marine Terminal — Pasha autos and ro-ro, the biggest longshore work on the bay. ⚠ gate to confirm.",
        "Port of San Diego|SD Broadway Pier": "Broadway Pier, next to B Street — the second cruise berth and the Navy’s ferry landing to North Island.",
        "Dole|SD Dole · TAMT": "Dole’s fresh-fruit ships call at Tenth Avenue — bananas and pineapple on pallets, longshore work on the city side. ⚠ confirm.",
        "Harbor Police|SD Harbor Police": "Port of San Diego Harbor Police, 24-hour dispatch (619) 686-6272. ⚠ confirm — the research pass has not been done.",
        "Port of San Diego|SD B Street": "B Street Cruise Ship Terminal on the Embarcadero. ⚠ confirm whether Local 29 casuals work the passenger calls.",
        "ILWU Local 29|Local 29 Hall": "1000 Bay Marina Drive, National City. (619) 477-4593 · fax (619) 336-1852. ⚠ dispatch line and script unknown.",
        "PMA|PMA San Diego": "PMA San Diego, 402 West Broadway, Suite 420. (619) 321-6914."
      }
    }
  };
})();
