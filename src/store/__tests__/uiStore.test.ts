import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/tauri', () => ({
  tauriApi: { saveLanguage: vi.fn() },
  isTauri: vi.fn().mockReturnValue(false),
}));

vi.mock('../../lib/i18n', () => ({
  setLanguage: vi.fn(),
}));

import { useUiStore } from '../uiStore';

beforeEach(() => {
  useUiStore.setState({ pendingKey: null });
});

describe('pendingKey', () => {
  it('is null by default', () => {
    expect(useUiStore.getState().pendingKey).toBeNull();
  });

  it('setPendingKey sets a key', () => {
    useUiStore.getState().setPendingKey('o');
    expect(useUiStore.getState().pendingKey).toBe('o');
  });

  it('setPendingKey with null clears the key', () => {
    useUiStore.getState().setPendingKey('n');
    useUiStore.getState().setPendingKey(null);
    expect(useUiStore.getState().pendingKey).toBeNull();
  });

  it('setPendingKey can be updated to a different prefix', () => {
    useUiStore.getState().setPendingKey('o');
    useUiStore.getState().setPendingKey('n');
    expect(useUiStore.getState().pendingKey).toBe('n');
  });
});
