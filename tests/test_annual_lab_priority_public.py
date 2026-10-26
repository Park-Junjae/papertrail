"""Standalone publication contract; contains no private source paths or credentials."""
import json
from pathlib import Path


def annual():
    root = Path(__file__).resolve().parents[1]
    if (root / 'papertrail_public').is_dir():
        root = root / 'papertrail_public'
    return json.loads((root / 'data/special/genome_editing_2025_2026.json').read_text(encoding='utf-8'))


def test_all_frozen_annual_papers_have_manual_lab_digests_and_scores():
    document = annual()
    papers = document['papers']
    assert len(papers) == len({p['doi'] for p in papers}) == 617
    assert document['labReview']['reviewedPapers'] == 617
    assert document['labReview']['providerCalls'] == 0
    assert document['coverageStatus'] == 'in_progress'
    scores = []
    for index, paper in enumerate(papers, 1):
        review = paper['genomeEditingReview']
        assert review['status'] == 'complete'
        assert review['rank'] == index
        assert review['score'] == sum(review['components'].values())
        for key, maximum in dict(directEditing=45, reusableMethod=25, strategyValue=20, conceptualAdvance=10).items():
            assert type(review['components'][key]) is int
            assert 0 <= review['components'][key] <= maximum
        assert all(review.get(k) for k in ['digestKo', 'labUseKo', 'knowledgeKo', 'questionKo', 'scoreReasonKo', 'sourceUrl'])
        scores.append(review['score'])
    assert scores == sorted(scores, reverse=True)


def test_routine_crispr_mechanism_is_not_an_editor_priority():
    papers = {p['doi']: p for p in annual()['papers']}
    neat1 = papers['10.1093/nar/gkag1015']['genomeEditingReview']
    writing = papers['10.1016/j.cell.2026.09.054']['genomeEditingReview']
    assert neat1['score'] <= 24
    assert neat1['components']['directEditing'] <= 6
    assert writing['score'] >= 85
    assert writing['rank'] < neat1['rank']
