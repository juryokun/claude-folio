import { describe, expect, it } from 'vitest';
import { shouldPreserveCursor } from '../tabSwitch';

describe('shouldPreserveCursor', () => {
  it('タブが変わり、対象タブが既にロード済みなら true', () => {
    expect(shouldPreserveCursor('tab-1', 'tab-2', true)).toBe(true);
  });

  it('タブが変わっても、対象タブが未ロード（新規タブ）なら false', () => {
    expect(shouldPreserveCursor('tab-1', 'tab-2', false)).toBe(false);
  });

  it('同一タブ内でのパス変更（ナビゲーション）なら false', () => {
    expect(shouldPreserveCursor('tab-1', 'tab-1', true)).toBe(false);
  });

  it('同一タブかつ未ロードでも false', () => {
    expect(shouldPreserveCursor('tab-1', 'tab-1', false)).toBe(false);
  });
});
