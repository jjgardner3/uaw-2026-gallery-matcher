/* ============ UAW Matcher engine ============ */
(function () {
  "use strict";
  const DATA = (window.GALLERIES || []).slice();

  // ---- Display labels for controlled vocab ----
  const AES_LABELS = {
    abstract: "Abstract", contemporary: "Contemporary", modern: "Modern",
    figurative: "Figurative", conceptual: "Conceptual", landscape: "Landscape / nature",
    photography: "Photography", craft: "Craft & fiber", folk: "Folk & visionary",
    design: "Design", performance: "Performance & film"
  };
  const MED_LABELS = {
    painting: "Painting", sculpture: "Sculpture", works_on_paper: "Works on paper",
    installation: "Installation", photography: "Photography", fiber_textile: "Fiber & textile",
    ceramics: "Ceramics", video_film: "Video & film", design_object: "Design objects"
  };

  // ---- Build town list grouped by region (ordered) ----
  const REGION_ORDER = ["Hudson & Columbia","Kingston & Ulster","Rhinebeck & Dutchess",
    "Beacon & Cold Spring","Catskills","Woodstock & Western Catskills","Newburgh & Orange",
    "Westchester & South","Other / Multiple"];

  // Build map of region → sorted unique towns (excluding vague catch-alls)
  const VAGUE_TOWNS = new Set(["Hudson Valley","Hudson Valley/Catskills","Catskill Mountains",
    "Ulster County","Columbia County"]);
  const townsByRegion = {};
  REGION_ORDER.forEach(r => { townsByRegion[r] = []; });
  DATA.forEach(g => {
    const r = g.region, t = g.town;
    if (r && t && townsByRegion[r] && !VAGUE_TOWNS.has(t) && !townsByRegion[r].includes(t)) {
      townsByRegion[r].push(t);
    }
  });
  REGION_ORDER.forEach(r => townsByRegion[r].sort());
  const activeRegions = REGION_ORDER.filter(r => townsByRegion[r].length > 0);
  // flat list of all valid town names (for URL restore)
  const allTowns = activeRegions.flatMap(r => townsByRegion[r]);

  // ---- Aesthetic rarity weighting ----
  // 'contemporary' is tagged on nearly every gallery, so it's a weak discriminator.
  // Rare aesthetics (abstract, conceptual, photography...) are strong signals.
  const aesFreq = {};
  DATA.forEach(g => (g.aesthetics||[]).forEach(a => aesFreq[a]=(aesFreq[a]||0)+1));
  const total = DATA.length;
  function aesWeight(a){
    const frac = (aesFreq[a]||1)/total;      // 0..1 share of galleries with this tag
    // common tags -> low weight; rare tags -> high weight. Range ~8..30.
    return Math.round(8 + (1 - frac) * 24);
  }

  // ---- State ----
  const state = { aesthetics:new Set(), mediums:new Set(), region:new Set(), days:new Set(), notable:false };

  // ---- Render chip groups ----
  function renderChips(group, entries) {
    const box = document.querySelector(`.chips[data-group="${group}"]`);
    box.innerHTML = "";
    entries.forEach(([val, label]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = label;
      b.setAttribute("aria-pressed","false"); b.dataset.val = val;
      b.addEventListener("click", () => {
        const set = state[group];
        if (set.has(val)) { set.delete(val); b.setAttribute("aria-pressed","false"); }
        else { set.add(val); b.setAttribute("aria-pressed","true"); }
      });
      box.appendChild(b);
    });
  }

  // Render chips grouped by region with subheadings + a "whole region" button
  function renderGroupedChips(group, groups) {
    const box = document.querySelector(`.chips[data-group="${group}"]`);
    box.innerHTML = "";
    groups.forEach(({label, items}) => {
      if (!items.length) return;

      // Region header row: label + "Select all" button
      const hRow = document.createElement("div");
      hRow.className = "chips-group-row";

      const h = document.createElement("span");
      h.className = "chips-group-label";
      h.textContent = label;
      hRow.appendChild(h);

      // "Select whole region" chip
      const allBtn = document.createElement("button");
      allBtn.type = "button";
      allBtn.className = "chip chip--region-all";
      allBtn.textContent = "All of " + label.split(" &")[0]; // shorten e.g. "Hudson & Columbia" → "All of Hudson"
      allBtn.setAttribute("aria-pressed","false");
      const townVals = items.map(([v]) => v);

      function updateAllBtn() {
        const set = state[group];
        const allSelected = townVals.every(v => set.has(v));
        allBtn.setAttribute("aria-pressed", allSelected ? "true" : "false");
      }

      allBtn.addEventListener("click", () => {
        const set = state[group];
        const allSelected = townVals.every(v => set.has(v));
        // Toggle: if all selected, deselect all; else select all
        townVals.forEach(v => {
          if (allSelected) { set.delete(v); }
          else { set.add(v); }
        });
        // Sync individual town chip states
        box.querySelectorAll(`.chip[data-val]`).forEach(c => {
          if (townVals.includes(c.dataset.val)) {
            c.setAttribute("aria-pressed", set.has(c.dataset.val) ? "true" : "false");
          }
        });
        updateAllBtn();
      });
      hRow.appendChild(allBtn);
      box.appendChild(hRow);

      // Individual town chips
      items.forEach(([val, chipLabel]) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "chip"; b.textContent = chipLabel;
        b.setAttribute("aria-pressed","false"); b.dataset.val = val;
        b.addEventListener("click", () => {
          const set = state[group];
          if (set.has(val)) { set.delete(val); b.setAttribute("aria-pressed","false"); }
          else { set.add(val); b.setAttribute("aria-pressed","true"); }
          updateAllBtn();
        });
        box.appendChild(b);
      });
    });
  }

  // ---- Notable toggle ----
  const notableBtn = document.getElementById("notable-toggle");
  notableBtn.addEventListener("click", () => {
    state.notable = !state.notable;
    notableBtn.setAttribute("aria-pressed", state.notable ? "true" : "false");
  });

  // ---- Day chips (hand-rendered in HTML, just wire click handlers) ----
  document.querySelectorAll('.chips[data-group="days"] .chip').forEach(b => {
    b.addEventListener("click", () => {
      const val = b.dataset.val;
      if (state.days.has(val)) { state.days.delete(val); b.setAttribute("aria-pressed","false"); }
      else { state.days.add(val); b.setAttribute("aria-pressed","true"); }
    });
  });

  // aesthetics ordered by relevance for a contemporary audience
  renderChips("aesthetics", ["abstract","contemporary","modern","conceptual","figurative","landscape","photography","design","craft","folk","performance"].map(k=>[k,AES_LABELS[k]]));
  renderChips("mediums", ["painting","sculpture","works_on_paper","installation","photography","video_film","ceramics","fiber_textile","design_object"].map(k=>[k,MED_LABELS[k]]));
  renderGroupedChips("region", activeRegions.map(r => ({
    label: r,
    items: townsByRegion[r].map(t => [t, t])
  })));

  // ---- Scoring ----
  // Weighted: artist match is strongest signal, then aesthetics, then mediums.
  function scoreGallery(g) {
    let score = 0;
    const reasons = [];
    const noTaste = state.aesthetics.size===0 && state.mediums.size===0;

    // Aesthetic overlap — weighted by rarity (rare tastes matched = stronger signal)
    const aesHits = (g.aesthetics||[]).filter(a => state.aesthetics.has(a));
    if (aesHits.length) {
      aesHits.forEach(a => { score += aesWeight(a); });
      // reward galleries that match a meaningful share of what was selected
      if (state.aesthetics.size) score += (aesHits.length / state.aesthetics.size) * 14;
      const strong = aesHits.filter(a => aesWeight(a) >= 16); // name the distinctive matches
      const named = (strong.length ? strong : aesHits).map(a=>AES_LABELS[a].toLowerCase());
      reasons.push(`Matches your taste for <b>${named.join(", ")}</b>`);
    }

    // Medium overlap
    const medHits = (g.mediums||[]).filter(m => state.mediums.has(m));
    if (medHits.length) {
      score += medHits.length*16;
      if (state.mediums.size) score += (medHits.length / state.mediums.size) * 10;
      reasons.push(`Strong in <b>${medHits.map(m=>MED_LABELS[m].toLowerCase()).join(", ")}</b>`);
    }

    // Notable / blue-chip boost (gentle — quality signal, not the whole story)
    if (g.notable) { score += 14; }

    // If no taste given at all, surface notable programs first
    if (noTaste && g.notable) { score += 40; }

    return { score, reasons, aesHits, medHits };
  }

  // ---- Google Maps directions export ----
  const VAGUE_LOCS = new Set(["Hudson Valley, NY","Hudson Valley/Catskills, NY",
    "Catskill Mountains, NY","Ulster County, NY","Columbia County, NY"]);

  function buildMapsUrl(t1, t2, t3) {
    // Up to 9 stops, Tier 1 first, then 2, then 3; skip vague regional locations
    const stops = [...t1, ...t2, ...t3]
      .filter(x => !VAGUE_LOCS.has(x.g.location))
      .slice(0, 9)
      .map(x => encodeURIComponent(x.g.name + ", " + x.g.location));
    return stops.length ? "https://www.google.com/maps/dir/" + stops.join("/") : null;
  }

  // ---- Google Maps embed ----
  let _gmap = null;
  let _infoWindow = null;
  // Callback registered as Maps JS API loads async
  window._onMapsReady = function() { window._mapsReady = true; };

  // Town-level fallback coords for the 5 venues without exact geocoding
  const TOWN_FALLBACK = window.TOWN_COORDS || {};

  function getCoords(g) {
    if (g.lat && g.lng) return { lat: g.lat, lng: g.lng };
    if (TOWN_FALLBACK[g.location]) return { lat: TOWN_FALLBACK[g.location][0], lng: TOWN_FALLBACK[g.location][1] };
    return null;
  }

  function renderGoogleMap(t1, t2, t3) {
    const mapSection = document.getElementById("map-section");
    const mapEl = document.getElementById("result-map");

    const allItems = [
      ...t1.map(x => ({x, tier:1})),
      ...t2.map(x => ({x, tier:2})),
      ...t3.map(x => ({x, tier:3})),
    ].filter(({x}) => getCoords(x.g));

    if (!allItems.length || !window._mapsReady) { mapSection.hidden = true; return; }

    mapSection.hidden = false;
    mapEl.innerHTML = "";

    // Destroy old map
    if (_gmap) { _gmap = null; }
    if (_infoWindow) { _infoWindow.close(); _infoWindow = null; }

    const TIER_COLOR = { 1:'#5e6b54', 2:'#8a9a78', 3:'#b0ad9e' };
    const TIER_SCALE = { 1:11, 2:9, 3:7 };
    const TIER_LABEL = { 1:'Tier 1 — Don\'t miss', 2:'Tier 2 — Recommended', 3:'Tier 3 — Worth a visit' };

    _gmap = new google.maps.Map(mapEl, {
      zoom: 9,
      center: { lat: 41.9, lng: -73.95 },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [{ featureType:"poi", elementType:"labels", stylers:[{visibility:"off"}] }]
    });
    _infoWindow = new google.maps.InfoWindow();

    const bounds = new google.maps.LatLngBounds();

    allItems.forEach(({x, tier}) => {
      const g = x.g;
      const pos = getCoords(g);
      bounds.extend(pos);

      const marker = new google.maps.Marker({
        position: pos,
        map: _gmap,
        title: g.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: TIER_SCALE[tier],
          fillColor: TIER_COLOR[tier],
          fillOpacity: 0.92,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      const galleryUrl = g.website || `https://www.google.com/search?q=${encodeURIComponent(g.name + ' ' + g.location)}`;
      const content = `
        <div style="font-family:sans-serif;max-width:220px;padding:2px 4px">
          <div style="font-weight:600;font-size:14px;margin-bottom:3px">${g.name}</div>
          <div style="font-size:12px;color:#666;margin-bottom:5px">${g.location}</div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${TIER_COLOR[tier]};margin-bottom:6px">${TIER_LABEL[tier]}</div>
          <a href="${galleryUrl}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#5e6b54;font-weight:600">Visit website ↗</a>
        </div>`;

      marker.addListener('click', () => {
        _infoWindow.setContent(content);
        _infoWindow.open(_gmap, marker);
      });
    });

    _gmap.fitBounds(bounds, { top:40, right:40, bottom:40, left:40 });
  }

  // ---- My Maps CSV export ----
  function downloadMyMapsCsv(t1, t2, t3) {
    // Format optimised for Google My Maps import:
    // Using "Name, Location" as the address so Google geocodes to the actual venue.
    const header = ["Name","Address","Tier","Description","Website"];
    const rows = [header];
    const TIER_LABEL = { 1:"Tier 1 — Don't miss", 2:"Tier 2 — Recommended", 3:"Tier 3 — Worth a visit" };
    [[t1,1],[t2,2],[t3,3]].forEach(([items, tier]) => {
      items.forEach(x => {
        const g = x.g;
        rows.push([
          g.name,
          g.name + ", " + g.location,   // venue name + city helps Google find the exact place
          TIER_LABEL[tier],
          g.blurb || "",
          g.website || ""
        ]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "UAW2026-my-maps.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildCsv(t1, t2, t3) {
    const header = ["Name", "Location", "Show / Exhibition", "Tier", "Description"];
    const rows = [header];
    const addRows = (items, tierLabel) => {
      items.forEach(x => {
        const g = x.g;
        rows.push([g.name, g.location, g.show || "", tierLabel, g.blurb || ""]);
      });
    };
    addRows(t1, "Tier 1 — Don’t miss");
    addRows(t2, "Tier 2 — Recommended");
    addRows(t3, "Tier 3 — Worth a visit");
    return rows.map(r =>
      r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
  }

  function downloadCsv(t1, t2, t3) {
    const csv = buildCsv(t1, t2, t3);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "UAW2026-my-route.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- Run match ----
  const form = document.getElementById("taste-form");
  const resultsEl = document.getElementById("results");
  const tiersEl = document.getElementById("tiers");
  const summaryEl = document.getElementById("results-summary");

  form.addEventListener("submit", e => {
    e.preventDefault();
    run();
    resultsEl.hidden = false;
    requestAnimationFrame(()=>resultsEl.scrollIntoView({behavior:"smooth",block:"start"}));
  });
  document.getElementById("reset-btn").addEventListener("click",()=>{
    state.aesthetics.clear(); state.mediums.clear(); state.region.clear(); state.days.clear(); state.notable = false;
    document.querySelectorAll(".chip[aria-pressed='true']").forEach(c=>c.setAttribute("aria-pressed","false"));
    resultsEl.hidden = true;
    document.getElementById("map-section").hidden = true;
    if (_infoWindow) { _infoWindow.close(); }
    _gmap = null;
    window.scrollTo({top:document.getElementById("matcher").offsetTop-70,behavior:"smooth"});
  });

  // ---- Day helpers ----
  function hoursForDays(gallery) {
    // Returns only the hours entries matching selected days (or all if no days selected)
    const hours = gallery.hours || [];
    if (!state.days.size) return hours;
    return hours.filter(h => [...state.days].some(day => h.startsWith(day)));
  }

  function isOpenOnSelectedDays(gallery) {
    if (!state.days.size) return true;
    const hours = gallery.hours || [];
    // No hours data = unknown, not confirmed closed — include with a "check website" note
    if (!hours.length) return true;
    return hoursForDays(gallery).length > 0;
  }

  function run() {
    // town filter first (state.region now holds town names)
    let pool = DATA;
    if (state.region.size) pool = pool.filter(g => state.region.has(g.town));
    if (state.notable) pool = pool.filter(g => g.notable);
    // day filter — only show galleries open on selected day(s)
    if (state.days.size) pool = pool.filter(g => isOpenOnSelectedDays(g));

    const noTasteFilter = state.aesthetics.size === 0 && state.mediums.size === 0;
    const scored = pool.map(g => ({ g, ...scoreGallery(g) }))
      .filter(x => noTasteFilter || x.score > 0)
      .sort((a,b) => b.score - a.score || (b.g.notable - a.g.notable) || a.g.name.localeCompare(b.g.name));

    // Tiering: blend an absolute floor with a relative band so all three tiers
    // fill naturally across very different taste selections. Tier 1 stays the
    // tightest band so it reads as a genuine curated shortlist, not a dump.
    const top = scored.length ? scored[0].score : 1;
    const t1=[], t2=[], t3=[];
    scored.forEach(x => {
      const rel = x.score/top;
      // Tier 1: a genuinely strong match — near the very top of the field.
      if (x.score >= 55 || rel >= 0.82) t1.push(x);
      // Tier 2: a solid partial match.
      else if (x.score >= 22 || rel >= 0.42) t2.push(x);
      else t3.push(x);
    });
    // keep each tier a curated shortlist, not a dump
    // When a region filter is active the pool is already small, so don't cap Tier 3.
    const regionFiltered = state.region.size > 0;
    const t1cap = t1.slice(0, 10);
    const t2cap = t2.slice(0, 14);
    const t3cap = regionFiltered ? t3 : t3.slice(0, 12);

    renderSummary(scored.length, t1cap.length, t2cap.length, t3cap.length);
    renderGoogleMap(t1cap, t2cap, t3cap);
    tiersEl.innerHTML = "";
    renderTier(tiersEl, "Tier 1", "Don't miss these", "tier-1", t1cap);
    renderTier(tiersEl, "Tier 2", "Strongly recommended", "tier-2", t2cap);
    renderTier(tiersEl, "Tier 3", "Worth it if you have time", "tier-3", t3cap);

    if (scored.length === 0) {
      tiersEl.innerHTML = `<div class="empty">No close matches with those filters. Try selecting a few more art types, or widen your region.</div>`;
    }

    // Results actions bar
    const actionsEl = document.getElementById("results-actions");
    const csvBtn    = document.getElementById("csv-btn");
    const shareBtn  = document.getElementById("share-btn");
    actionsEl.hidden = scored.length === 0;
    // re-bind each run so it always uses the latest results
    csvBtn.onclick = () => downloadCsv(t1cap, t2cap, t3cap);
    if (shareBtn) {
      shareBtn.onclick = () => {
        const url = buildShareUrl();
        const prev = shareBtn.innerHTML;
        const tryClip = navigator.clipboard
          ? navigator.clipboard.writeText(url)
          : Promise.reject();
        tryClip
          .then(() => { shareBtn.textContent = '✓ Copied!'; setTimeout(() => { shareBtn.innerHTML = prev; }, 2000); })
          .catch(() => prompt("Copy this link to share your list:", url));
      };
    }
    // Google Maps directions button — create once, update href each run
    let mapsBtn = document.getElementById("maps-btn");
    if (!mapsBtn) {
      mapsBtn = document.createElement("a");
      mapsBtn.id = "maps-btn";
      mapsBtn.className = "btn btn-ghost";
      mapsBtn.target = "_blank";
      mapsBtn.rel = "noopener noreferrer";
      mapsBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Directions in Maps`;
      actionsEl.appendChild(mapsBtn);
    }
    const mapsUrl = buildMapsUrl(t1cap, t2cap, t3cap);
    mapsBtn.href = mapsUrl || "#";
    mapsBtn.hidden = !mapsUrl;

    // My Maps export button — create once, re-bind each run
    let myMapsBtn = document.getElementById("my-maps-btn");
    if (!myMapsBtn) {
      myMapsBtn = document.createElement("button");
      myMapsBtn.id = "my-maps-btn";
      myMapsBtn.type = "button";
      myMapsBtn.className = "btn btn-ghost";
      myMapsBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Save to My Maps`;
      actionsEl.appendChild(myMapsBtn);
    }
    myMapsBtn.onclick = () => downloadMyMapsCsv(t1cap, t2cap, t3cap);
  }

  function renderSummary(total, n1, n2, n3) {
    const picks = [];
    if (state.aesthetics.size) picks.push([...state.aesthetics].map(a=>AES_LABELS[a].toLowerCase()).join(", "));
    if (state.mediums.size) picks.push([...state.mediums].map(m=>MED_LABELS[m].toLowerCase()).join(", "));
    const tasteStr = picks.length ? picks.join("; ") : "a broad look at the weekend";
    const regStr = state.region.size ? ` in <strong>${[...state.region].join(", ")}</strong>` : " across the region";
    const shown = n1 + n2 + n3;
    const nudge = !picks.length && !state.region.size
      ? `<span class="results-nudge"><a href="#matcher">Pick some preferences above</a> for a more tailored list.</span>` : '';
    summaryEl.innerHTML = `Based on <strong>${tasteStr}</strong>${regStr}, we found <strong>${total}</strong> matches from all ${DATA.length} participants — here are the top <strong>${shown}</strong>, ranked for you.${nudge}`;
    // keep the footer count in sync
    const foot = document.getElementById("results-foot");
    if (foot) foot.textContent = `Matched against all ${DATA.length} UAW26 participants. This is a starting point — trust your own eye, and leave room to wander.`;
  }

  function renderTier(parent, badge, sub, cls, items) {
    if (!items.length) return;
    const sec = document.createElement("div");
    sec.className = `tier ${cls} reveal`;
    sec.innerHTML = `<div class="tier-head"><span class="tier-badge">${badge}</span><h3>${sub}</h3></div>
      <p class="tier-sub">${items.length} ${items.length===1?"gallery":"galleries"}</p>
      <div class="cards"></div>`;
    const cards = sec.querySelector(".cards");
    items.forEach(x => cards.appendChild(renderCard(x)));
    parent.appendChild(sec);
  }

  function renderCard(x) {
    const g = x.g;
    const el = document.createElement("article");
    el.className = "card" + (g.notable ? " is-notable" : "");
    const why = x.reasons.length
      ? `<p class="card-why">${x.reasons.slice(0,2).join(". ")}.</p>` : "";
    // Gallery link — prefer real website, fall back to Google search
    const galleryUrl = g.website || g.url || `https://www.google.com/search?q=${encodeURIComponent(g.name + ' ' + g.location)}`;
    const showSearchUrl = g.show
      ? `https://www.google.com/search?q=${encodeURIComponent(g.show + ' ' + g.name)}`
      : null;
    const showLine = g.show
      ? `<p class="card-show"><a class="card-link" href="${showSearchUrl}" target="_blank" rel="noopener noreferrer">${esc(g.show)} ↗</a></p>`
      : "";
    // tags: show the matched aesthetics/mediums, else the gallery's primary ones
    const tagVals = [...new Set([...(x.aesHits.length?x.aesHits:(g.aesthetics||[]).slice(0,2)).map(a=>AES_LABELS[a]),
                                 ...x.medHits.map(m=>MED_LABELS[m])])].slice(0,4);
    const tags = tagVals.length ? `<div class="card-tags">${tagVals.map(t=>`<span class="tag">${t}</span>`).join("")}</div>` : "";
    // Hours — show only selected day(s) if a day filter is active, else all
    const relevantHours = hoursForDays(g);
    const allHours = g.hours || [];
    const hoursLabel = state.days.size
      ? (relevantHours.length ? relevantHours : allHours)
      : allHours;
    const hours = hoursLabel.length
      ? `<ul class="card-hours">${hoursLabel.map(h => `<li>${esc(h)}</li>`).join("")}</ul>`
      : `<p class="card-hours-none">Hours not listed — check venue website</p>`;
    el.innerHTML = `
      <div class="card-top">
        <div><h4><a class="card-name-link" href="${galleryUrl}" target="_blank" rel="noopener noreferrer">${esc(g.name)}</a></h4></div>
        ${g.notable ? `<span class="notable-dot">★ Notable</span>` : ""}
      </div>
      <p class="card-loc">${esc(g.location)}</p>
      ${showLine}
      <p class="card-blurb">${esc(g.blurb||"")}</p>
      ${why}
      ${tags}
      <details class="card-hours-details"${state.days.size ? " open" : ""}>
        <summary>UAW Hours</summary>
        ${hours}
      </details>`;
    return el;
  }

  function esc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

  // ---- Share URL ----
  function buildShareUrl() {
    const params = new URLSearchParams();
    if (state.aesthetics.size) params.set('aes', [...state.aesthetics].join(','));
    if (state.mediums.size)    params.set('med', [...state.mediums].join(','));
    if (state.region.size)     params.set('reg', [...state.region].join('|'));
    if (state.notable)         params.set('notable', '1');
    const qs = params.toString();
    return window.location.origin + window.location.pathname + (qs ? '?' + qs : '');
  }

  // ---- Restore from shared URL ----
  function restoreFromUrl() {
    const p = new URLSearchParams(window.location.search);
    const aes = p.get('aes'), med = p.get('med'), reg = p.get('reg');
    if (!aes && !med && !reg) return;
    if (aes) aes.split(',').forEach(v => { if (AES_LABELS[v]) state.aesthetics.add(v); });
    if (med) med.split(',').forEach(v => { if (MED_LABELS[v]) state.mediums.add(v); });
    if (reg) reg.split('|').forEach(v => { if (allTowns.includes(v)) state.region.add(v); });
    if (p.get('notable') === '1') { state.notable = true; notableBtn.setAttribute('aria-pressed','true'); }
    // reflect selections in chip UI
    document.querySelectorAll('.chip').forEach(c => {
      const grp = c.closest('[data-group]');
      if (grp && state[grp.dataset.group] && state[grp.dataset.group].has(c.dataset.val)) {
        c.setAttribute('aria-pressed', 'true');
      }
    });
    // auto-run and scroll to results
    run();
    resultsEl.hidden = false;
    setTimeout(() => resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }
  restoreFromUrl();
})();
