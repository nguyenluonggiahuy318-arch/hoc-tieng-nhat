import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { BASIC } from './lib/kana';
import { basicLearned, hideRomaji, script } from './state';
import { applyUpdate, needRefresh, offlineReady } from './pwa';
import { Seg } from './components/ui';
import { ChartView } from './views/Chart';
import { CardsView } from './views/Cards';
import { QuizView } from './views/Quiz';
import { TypingView } from './views/Typing';
import { VocabView } from './views/Vocab';
import { GrammarView } from './views/Grammar';
import { NumbersView } from './views/Numbers';
import { LoanwordsView } from './views/Loanwords';
import { TipsView } from './views/Tips';
import { SettingsView } from './views/Settings';
import { UploadView } from './views/Upload';

interface ViewDef {
  id: string;
  label: string;
  alias: string[];
  C: ComponentType<{ active: boolean }>;
}
export const VIEWS: ViewDef[] = [
  { id: 'bang-chu', label: 'Bảng chữ', alias: ['chart'], C: ChartView },
  { id: 'the-nho', label: 'Thẻ nhớ', alias: ['cards'], C: CardsView },
  { id: 'luyen-tap', label: 'Luyện tập', alias: ['quiz'], C: QuizView },
  { id: 'go-chu', label: 'Gõ chữ', alias: ['go'], C: TypingView },
  { id: 'tu-vung', label: 'Từ vựng', alias: ['bai1', 'vocab'], C: VocabView },
  { id: 'ngu-phap', label: 'Ngữ pháp', alias: ['nguphap'], C: GrammarView },
  { id: 'so-dem', label: 'Số đếm', alias: ['so'], C: NumbersView },
  { id: 'tu-muon', label: 'Từ mượn', alias: ['words'], C: LoanwordsView },
  { id: 'de-nham', label: 'Dễ nhầm & quy tắc', alias: ['tips'], C: TipsView },
  { id: 'gui-bai', label: '📤 Gửi bài', alias: ['upload'], C: UploadView as ComponentType<{ active: boolean }> },
  { id: 'cai-dat', label: 'Cài đặt', alias: ['settings'], C: SettingsView as ComponentType<{ active: boolean }> },
];

function parseHash(): string {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split(/[/?]/)[0];
  const v = VIEWS.find((x) => x.id === h || x.alias.includes(h));
  return v ? v.id : VIEWS[0].id;
}
const route = signal(parseHash());
window.addEventListener('hashchange', () => {
  route.value = parseHash();
  window.scrollTo(0, 0);
});

function Header() {
  const sc = script.value;
  const name = sc === 'hira' ? 'Hiragana' : 'Katakana';
  const n = basicLearned.value;
  return (
    <header>
      <h1>
        <span class="jp" aria-hidden="true">
          {sc === 'hira' ? 'ひらがな' : 'カタカナ'}
        </span>{' '}
        Học tiếng Nhật
      </h1>
      <div class="headright">
        <div class="hdrrow">
          <button type="button" class={'btn romtog' + (hideRomaji.value ? ' on' : '')} onClick={() => (hideRomaji.value = !hideRomaji.value)} data-testid="toggle-romaji" aria-pressed={hideRomaji.value}>
            {hideRomaji.value ? '👁 Hiện romaji' : '🙈 Ẩn romaji'}
          </button>
          <Seg
            label="Bảng chữ"
            value={sc}
            onChange={(v) => (script.value = v)}
            options={[
              {
                value: 'hira',
                label: (
                  <>
                    <span class="jp">あ</span>Hiragana
                  </>
                ),
              },
              {
                value: 'kata',
                label: (
                  <>
                    <span class="jp">ア</span>Katakana
                  </>
                ),
              },
            ]}
          />
        </div>
        <div class="prog">
          <div class="prog-label">
            <span>Đã thuộc {name} cơ bản</span>
            <span data-testid="progress-text">
              {n}/{BASIC.length}
            </span>
          </div>
          <div class="bar">
            <i style={{ width: (n / BASIC.length) * 100 + '%' }} />
          </div>
        </div>
      </div>
    </header>
  );
}

export function App() {
  const cur = route.value;
  const [visited, setVisited] = useState<string[]>([cur]);
  useEffect(() => {
    if (!visited.includes(cur)) setVisited([...visited, cur]);
  }, [cur]);
  useEffect(() => {
    document.body.classList.toggle('hide-romaji', hideRomaji.value);
  }, [hideRomaji.value]);
  const label = VIEWS.find((v) => v.id === cur)?.label ?? '';
  useEffect(() => {
    document.title = `${label} · Học tiếng Nhật`;
  }, [label]);
  return (
    <div class="wrap">
      <Header />
      <nav aria-label="Mục">
        {VIEWS.map((v) => (
          <a key={v.id} href={'#' + v.id} class={v.id === cur ? 'on' : ''} aria-current={v.id === cur ? 'page' : undefined}>
            {v.id === 'cai-dat' ? '⚙️ ' : ''}
            {v.label}
          </a>
        ))}
      </nav>
      {needRefresh.value && (
        <div class="banner" role="status">
          <span>Đã có bản cập nhật (có thể có bài mới).</span>
          <button type="button" class="btn primary" onClick={() => void applyUpdate()}>
            Cập nhật
          </button>
          <button type="button" class="btn" onClick={() => (needRefresh.value = false)}>
            Để sau
          </button>
        </div>
      )}
      {offlineReady.value && (
        <div class="banner soft" role="status">
          <span>Đã lưu để dùng offline.</span>
          <button type="button" class="btn" onClick={() => (offlineReady.value = false)}>
            OK
          </button>
        </div>
      )}
      {VIEWS.filter((v) => visited.includes(v.id) || v.id === cur).map((v) => (
        <section key={v.id} class="view" id={'v-' + v.id} hidden={v.id !== cur} data-view={v.id}>
          <v.C active={v.id === cur} />
        </section>
      ))}
    </div>
  );
}
