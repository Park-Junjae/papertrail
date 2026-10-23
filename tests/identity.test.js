const test=require('node:test');
const assert=require('node:assert/strict');
const I=require('../paper-identity.js');
test('conservative DOI and punctuation-normalized title identity',()=>{
  const paper={id:'a',doi:'10.1234/a',title:'Prime editing: A & B'};
  const idx=I.index([paper]);
  assert.equal(I.match({doi:'https://doi.org/10.1234/A'},idx),paper);
  assert.equal(I.match({title:'PRIME–EDITING A and B'},idx),paper);
  assert.equal(I.match({title:paper.title,doi:'10.1234/b'},idx),null);
  assert.equal(I.match({title:'Prime editing: A & C'},idx),null);
});
test('ambiguous title never auto merges; repeated events and null dates survive',()=>{
  const idx=I.index([{id:'a',doi:'10.1234/a',title:'Same'},{id:'b',doi:'10.1234/b',title:'Same'}]);
  assert.equal(I.match({title:'Same'},idx),null);
  const history={events:[{paperId:'a',presentedAt:'2026-10-16'},{paperId:'a',presentedAt:'2026-10-23'},{paperId:'a',presentedAt:null}]};
  assert.equal(I.events({doi:'10.1234/a'},idx,history).length,3);
});
