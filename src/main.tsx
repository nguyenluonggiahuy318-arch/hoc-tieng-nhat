import { render } from 'preact';
import './styles.css';
import { App } from './app';
import { initPwa } from './pwa';
import { preloadAllLessons } from './lib/content';

render(<App />, document.getElementById('app')!);
initPwa();
// tải trước các bài còn lại khi trình duyệt rảnh
const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
idle(preloadAllLessons);
