from collections import Counter
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from paper_identity import match_record

def issue():return json.loads((ROOT/'data/20261023.json').read_text(encoding='utf-8'))

def test_oct23_review_statuses_are_not_inflated():
    data=issue()
    assert len(data['papers'])==73
    assert Counter(p['reviewStatus'] for p in data['papers'])=={'completed':57,'skipped':16}
    assert data['editorialStage']['status']=='success'
    assert all(p['abstract'] and not p['editorialRerankFallback'] for p in data['papers'])

def test_repaired_sources_have_complete_coverage_and_preserve_original_runs():
    data=issue();quality=data['publicationQuality']
    assert quality['status']=='source_coverage_repaired_reviews_verified'
    assert quality['preprintReusedDecisions']==4691 and quality['preprintLateCandidates']==225
    assert quality['previousIssuePreservedByStrictUnion']
    for tracker in data['trackers']:
        assert tracker['sourceCoverageStatus']=='success'
        assert all(row['status'] in {'success','zero_results'} for row in tracker['collectionCoverage'])
        assert len(tracker['sourceRuns'])>=2
    source=data['publicationProvenance']['sources']['flagship']
    cell=next(row for row in source['coverage'] if row['journal']=='Cell' and row['source']=='PubMed independent discovery')
    assert cell['eligible']==12
    assert all(source['repairProvenance']['priorFailuresPreserved'] for source in data['publicationProvenance']['sources'].values())


def test_missing_gene_writing_paper_is_reviewed_and_readable():
    paper=next(p for p in issue()['papers'] if p['doi']=='10.1016/j.cell.2026.09.054')
    assert paper['reviewStatus']=='completed' and paper['mainPageEligible']
    assert paper['published']=='2026-10-21' and paper['shortSummary']
    assert '본문 검증' not in paper['blurb'] and '근거는 아직' not in paper['takeaway']

def test_public_digest_has_no_private_lab_followups():
    data=issue()
    for paper in data['papers']:
        assert 'labUse' not in paper and 'nextAction' not in paper
    for rows in data['digest']['sections'].values():
        for row in rows:
            assert 'labUse' not in row and 'nextAction' not in row
    assert 'fastFollowerOpportunities' not in data['digest']['sections']

def test_new_week_is_searchable_in_shared_catalog_and_policy_is_preserved():
    data=issue()
    catalog=json.loads((ROOT/'data/meeting_archive_catalog.json').read_text(encoding='utf-8'))['papers']
    assert all(match_record(p,catalog)[0] for p in data['papers'])
    design=next(p for p in data['papers'] if p['doi']=='10.1038/s41586-026-11205-z')
    assert design['standaloneProteinDesign'] and not design['mainPageEligible']
    assert design['lensRanks']['lab']<=49 and design['lensRanks']['computational']<=59
