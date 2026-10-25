const test=require('node:test');
const assert=require('node:assert/strict');
const {trackerQualityNoteMarkup,reviewStatusMarkup}=require('../app.js');
test('quality warnings remain visible and escaped',()=>{
  assert.equal(trackerQualityNoteMarkup({}),'');
  const markup=trackerQualityNoteMarkup({qualityNoteKo:'수집 범위 일부 누락 <script>bad()</script>'});
  assert.ok(markup.includes('수집 범위 일부 누락'));
  assert.ok(!markup.includes('<script>'));
});
test('candidate analysis is not represented as completed deep review',()=>{
  assert.ok(reviewStatusMarkup({reviewStatus:'skipped'}).includes('심층 리뷰 미실시'));
  assert.equal(reviewStatusMarkup({reviewStatus:'completed'}),'');
});
