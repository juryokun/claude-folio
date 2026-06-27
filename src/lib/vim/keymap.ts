export type VimAction =
  | 'cursor_down'
  | 'cursor_up'
  | 'cursor_first'
  | 'cursor_last'
  | 'navigate_up'
  | 'navigate_into'
  | 'toggle_select'
  | 'delete_selected'
  | 'cut_selected'
  | 'yank_selected'
  | 'paste'
  | 'enter_search'
  | 'enter_command'
  | 'copy_path'
  | 'copy_name'
  | 'open_terminal'
  | 'rename'
  | 'new_dir'
  | 'new_tab'
  | 'close_tab'
  | 'next_tab'
  | 'prev_tab'
  | 'focus_path_bar'
  | 'toggle_hidden'
  | 'show_help'
  | 'open_selected';

export interface KeyBinding {
  keys: string[]; // sequence of key names
  action: VimAction;
}

export const NORMAL_KEYMAP: KeyBinding[] = [
  { keys: ['j'],         action: 'cursor_down' },
  { keys: ['k'],         action: 'cursor_up' },
  { keys: ['ArrowDown'], action: 'cursor_down' },
  { keys: ['ArrowUp'],   action: 'cursor_up' },
  { keys: ['g', 'g'],   action: 'cursor_first' },
  { keys: ['G'],         action: 'cursor_last' },
  { keys: ['h'],         action: 'navigate_up' },
  { keys: ['l'],         action: 'navigate_into' },
  { keys: ['ArrowRight'],action: 'navigate_into' },
  // Option+ArrowUp is handled separately as altKey+ArrowUp
  { keys: ['Enter'],     action: 'navigate_into' },
  { keys: [' '],         action: 'toggle_select' },
  { keys: ['d', 'd'],   action: 'delete_selected' },
  { keys: ['x', 'x'],   action: 'cut_selected' },
  { keys: ['y', 'y'],   action: 'yank_selected' },
  { keys: ['p'],         action: 'paste' },
  { keys: ['/'],         action: 'enter_search' },
  { keys: [':'],         action: 'enter_command' },
  { keys: ['y', 'p'],   action: 'copy_path' },
  { keys: ['y', 'n'],   action: 'copy_name' },
  { keys: ['o'],         action: 'open_terminal' },
  { keys: ['r'],         action: 'rename' },
  { keys: ['a'],         action: 'new_dir' },
  { keys: ['t'],         action: 'new_tab' },
  { keys: [']'],         action: 'next_tab' },
  { keys: ['['],         action: 'prev_tab' },
  { keys: ['.'],         action: 'toggle_hidden' },
  { keys: ['?'],         action: 'show_help' },
];

// For display in the help overlay
export const KEYBINDING_DOCS: Array<{ keys: string; description: string }> = [
  { keys: 'j / ↓',          description: 'カーソルを下へ' },
  { keys: 'k / ↑',          description: 'カーソルを上へ' },
  { keys: 'h',               description: '親ディレクトリへ移動' },
  { keys: 'l / → / Enter',  description: 'ディレクトリに入る / ファイルを開く' },
  { keys: 'Option+↑',        description: '親ディレクトリへ移動' },
  { keys: 'gg',              description: '先頭へ' },
  { keys: 'G',               description: '末尾へ' },
  { keys: 'Space',           description: 'ファイル/フォルダを選択' },
  { keys: 'dd',              description: 'ゴミ箱へ移動' },
  { keys: 'xx',              description: '切り取り' },
  { keys: 'yy',              description: 'コピー' },
  { keys: 'p',               description: 'ペースト' },
  { keys: 'yp',              description: 'パスをコピー' },
  { keys: 'yn',              description: 'ファイル名をコピー' },
  { keys: '/',               description: 'インクリメンタルサーチ' },
  { keys: ':',               description: 'コマンドパレット' },
  { keys: 'r',               description: 'リネーム' },
  { keys: 'a',               description: '新規ディレクトリ作成' },
  { keys: 'o',               description: 'ターミナルを開く' },
  { keys: 't',               description: '新規タブ' },
  { keys: '] / [',           description: '次/前のタブ' },
  { keys: '.',               description: '隠しファイルの表示切替' },
  { keys: 'Ctrl+L',          description: 'パスバーにフォーカス' },
  { keys: '?',               description: 'キーバインド一覧を表示' },
];
