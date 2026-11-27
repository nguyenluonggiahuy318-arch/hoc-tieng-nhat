// Schema (zod) cho mọi file trong content/. Chỉ dùng khi kiểm tra (npm run validate, test),
// không được import vào code chạy trên trình duyệt (app chỉ dùng `import type`).
import { z } from 'zod';

export const SOURCE_KINDS = ['video', 'pdf', 'anh', 'docx', 'minna'] as const;
export const SourceKind = z.enum(SOURCE_KINDS);

const text = z.string().trim().min(1, 'không được để trống');
const kanaText = text.regex(/^[぀-ヿー～〜]+$/, 'chỉ được viết bằng kana');

export const VocabItemSchema = z.strictObject({
  jp: text,
  romaji: text,
  /** Phiên âm kiểu Việt, giữ nguyên như trong tài liệu (có thể trống nếu tài liệu không có). */
  phienam: z.string(),
  vi: text,
  note: z.string().optional(),
});

export const VocabGroupSchema = z.strictObject({
  group: text,
  items: z.array(VocabItemSchema).min(1, 'nhóm từ phải có ít nhất 1 từ'),
});

export const ExampleSchema = z.strictObject({ jp: text, romaji: text, vi: text });

export const GrammarSchema = z.strictObject({
  pattern: text,
  meaning: text,
  explain: text,
  note: z.string().optional(),
  source: z.union([SourceKind, z.array(SourceKind).min(1)]),
  examples: z.array(ExampleSchema).min(1, 'mẫu ngữ pháp cần ít nhất 1 ví dụ'),
});

export const FillSchema = z.strictObject({
  q: text,
  options: z.array(text).min(2).max(4, 'tối đa 4 lựa chọn (phím tắt 1–4)'),
  answer: text,
  vi: text,
  why: text,
});

export const OrderSchema = z.strictObject({
  vi: text,
  words: z.array(text).min(2, 'câu sắp xếp cần ít nhất 2 từ').max(14, 'câu quá dài (tối đa 14 từ)'),
});

const IntroChoice = z.strictObject({ jp: text, romaji: text, vi: text });
export const SelfIntroSchema = z.strictObject({
  countries: z.array(IntroChoice).min(1),
  jobs: z.array(IntroChoice).min(1),
});

export const LessonSchema = z.strictObject({
  lesson: z.number().int().min(1),
  title: text,
  sources: z.array(text),
  notes: z
    .strictObject({
      vocab: z.string().optional(),
      vocabSource: z.string().optional(),
      grammarSource: z.string().optional(),
    })
    .optional(),
  vocab: z.array(VocabGroupSchema),
  grammar: z.array(GrammarSchema),
  fill: z.array(FillSchema),
  order: z.array(OrderSchema),
  corrections: z.array(text),
  selfIntro: SelfIntroSchema.optional(),
});

// ---------------------------------------------------------------- so-dem.json

export const RuleSchema = z.strictObject({ sym: text, html: text });

const int = z.number().int();
export const CounterSchema = z.strictObject({
  id: text.regex(/^[a-z0-9-]+$/, 'id chỉ gồm a-z, 0-9, -'),
  name: text,
  lesson: int.min(1),
  suffix: kanaText,
  label: text.regex(/\{n(:en)?\}/, 'nhãn phải chứa {n} hoặc {n:en}'),
  note: z.string().optional(),
  digit: z.record(z.string().regex(/^[1-9]$/, 'khoá là chữ số 1–9'), kanaText).optional(),
  ten: kanaText.optional(),
  special: z.record(z.string().regex(/^\d+$/), kanaText).optional(),
  alt: z.record(z.string().regex(/^\d+$/), kanaText).optional(),
  spaced: z.boolean().optional(),
  range: z.tuple([int.min(0), int.min(1)]),
  table: z.array(int.min(0)).min(1),
  extra: z.array(z.strictObject({ label: text, jp: text, irregular: z.boolean().optional() })).optional(),
  quiz: z
    .strictObject({
      label: text,
      pool: z.array(int.min(0)).optional(),
      random: z.array(z.tuple([int, int, int.min(1)])).optional(),
      mixWeight: z.number().min(0).optional(),
    })
    .optional(),
});

export const CounterPageSchema = z.strictObject({
  id: text.regex(/^[a-z0-9-]+$/),
  title: text,
  intro: z.string().optional(),
  counters: z.array(text).min(1),
  rules: z.array(RuleSchema).optional(),
});

export const SoDemSchema = z.strictObject({
  tableRules: z.array(RuleSchema),
  counters: z.array(CounterSchema),
  pages: z.array(CounterPageSchema),
});

// ---------------------------------------------------------------- tu-muon.json, de-nham.json

export const LoanwordsSchema = z.strictObject({
  words: z.array(z.strictObject({ jp: text, romaji: text, vi: text })).min(4),
});

const ScriptTips = z.strictObject({
  tips: z.array(z.strictObject({ chars: z.array(text).min(1), html: text })),
  rules: z.array(RuleSchema),
});
export const ConfusablesSchema = z.strictObject({ hira: ScriptTips, kata: ScriptTips });

export type Lesson = z.infer<typeof LessonSchema>;
export type VocabItem = z.infer<typeof VocabItemSchema>;
export type VocabGroup = z.infer<typeof VocabGroupSchema>;
export type Grammar = z.infer<typeof GrammarSchema>;
export type Example = z.infer<typeof ExampleSchema>;
export type FillItem = z.infer<typeof FillSchema>;
export type OrderItem = z.infer<typeof OrderSchema>;
export type SelfIntro = z.infer<typeof SelfIntroSchema>;
export type SourceKindT = z.infer<typeof SourceKind>;
export type Rule = z.infer<typeof RuleSchema>;
export type Counter = z.infer<typeof CounterSchema>;
export type CounterPage = z.infer<typeof CounterPageSchema>;
export type SoDem = z.infer<typeof SoDemSchema>;
export type Loanwords = z.infer<typeof LoanwordsSchema>;
export type Confusables = z.infer<typeof ConfusablesSchema>;
