import type { Board } from '@/types';

// Проверяем: число в [1..9], и нет конфликтов в строке/столбце/блоке 3x3
export function canPlace(board: Board, r: number, c: number, n: number): boolean {
  if (n < 1 || n > 9) return false;

  for (let i = 0; i < 9; i++) {
    if (board[r][i] === n) return false;
    if (board[i][c] === n) return false;
  }

  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = br; i < br + 3; i++) {
    for (let j = bc; j < bc + 3; j++) {
      if (board[i][j] === n) return false;
    }
  }

  return true;
}

export function isComplete(board: Board): boolean {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0) return false;
  return true;
}

export function cloneBoard(b: Board): Board {
  return b.map(row => [...row]);
}

