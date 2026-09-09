'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Lightbulb,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { lessons, isCorrect, isComplete, type Question } from '@/lib/course';
const STORAGE = 'soba-practice-v1';
const labels = {
  choice: 'Выбери ответ',
  blank: 'Заполни пропуск',
  odd: 'Найди лишнее',
  pairs: 'Соедини пары',
};
type Registry = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export default function Home() {
  const [lessonIndex, setLessonIndex] = useState<number | null>(null),
    [step, setStep] = useState(0),
    [selected, setSelected] = useState<number[]>([]),
    [feedback, setFeedback] = useState<'wrong' | 'correct' | null>(null),
    [hint, setHint] = useState(false),
    [missed, setMissed] = useState<string[]>([]),
    [done, setDone] = useState<string[]>([]),
    [ready, setReady] = useState(false),
    [review, setReview] = useState<string[] | null>(null),
    [storageAvailable, setStorageAvailable] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const lesson = lessonIndex === null ? null : lessons[lessonIndex];
  const questions = lesson
    ? review
      ? lesson.questions.filter((q) => review.includes(q.id))
      : lesson.questions
    : [];
  const finished = !!lesson && step >= questions.length;
  const question = questions[step];
  useEffect(() => {
    try {
      const x = JSON.parse(localStorage.getItem(STORAGE) || '[]');
      if (Array.isArray(x))
        setDone(
          x.filter(
            (id: unknown) =>
              typeof id === 'string' && lessons.some((l) => l.id === id),
          ),
        );
    } catch {
      setStorageAvailable(false);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(STORAGE, JSON.stringify(done));
      } catch {
        setStorageAvailable(false);
      }
  }, [done, ready]);
  useEffect(() => {
    if (lessonIndex !== null) heading.current?.focus();
  }, [lessonIndex, step, review]);
  const clear = () => {
    setSelected([]);
    setFeedback(null);
    setHint(false);
  };
  const start = (i: number) => {
    setLessonIndex(i);
    setStep(0);
    setMissed([]);
    setReview(null);
    clear();
  };
  const home = () => {
    setLessonIndex(null);
    setReview(null);
    clear();
  };
  const choose = (row: number, value: number) => {
    if (feedback === 'correct') return;
    setSelected((prev) => {
      const n = Array(question.answer.length).fill(-1);
      prev.forEach((v, i) => (n[i] = v));
      n[row] = value;
      return n;
    });
    setFeedback(null);
  };
  const check = () => {
    if (!question || feedback === 'correct' || !isComplete(question, selected))
      return;
    if (isCorrect(question, selected)) {
      setFeedback('correct');
    } else {
      setFeedback('wrong');
      setHint(true);
      setMissed((prev) =>
        prev.includes(question.id) ? prev : [...prev, question.id],
      );
    }
  };
  const next = () => {
    if (feedback !== 'correct' || !lesson) return;
    if (step === questions.length - 1 && !review)
      setDone((prev) =>
        prev.includes(lesson.id) ? prev : [...prev, lesson.id],
      );
    setStep(step + 1);
    clear();
  };
  const actions = useRef({
    start,
    check,
    next,
    choose,
    lessonIndex,
    step,
    question,
    selected,
    feedback,
    finished,
    done,
  });
  actions.current = {
    start,
    check,
    next,
    choose,
    lessonIndex,
    step,
    question,
    selected,
    feedback,
    finished,
    done,
  };
  useEffect(() => {
    const registry = (document as Document & { modelContext?: Registry })
      .modelContext;
    if (!registry?.registerTool) return;
    const life = new AbortController();
    const register = (tool: Parameters<Registry['registerTool']>[0]) => {
      try {
        Promise.resolve(
          registry.registerTool(tool, { signal: life.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'get_practice_state',
      title: 'Состояние практики',
      description:
        'Read lessons and the current exercise, without revealing the answer.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => {
        const s = actions.current;
        return {
          lessons: lessons.map((l) => ({ id: l.id, title: l.title })),
          lessonIndex: s.lessonIndex,
          step: s.step,
          finished: s.finished,
          completed: s.done,
          question: s.question
            ? {
                id: s.question.id,
                type: s.question.type,
                prompt: s.question.prompt,
                context: s.question.context,
                options: s.question.options,
                left: s.question.left,
              }
            : null,
          feedback: s.feedback,
        };
      },
    });
    register({
      name: 'start_practice_lesson',
      title: 'Открыть миссию',
      description:
        'Start or restart a lesson. Clears the current unfinished attempt.',
      inputSchema: {
        type: 'object',
        properties: { lessonId: { type: 'string' } },
        required: ['lessonId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        const id = (input as { lessonId?: unknown })?.lessonId;
        const i = lessons.findIndex((l) => l.id === id);
        if (i < 0) throw new Error('Unknown lesson');
        flushSync(() => actions.current.start(i));
        return { lessonId: lessons[i].id, step: 0 };
      },
    });
    register({
      name: 'submit_practice_answer',
      title: 'Проверить ответ',
      description:
        'Select option indices (one per row for matching) and check the current answer. A wrong answer allows another attempt.',
      inputSchema: {
        type: 'object',
        properties: {
          optionIndices: { type: 'array', items: { type: 'integer' } },
        },
        required: ['optionIndices'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        const s = actions.current,
          v = (input as { optionIndices?: unknown })?.optionIndices;
        if (
          !s.question ||
          s.finished ||
          s.feedback === 'correct' ||
          !Array.isArray(v) ||
          !isComplete(s.question, v)
        )
          throw new Error('No answerable exercise or invalid options');
        flushSync(() => v.forEach((x, i) => actions.current.choose(i, x)));
        flushSync(() => actions.current.check());
        return { feedback: actions.current.feedback };
      },
    });
    register({
      name: 'advance_practice',
      title: 'Следующее упражнение',
      description:
        'Advance after a correct answer; records lesson completion after its final exercise.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: () => {
        if (actions.current.feedback !== 'correct')
          throw new Error('Answer correctly first');
        flushSync(() => actions.current.next());
        return {
          step: actions.current.step,
          finished: actions.current.finished,
        };
      },
    });
    return () => life.abort();
  }, []);
  function options(q: Question, row = 0) {
    return (
      <RadioGroup
        className={q.type === 'pairs' ? 'pair-options' : undefined}
        value={selected[row] === undefined ? '' : String(selected[row])}
        onValueChange={(v) => choose(row, Number(v))}
        aria-label={q.left?.[row] || q.prompt}
        disabled={feedback === 'correct'}
      >
        {q.options.map((text, i) => (
          <label className="option" key={i}>
            <RadioGroupItem value={String(i)} />
            <span>{text}</span>
            {q.type !== 'pairs' && (
              <span className="option-letter" aria-hidden="true">
                {['А', 'Б', 'В'][i]}
              </span>
            )}
          </label>
        ))}
      </RadioGroup>
    );
  }
  return (
    <div className="shell">
      <header className="mast">
        <div className="brand" aria-label="School of Business Adaptation">
          SOBA
          <small>
            SCHOOL OF BUSINESS
            <br />
            ADAPTATION
          </small>
        </div>
        <span className="edition">
          Digital стратегия
          <br />
          Практика после занятия
        </span>
      </header>
      {!lesson ? (
        <main>
          <div className="intro">
            <div>
              <p className="eyebrow">11 миссий · 44 упражнения</p>
              <h1>
                Из стратегии
                <br />в действие<span style={{ color: '#737300' }}>.</span>
              </h1>
            </div>
            <div className="counter">
              <b>
                {done.length} / {lessons.length}
              </b>
              <p>миссий пройдено</p>
              <Progress
                value={(done.length / lessons.length) * 100}
                aria-label="Прогресс курса"
              />
            </div>
          </div>
          <p className="note">
            Выбери тему занятия. Внутри — четыре коротких упражнения, подсказки
            и возможность попробовать ещё раз.
          </p>
          <div className="grid">
            {lessons.map((l, i) => (
              <button
                className={`mission ${done.includes(l.id) ? 'done' : ''}`}
                key={l.id}
                onClick={() => start(i)}
              >
                <div className="mission-top">
                  <span>МИССИЯ {String(i + 1).padStart(2, '0')}</span>
                  {done.includes(l.id) ? (
                    <span>Пройдено ✓</span>
                  ) : (
                    <span>4–6 мин</span>
                  )}
                </div>
                <h2>{l.title}</h2>
                <div className="mission-bottom">
                  <span>{l.subtitle}</span>
                  <ArrowRight size={22} aria-hidden="true" />
                </div>
              </button>
            ))}
          </div>
          <p className="note">
            BURGER GO — вымышленная глобальная сеть фастфуда. QADAM — учебный
            сервис коротких поездок в Алматы. DROP — вымышленный
            интернет-магазин одежды и кроссовок. Их ситуации и числа придуманы
            для практики.
          </p>
        </main>
      ) : (
        <main className="quiz">
          <div className="quiz-nav">
            <Button
              variant="ghost"
              className="text-button rounded-none"
              onClick={home}
            >
              <ArrowLeft size={17} />
              Все миссии
            </Button>
            <span>
              {review
                ? 'Повторение'
                : `Миссия ${String(lessonIndex! + 1).padStart(2, '0')}`}{' '}
              · {Math.min(step + 1, questions.length)} / {questions.length}
            </span>
          </div>
          <Progress
            value={(step / questions.length) * 100}
            aria-label="Прогресс миссии"
          />
          <p className="course-label">{lesson.title}</p>
          {finished ? (
            <section className="finish">
              <Check size={38} />
              <h1 ref={heading} tabIndex={-1}>
                {review ? 'Ещё крепче!' : 'Миссия пройдена.'}
              </h1>
              <p>
                {missed.length
                  ? 'Ты разобрал все ситуации. Ошибки показывают, к чему полезно вернуться.'
                  : 'Все ситуации разобраны. Попробуй применить принцип в следующем рабочем брифе.'}
              </p>
              <div className="statline">
                {questions.length} из {questions.length} упражнений завершено
                {!review &&
                  missed.length > 0 &&
                  ` · ${missed.length} с повторной попыткой`}
              </div>
              <div className="finish-actions">
                {!review && missed.length > 0 && (
                  <Button
                    className="primary secondary rounded-none h-auto whitespace-normal"
                    onClick={() => {
                      setReview(missed);
                      setStep(0);
                      clear();
                    }}
                  >
                    <RotateCcw />
                    Повторить сложное
                  </Button>
                )}
                <Button
                  className="primary rounded-none h-auto whitespace-normal"
                  onClick={() =>
                    lessonIndex! < lessons.length - 1
                      ? start(lessonIndex! + 1)
                      : home()
                  }
                >
                  {lessonIndex! < lessons.length - 1
                    ? 'Следующая миссия'
                    : 'Ко всем миссиям'}
                  <ArrowRight />
                </Button>
              </div>
            </section>
          ) : (
            <section className="question">
              <span className="tag">{labels[question.type]}</span>
              <p className="context">
                <strong>{question.brand}</strong>
                <br />
                {question.context}
              </p>
              <h1 ref={heading} tabIndex={-1}>
                {question.prompt}
              </h1>
              {question.type === 'pairs' ? (
                <div>
                  {question.left!.map((left, row) => (
                    <div className="pair-row" key={left}>
                      <strong>{left}</strong>
                      {options(question, row)}
                    </div>
                  ))}
                </div>
              ) : (
                options(question)
              )}
              {hint && feedback !== 'correct' && (
                <p className="hint">
                  <strong>Подсказка.</strong> {question.hint}
                </p>
              )}
              <div aria-live="polite" aria-atomic="true">
                {feedback && (
                  <div className={`feedback ${feedback}`}>
                    <strong>
                      {feedback === 'correct'
                        ? 'Да, именно так.'
                        : 'Давай ещё раз.'}
                    </strong>
                    <p>
                      {feedback === 'correct'
                        ? question.explanation
                        : 'Посмотри на подсказку и измени ответ. Число попыток не ограничено.'}
                    </p>
                  </div>
                )}
              </div>
              <div className="actions">
                {feedback !== 'correct' ? (
                  <>
                    <Button
                      variant="ghost"
                      className="text-button rounded-none"
                      onClick={() => setHint(!hint)}
                      aria-expanded={hint}
                    >
                      <Lightbulb size={18} />
                      {hint ? 'Скрыть' : 'Подсказка'}
                    </Button>
                    <Button
                      className="primary rounded-none h-auto"
                      disabled={!isComplete(question, selected)}
                      onClick={check}
                    >
                      Проверить
                      <ArrowRight size={18} />
                    </Button>
                  </>
                ) : (
                  <Button
                    className="primary rounded-none h-auto"
                    onClick={next}
                  >
                    {step === questions.length - 1
                      ? 'Завершить миссию'
                      : 'Дальше'}
                    <ArrowRight size={18} />
                  </Button>
                )}
              </div>
            </section>
          )}
        </main>
      )}
      <footer className="foot">
        <span>SOBA · Digital практика</span>
        <span>
          {storageAvailable
            ? 'Пройденные миссии сохраняются в этом браузере.'
            : 'Прогресс доступен только до закрытия страницы.'}
        </span>
      </footer>
    </div>
  );
}
