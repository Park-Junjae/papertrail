# PaperTrail Collections

## Scope

`special.html` is a **verified partial edition**, prominently labeled
**조사 진행 중**, for 2025-10-23 through 2026-10-23 inclusive. It follows the
actual 20-journal `cns_high_impact` preset, not just the three main journals.
The edition currently contains 34 publications: 25 have concise Korean
abstract-based interpretation; nine have verified bibliographic metadata and
explicitly pending interpretation. No full-paper evaluation is implied.
Author metadata is partial and is absent when not verified.

The five topics overlap. No Lab Rank or Computational Rank is assigned here.
Selection as a highlight does not hide other eligible papers. First online
journal publication dates govern inclusion, not preprint or issue dates.
Preprint-only, news, corrections, incidental single-gene validation, and
out-of-scope journals are excluded from this journal special.

The coverage matrix has 400 journal/period/topic cells. No cell is marked
exhaustively complete. `candidate_verified_coverage_incomplete` means that
some eligible records were verified, not that the journal was searched in
full. `not_reviewed` and zero accepted papers must never be relabeled as an
examined zero-result search. Search pagination, synonyms and journal archive
coverage remain outstanding. The candidate audit preserves rejected and
unresolved leads separately from published verified records.

## Journal Meeting Records

`journal-meetings.html` combines existing public weekly papers, the existing
corresponding-author annual collection, the special issue, and the supplied
meeting papers. It is not restricted to the special issue's date, journal or
topic scope. Preprints and older papers remain searchable here.

The initial import contains 192 historical records plus 34 recent paper
appearances: **226 records representing 224 distinct papers**. Dates are
folder labels, not independently confirmed completed presentation dates.
Twenty-two historical dates remain null. The supplied 2026-08-14 ZIP was
empty; it does not establish that no meeting or presentation occurred.
The historical list was already deduplicated, so it cannot recover all
earlier repeat appearances. A broad mitochondrial epigenetics talk without
a specific primary-paper identity was not converted into an invented paper.

The Oct 23 collection also includes a slide-only *Live-cell transcriptomics
with engineered virus-like particles* paper. Its primary article cover was
visually verified. Its folder says Oct 23 while the slide cover says Oct 21;
this discrepancy is retained as a note, not an invented confirmed date.

Per the latest user decision, presenter names, presenter filters and private
notes are **not stored or displayed**. Identical same-week PDF copies share
one record with multiple opaque evidence references. A paper appearing on
two different dates retains both events. `발표 기록 없음` means no matching
record in the supplied history, never proof that a paper was not presented.

## Append Future Records

Provide a CSV/TSV, XLSX, JSON, Markdown table or plain title list. Recommended
columns are `title`, `doi`, `journal`, `publicationYear`, `presentedAt`,
`dateBasis`, `sourceRecord`. Dates must be ISO `YYYY-MM-DD` or blank; do not
infer missing dates. `sourceRecord` should be an opaque stable identifier.
Use a new opaque source ID for each new batch, and retain it when reimporting
the same batch. Presenter and private-note columns are ignored.

From a local clone (Python 3.10+, optional `openpyxl` for XLSX):

```sh
python scripts/import_journal_meetings.py new-records.csv \
  --source-id meeting-batch-20261030 \
  --history data/journal_meetings.json \
  --catalog data/meeting_archive_catalog.json \
  --audit-dir ../papertrail-private-import-audit
```

Raw inputs and diagnostics stay in the private audit directory **outside**
the public checkout. Never commit that directory. Review ambiguous matches,
fuzzy suggestions, invalid rows, duplicate-event warnings and missing dates.
Exact DOI, then unique exact normalized title are the only automatic matches.
Contradictory DOIs and ambiguous titles do not auto-merge. Fuzzy suggestions
require manual confirmation; unrelated scientific papers remain separate.
Reimporting the same stable source records is idempotent. Independent events
are append-only and never overwrite older presentations.

Review only the two changed new JSON collections, run identity/import and UI
checks, then make a targeted normal Git commit and push. No website rebuild,
weekly tracker run or model call is required. Never regenerate `latest.json`,
weekly dated JSON, `archive_manifest.json` or the corresponding-author files.

## Research Maintenance

Private source workspace research checkpoints include the exact journal
configuration snapshot, coverage checkpoint, matrix and candidate ledger.
Continue public browser/publisher research from incomplete coverage cells.
Respect access controls; mark unavailable abstract interpretation pending.
Verify title, actual journal, first online publication date and original DOI
URL before promoting any candidate. Preserve metadata-only status separately
from completed scientific interpretation. Local organizing scripts make no
external bibliographic or LLM calls.

The new datasets are independent of the frozen weekly archives. The shared
identity resolver overlays meeting badges without changing scientific scores,
weekly content or corresponding-author evidence.
