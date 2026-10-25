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
    assert len(data['papers'])==52
    assert Counter(p['reviewStatus'] for p in data['papers'])=={'completed':36,'skipped':16}
    assert data['editorialStage']['status']=='success'
    assert all(p['abstract'] and not p['editorialRerankFallback'] for p in data['papers'])

def test_review_success_does_not_conceal_collection_gaps():
    data=issue();quality=data['publicationQuality']
    assert quality['status']=='review_verified_source_coverage_partial'
    assert quality['screeningRetryAudit']['auditStatus']=='recovered_retry_verified'
    assert quality['screeningRetryAudit']['validatedDecisions']==4691
    assert quality['screeningRetryAudit']['sourceAggregateStatus']=='partial'
    assert len(quality['collectionCoverage']['rateLimitedJournalQueries'])==7
    comp=next(t for t in data['trackers'] if t['key']=='compbio')
    assert comp['sourceCoverageStatus']=='partial' and comp['qualityNoteKo']

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
