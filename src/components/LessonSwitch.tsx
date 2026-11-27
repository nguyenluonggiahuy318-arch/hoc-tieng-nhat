import { LESSON_NUMBERS } from '../lib/content';
import { lessonNo } from '../state';

/** Chuyển giữa các bài (dùng chung cho Từ vựng, Ngữ pháp, Gõ chữ). */
export function LessonSwitch() {
  return (
    <div class="lesson-switch" role="group" aria-label="Chọn bài" data-testid="lesson-switch">
      {LESSON_NUMBERS.map((n) => (
        <button type="button" key={n} class={n === lessonNo.value ? 'on' : ''} aria-pressed={n === lessonNo.value} onClick={() => (lessonNo.value = n)}>
          Bài {n}
        </button>
      ))}
    </div>
  );
}
