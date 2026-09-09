import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons, isCorrect, isComplete } from '../lib/course.ts';
test('Every retained topic has four complete exercises with varied mechanics', () => {
  assert.equal(lessons.length, 11);
  const ids = new Set();
  for (const lesson of lessons) {
    assert.equal(lesson.questions.length, 4);
    assert.equal(new Set(lesson.questions.map((q) => q.type)).size, 4);
    for (const q of lesson.questions) {
      assert.ok(!ids.has(q.id));
      ids.add(q.id);
      assert.equal(q.options.length, 3);
      assert.ok(q.hint && q.explanation && q.context);
      assert.ok(isComplete(q, q.answer));
      assert.ok(isCorrect(q, q.answer));
      assert.ok(!isCorrect(q, []));
      assert.ok(!isComplete(q, [-1]));
      assert.ok(!isComplete(q, [100]));
      if (q.type === 'pairs') {
        assert.equal(q.left.length, q.answer.length);
        assert.equal(new Set(q.answer).size, q.answer.length);
      }
      const wrong = q.answer.map((a) => (a + 1) % 3);
      assert.ok(isComplete(q, wrong));
      assert.ok(!isCorrect(q, wrong));
      assert.ok(isCorrect(q, q.answer), 'wrong answer must not mutate the key');
    }
  }
  assert.equal(ids.size, 44);
});
test('Media exercises use correct calculations and do not add undeduplicated reach', () => {
  const media = lessons.find((l) => l.id === 'media');
  assert.equal(
    media.questions[0].options[media.questions[0].answer[0]],
    String(120000 / 40000),
  );
  const budget = lessons.find((l) => l.id === 'budget');
  assert.equal(
    budget.questions[0].options[budget.questions[0].answer[0]],
    ((20000 / 200) * 1000).toLocaleString('en-US').replaceAll(',', ' '),
  );
  assert.equal(media.questions[1].answer[0], 2);
});
test('De’Longhi cascade and original lesson foundations are included', () => {
  for (const id of [
    'cascade',
    'research',
    'audience',
    'behavior',
    'channels',
    'performance',
    'metrics',
    'media',
    'budget',
    'flighting',
    'defense',
  ])
    assert.ok(lessons.some((l) => l.id === id));
  assert.match(lessons[0].questions[0].brand, /Longhi/);
});
