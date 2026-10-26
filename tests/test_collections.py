import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from paper_identity import match_record,normalize_title
from scripts.import_journal_meetings import import_records,clean_record

def read(name): return json.loads((ROOT/'data'/name).read_text(encoding='utf-8'))

def test_special_scope_and_dates():
    issue=read('special/genome_editing_2025_2026.json')
    assert issue['coverageLabelKo']=='조사 진행 중'
    assert len(issue['journalScope']['journals'])==20
    assert len(issue['papers'])>=30
    assert len({p['doi'] for p in issue['papers']})==len(issue['papers'])
    for paper in issue['papers']:
        assert paper['journal'] in issue['journalScope']['journals']
        assert '2025-10-23'<=paper['firstPublishedOnline']<='2026-10-23'
        assert paper['sourceEvidence'] and paper['verificationStatus']=='verified'
        assert paper['keyFindingKo'] or paper['interpretationStatus']=='pending'

def test_collection_notices_not_rendered_but_audit_metadata_preserved():
    special=(ROOT/'special.html').read_text(encoding='utf-8')
    meetings=(ROOT/'journal-meetings.html').read_text(encoding='utf-8')
    script=(ROOT/'collections.js').read_text(encoding='utf-8')
    for removed_id in ['coverage-label', 'coverage-note', 'history-qualification', 'coverage-gaps']:
        assert f'id="{removed_id}"' not in special+meetings
        assert f"$('{removed_id}')" not in script
    for notice in ['조사 진행 중', '자료 범위와 누락', '실제 발표 완료일', '발표 기록 없음은 제공된 목록에서']:
        assert notice not in special+meetings+script
    assert read('special/genome_editing_2025_2026.json')['coverageStatus']=='in_progress'
    assert read('journal_meetings.json')['coverageGaps']

def test_meeting_history_integrity_and_privacy():
    history=read('journal_meetings.json')
    catalog=read('meeting_archive_catalog.json')['papers']
    assert len(history['events'])>=226
    assert len({e['paperId'] for e in history['events']})>=224
    assert sum(not e['presentedAt'] for e in history['events'])>=22
    assert all(e['paperId'] in {p['id'] for p in catalog} for e in history['events'])
    photoswitch=[e for e in history['events'] if e['paperDoi']=='10.1016/j.cell.2026.09.005']
    assert len(photoswitch)==2
    assert {e['presentedAt'] for e in photoswitch}=={'2026-10-16','2026-10-23'}
    serialized=json.dumps(history)
    assert all(forbidden not in serialized for forbidden in ['presenters','presenter','@','.pptx','.pdf','C:\\','D:\\','/home/'])

def test_identity_does_not_merge_related_or_conflicting_papers():
    catalog=[{'id':'a','title':'Prime editing: A & B','doi':'10.1234/a'}]
    assert normalize_title('PRIME–EDITING A and B')==normalize_title(catalog[0]['title'])
    assert match_record({'title':'PRIME–EDITING A and B'},catalog)[0]['id']=='a'
    assert match_record({'title':'Prime editing A and C'},catalog)[0] is None
    assert match_record({'title':catalog[0]['title'],'doi':'10.1234/b'},catalog)[0] is None

def test_repeat_missing_date_idempotence_no_presenters():
    rows=[{'title':'Alpha','doi':'10.1234/a','presentedAt':d,'presenters':['Private'],'sourceRecord':f'row-{i}'}
          for i,d in enumerate(['2026-10-16','2026-10-23',None])]
    catalog=[]
    history,_=import_records(rows,{'events':[]},catalog,'source-01')
    second,_=import_records(rows,history,catalog,'source-01')
    assert len(second['events'])==3 and second['events'][-1]['presentedAt'] is None
    assert len(catalog)==1 and 'Private' not in json.dumps(history)
    assert import_records([],{'events':[]},[],'empty')[0]['historyStatus']=='pending'

def test_invalid_calendar_date_rejected():
    import pytest
    with pytest.raises(ValueError): clean_record({'title':'Alpha','presentedAt':'2026-02-31'},1,'input')


def test_manual_presentation_records_keep_dates_unknown():
    expected = {'10.1038/s41586-026-10460-4', '10.1038/s41587-026-03149-6',
                '10.1038/s41586-026-10794-z', '10.1038/s41586-026-10395-w',
                '10.1038/s41587-025-02995-0', '10.1126/science.aed6123'}
    events = read('journal_meetings.json')['events']
    manual = [e for e in events if e['recordBasis'] == 'user_reported_presentation']
    assert {e['paperDoi'] for e in manual} == expected
    assert len(manual) == len(expected)
    assert all(e['presentedAt'] is None and e['recordedAt'] == '2026-10-26' for e in manual)
    script = (ROOT / 'collections.js').read_text(encoding='utf-8')
    assert '발표 여부 미등록' in script
    assert '발표 기록 없음 · 제공 목록 기준' not in script
