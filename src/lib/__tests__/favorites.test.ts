import { describe, it, expect } from 'vitest';
import { favoritePath } from '../favorites';
import type { FavoriteKey } from '../../store/configStore';

const HOME = '/Users/testuser';

describe('favoritePath', () => {
  it.each<[FavoriteKey, string]>([
    ['home', HOME],
    ['desktop', `${HOME}/Desktop`],
    ['documents', `${HOME}/Documents`],
    ['downloads', `${HOME}/Downloads`],
    ['pictures', `${HOME}/Pictures`],
    ['music', `${HOME}/Music`],
    ['movies', `${HOME}/Movies`],
    ['public', `${HOME}/Public`],
    ['applications', '/Applications'],
  ])('favoritePath(%s) returns correct path', (key, expected) => {
    expect(favoritePath(key, HOME)).toBe(expected);
  });

  it('applications path is absolute and does not depend on home', () => {
    expect(favoritePath('applications', '/different/home')).toBe('/Applications');
  });
});
