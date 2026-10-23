(function (root) {
  "use strict";
  const normalizeDoi = value => String(value || "").trim().toLowerCase().replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi\s*:\s*)/, "").replace(/[.,;]+$/, "");
  const doi = value => /^10\.\d{4,9}\/\S+$/.test(normalizeDoi(value)) ? normalizeDoi(value) : "";
  const title = value => String(value || "").normalize("NFKC").toLowerCase().replace(/ß/g,"ss").replace(/ς/g,"σ").replace(/&/g," and ").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
  function index(papers = []) {
    const byDoi = new Map(), byTitle = new Map();
    for (const p of papers) {
      for (const [map, key] of [[byDoi, doi(p.doi || p.paperDoi)], [byTitle, title(p.title || p.paperTitle)]]) {
        if (!key) continue;
        if (!map.has(key)) map.set(key, []);
        if (!map.get(key).some(x => x.id === p.id)) map.get(key).push(p);
      }
    }
    return {byDoi, byTitle};
  }
  function match(paper, lookup) {
    const d = doi(paper.doi || paper.paperDoi);
    const ds = d ? lookup.byDoi.get(d) || [] : [];
    if (ds.length === 1) return ds[0];
    if (ds.length > 1) return null;
    const ts = lookup.byTitle.get(title(paper.title || paper.paperTitle)) || [];
    if (ts.length !== 1 || (d && doi(ts[0].doi) && d !== doi(ts[0].doi))) return null;
    return ts[0];
  }
  function events(paper, lookup, history) {
    const found = match(paper, lookup);
    return found ? (history.events || []).filter(e => e.paperId === found.id) : [];
  }
  const api = {doi, title, index, match, events};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PaperIdentity = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
