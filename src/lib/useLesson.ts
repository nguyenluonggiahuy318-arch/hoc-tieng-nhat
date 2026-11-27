import { useEffect } from 'preact/hooks';
import { getLesson, lessonsLoaded, loadLesson } from './content';
import { lessonNo } from '../state';
import type { Lesson } from './schema';

/** Bài đang chọn (tự tải nếu chưa có). undefined trong lúc đang tải. */
export function useLesson(): Lesson | undefined {
  const n = lessonNo.value;
  void lessonsLoaded.value; // đăng ký vẽ lại khi bài tải xong
  useEffect(() => {
    if (!getLesson(n)) void loadLesson(n);
  }, [n]);
  return getLesson(n);
}
