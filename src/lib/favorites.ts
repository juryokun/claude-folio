import type { FavoriteKey } from '../store/configStore';

export function favoritePath(key: FavoriteKey, home: string): string {
  switch (key) {
    case 'home':
      return home;
    case 'desktop':
      return `${home}/Desktop`;
    case 'documents':
      return `${home}/Documents`;
    case 'downloads':
      return `${home}/Downloads`;
    case 'pictures':
      return `${home}/Pictures`;
    case 'music':
      return `${home}/Music`;
    case 'movies':
      return `${home}/Movies`;
    case 'public':
      return `${home}/Public`;
    case 'applications':
      return '/Applications';
  }
}
