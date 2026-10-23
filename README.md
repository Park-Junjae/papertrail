# Papertrail Public

Public static build of the lab's weekly literature tracker.

The site contains normalized tracker summaries and weekly paper reviews. It does not contain tracker source code, `.env` files, API keys, SSH keys, or raw credentials.

## Collections

- [Genome Editing — One Year in Review](https://park-junjae.github.io/papertrail/special.html): verified partial edition, **조사 진행 중**, not an exhaustive annual bibliography.
- [Journal Meeting Archive](https://park-junjae.github.io/papertrail/journal-meetings.html): searchable supplied paper records, without presenter information. Dates are supplied folder labels, not confirmed attendance dates.

See [collection scope, limitations and safe future imports](COLLECTIONS.md).
The importer is local-only and makes no model or bibliographic API calls.
Existing weekly JSON and ranking formulas are unchanged.

Validation: `python -m pytest tests/test_collections.py -q` and
`node --test tests/identity.test.js` (development tools, not required by the site).
