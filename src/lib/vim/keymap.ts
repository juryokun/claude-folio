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
  | 'open_editor'
  | 'rename'
  | 'new_dir'
  | 'new_tab'
  | 'close_tab'
  | 'next_tab'
  | 'prev_tab'
  | 'focus_path_bar'
  | 'focus_zoxide'
  | 'go_back'
  | 'go_forward'
  | 'toggle_hidden'
  | 'show_help'
  | 'open_selected'
  | 'add_bookmark'
  | 'sort_name'
  | 'sort_name_desc'
  | 'sort_time'
  | 'sort_time_desc'
  | 'sort_reverse';

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
  { keys: ['e'],         action: 'open_editor' },
  { keys: ['r'],         action: 'rename' },
  { keys: ['a'],         action: 'new_dir' },
  { keys: ['t'],         action: 'new_tab' },
  { keys: [']'],         action: 'next_tab' },
  { keys: ['['],         action: 'prev_tab' },
  { keys: ['.'],         action: 'toggle_hidden' },
  { keys: ['?'],         action: 'show_help' },
  { keys: ['z'],         action: 'focus_zoxide' },
  { keys: ['H'],         action: 'go_back' },
  { keys: ['L'],         action: 'go_forward' },
  { keys: ['B'],         action: 'add_bookmark' },
  { keys: ['s', 'n'],   action: 'sort_name' },
  { keys: ['s', 'N'],   action: 'sort_name_desc' },
  { keys: ['s', 't'],   action: 'sort_time' },
  { keys: ['s', 'T'],   action: 'sort_time_desc' },
  { keys: ['s', 'r'],   action: 'sort_reverse' },
];

// For display in the help overlay
export const KEYBINDING_DOCS: Array<{ keys: string; description: string }> = [
  { keys: 'j / ↓',          description: 'カーソルを下へ' },
  { keys: 'k / ↑',          description: 'カーソルを上へ' },
  { keys: 'h',               description: '親ディレクトリへ移動' },
  { keys: 'l / → / Enter',  description: 'ディレクトリに入る / ファイルを開く' },
  { keys: '←',               description: '親ディレクトリへ移動' },
  { keys: 'H',               description: '前のディレクトリへ戻る' },
  { keys: 'L',               description: '次のディレクトリへ進む' },
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
  { keys: 'o',               description: 'ファイルを実行 / ディレクトリはターミナルを開く' },
  { keys: 'e',               description: 'エディタでファイルを開く' },
  { keys: 't',               description: '新規タブ' },
  { keys: '] / [',           description: '次/前のタブ' },
  { keys: '.',               description: '隠しファイルの表示切替' },
  { keys: 'Ctrl+L',          description: 'パスバーにフォーカス' },
  { keys: 'z',               description: 'zoxide で移動先を検索' },
  { keys: '?',               description: 'キーバインド一覧を表示' },
  { keys: 'B',               description: '現在のディレクトリをブックマークに追加' },
  { keys: 'sn',              description: '名前でソート（昇順）' },
  { keys: 'sN',              description: '名前でソート（降順）' },
  { keys: 'st',              description: '更新日時でソート（昇順）' },
  { keys: 'sT',              description: '更新日時でソート（降順）' },
  { keys: 'sr',              description: 'ソート順を逆にする' },
];
