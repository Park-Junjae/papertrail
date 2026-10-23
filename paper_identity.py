"""Conservative shared paper identity for local, network-free collection tooling."""
import hashlib
import re
import unicodedata


def normalize_doi(value):
    text = str(value or "").strip().lower()
    text = re.sub(r"^(?:https?://(?:dx\.)?doi\.org/|doi\s*:\s*)", "", text)
    return text.rstrip(".,;") if re.fullmatch(r"10\.\d{4,9}/\S+", text) else ""


def normalize_title(value):
    text = unicodedata.normalize("NFKC", str(value or "")).casefold().replace("&", " and ")
    return " ".join("".join(c if c.isalnum() else " " for c in text).split())


def stable_id(record):
    doi = normalize_doi(record.get("doi") or record.get("paperDoi"))
    key = "doi:" + doi if doi else "title:" + normalize_title(record.get("title") or record.get("paperTitle"))
    if key == "title:":
        raise ValueError("Paper identity requires title or DOI")
    return "paper-" + hashlib.sha256(key.encode()).hexdigest()[:16]


def match_record(record, catalog):
    doi = normalize_doi(record.get("doi") or record.get("paperDoi"))
    by_doi = [p for p in catalog if doi and normalize_doi(p.get("doi")) == doi]
    if len(by_doi) == 1:
        return by_doi[0], "doi", []
    if len(by_doi) > 1:
        return None, "ambiguous", [p["id"] for p in by_doi]
    title = normalize_title(record.get("title") or record.get("paperTitle"))
    by_title = [p for p in catalog if title and normalize_title(p.get("title")) == title]
    if len(by_title) == 1 and not (doi and normalize_doi(by_title[0].get("doi")) not in ("", doi)):
        return by_title[0], "normalized_title", []
    return None, "ambiguous" if by_title else "new", [p["id"] for p in by_title]
