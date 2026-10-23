"""Append supplied history without network calls; raw input stays in private audit storage."""
import argparse
import csv
from datetime import date as calendar_date
from difflib import SequenceMatcher
import hashlib
import io
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from paper_identity import match_record, normalize_doi, normalize_title, stable_id


def read_records(path):
    suffix = path.suffix.lower()
    if suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        return data if isinstance(data, list) else data.get("events", data.get("records", []))
    if suffix in {".csv", ".tsv"}:
        return list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8-sig")), delimiter="\t" if suffix == ".tsv" else ","))
    if suffix == ".xlsx":
        from openpyxl import load_workbook
        sheet = load_workbook(path, read_only=True, data_only=True).active
        rows = list(sheet.values)
        return [dict(zip(rows[0], row)) for row in rows[1:]]
    text = path.read_text(encoding="utf-8-sig")
    records, date = [], None
    for line in text.splitlines():
        header = re.match(r"### (\d{4}-\d{2}-\d{2}|날짜 미상)", line)
        if header:
            date = None if header[1] == "날짜 미상" else header[1]
        club = re.match(r"- \*\*.+?\*\* · (.+) \[(.+), (\d{4})\] — (.+?) · `(JC-\d+)`", line)
        if club:
            records.append(dict(paperTitle=club[1], journal=club[2], publicationYear=int(club[3]),
                                paperDoi=club[4], presentedAt=date, sourceRecord=club[5], dateBasis="folder_label"))
    if records:
        return records
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if lines and lines[0].startswith("|"):
        headers = [p.strip() for p in lines[0].strip("|").split("|")]
        return [dict(zip(headers, [p.strip() for p in line.strip("|").split("|")])) for line in lines[2:]]
    return [{"paperTitle": re.sub(r"^(?:[-*]|\d+[.)])\s+", "", line)} for line in lines
            if not line.startswith("#")]


def clean_record(row, index, source_id):
    title = str(row.get("paperTitle") or row.get("title") or row.get("Title") or row.get("논문명") or "").strip()
    doi = normalize_doi(row.get("paperDoi") or row.get("doi") or row.get("DOI"))
    date = row.get("presentedAt") or row.get("presentationDate") or row.get("Date") or row.get("날짜")
    if hasattr(date, "isoformat"):
        date = date.isoformat()[:10]
    if date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(date)):
        raise ValueError("Invalid or ambiguous presentation date; leave it null for manual review")
    if date:
        calendar_date.fromisoformat(str(date))
    reference = str(row.get("sourceRecord") or f"{source_id}-row-{index:04}")
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", reference):
        reference = f"{source_id}-row-{index:04}"
    return {"paperTitle": title, "paperDoi": doi or None, "presentedAt": date or None,
            "journal": str(row.get("journal") or row.get("Journal") or ""),
            "publicationYear": row.get("publicationYear") or row.get("Year") or None,
            "dateBasis": row.get("dateBasis") if row.get("dateBasis") in {"folder_label", "confirmed_by_user"} else "user_supplied", "sourceRecord": reference}


def import_records(rows, existing, catalog, source_id):
    result = json.loads(json.dumps(existing))
    events = result.setdefault("events", [])
    seen = {e["eventId"] for e in events}
    diagnostics = {"matched": [], "newPapers": [], "ambiguous": [], "fuzzySuggestions": [],
                   "potentialDuplicateEvents": [], "missingDates": [], "invalid": []}
    for index, row in enumerate(rows, 1):
        try:
            clean = clean_record(row, index, source_id)
            if not clean["paperTitle"]:
                raise ValueError("Missing paper title")
        except ValueError as error:
            diagnostics["invalid"].append({"row": index, "reason": str(error)})
            continue
        paper, method, candidates = match_record(clean, catalog)
        if method == "ambiguous":
            diagnostics["ambiguous"].append({"row": index, "candidates": candidates})
        if not paper:
            paper = {"id": stable_id(clean), "title": clean["paperTitle"], "doi": clean["paperDoi"],
                     "journal": clean["journal"], "publicationYear": clean["publicationYear"],
                     "url": "https://doi.org/" + clean["paperDoi"] if clean["paperDoi"] else "",
                     "metadataBasis": "supplied_meeting_record"}
            if not any(p["id"] == paper["id"] for p in catalog):
                for p in catalog:
                    similarity = SequenceMatcher(None, normalize_title(paper["title"]), normalize_title(p["title"])).ratio()
                    if similarity >= 0.9:
                        diagnostics["fuzzySuggestions"].append({"row": index, "candidateId": p["id"], "similarity": round(similarity, 3), "requiresConfirmation": True})
                catalog.append(paper)
            diagnostics["newPapers"].append({"row": index, "paperId": paper["id"]})
        else:
            diagnostics["matched"].append({"row": index, "paperId": paper["id"], "method": method})
        raw_identity = source_id + "|" + clean["sourceRecord"]
        event_id = "event-" + hashlib.sha256(raw_identity.encode()).hexdigest()[:16]
        if event_id in seen:
            continue
        duplicate = [e["eventId"] for e in events if e["paperId"] == paper["id"] and e.get("presentedAt") == clean["presentedAt"]]
        if duplicate:
            diagnostics["potentialDuplicateEvents"].append({"row": index, "existingEventIds": duplicate})
        if not clean["presentedAt"]:
            diagnostics["missingDates"].append(index)
        events.append({"eventId": event_id, "paperId": paper["id"], "paperTitle": paper["title"],
                       "paperDoi": paper.get("doi"), "presentedAt": clean["presentedAt"],
                       "dateBasis": clean["dateBasis"], "sourceRecord": clean["sourceRecord"],
                       "recordBasis": "supplied_history_not_attendance_confirmation"})
        seen.add(event_id)
    result["historyStatus"] = "partial" if events else "pending"
    return result, diagnostics


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--history", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--audit-dir", type=Path, required=True)
    args = parser.parse_args()
    audit = args.audit_dir.resolve()
    if any(audit.is_relative_to(folder.resolve()) for folder in [ROOT / "papertrail_public", ROOT / "tracker_web/static", ROOT / "tracker_web/data"]):
        raise ValueError("Raw audit input must stay outside publicly served folders")
    if args.history.stem == "latest" or re.fullmatch(r"\d{8}", args.history.stem):
        raise ValueError("The importer must not overwrite weekly archives")
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", args.source_id):
        raise ValueError("Use an opaque public source ID, not a path or person's name")
    args.audit_dir.mkdir(parents=True, exist_ok=True)
    raw = args.input.read_bytes()
    (args.audit_dir / (args.source_id + args.input.suffix)).write_bytes(raw)
    history = json.loads(args.history.read_text(encoding="utf-8")) if args.history.exists() else {"events": []}
    catalog = json.loads(args.catalog.read_text(encoding="utf-8")) if args.catalog.exists() else {"papers": []}
    result, diagnostics = import_records(read_records(args.input), history, catalog["papers"], args.source_id)
    for path, data in ((args.history, result), (args.catalog, catalog)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.audit_dir / (args.source_id + "-diagnostics.json")).write_text(json.dumps(diagnostics, indent=2), encoding="utf-8")
    print(json.dumps({"events": len(result["events"]), "papers": len(catalog["papers"]),
                      "diagnostics": {k: len(v) for k, v in diagnostics.items()}, "sourceSha256": hashlib.sha256(raw).hexdigest()}))


if __name__ == "__main__":
    main()
