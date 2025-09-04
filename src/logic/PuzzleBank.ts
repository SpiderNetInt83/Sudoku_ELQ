import type { Puzzle, Board, Difficulty } from '@/types';
import { cloneBoard } from '@/logic/SudokuValidator';

// Простейший банк пазлов: несколько готовых (валидных) пар givens/solution.
// Можно расширять позже. 0 — пусто в givens.
const puzzles: Puzzle[] = [
  {
    givens: [
      [5,3,0, 0,7,0, 0,0,0],
      [6,0,0, 1,9,5, 0,0,0],
      [0,9,8, 0,0,0, 0,6,0],

      [8,0,0, 0,6,0, 0,0,3],
      [4,0,0, 8,0,3, 0,0,1],
      [7,0,0, 0,2,0, 0,0,6],

      [0,6,0, 0,0,0, 2,8,0],
      [0,0,0, 4,1,9, 0,0,5],
      [0,0,0, 0,8,0, 0,7,9]
    ],
    solution: [
      [5,3,4, 6,7,8, 9,1,2],
      [6,7,2, 1,9,5, 3,4,8],
      [1,9,8, 3,4,2, 5,6,7],

      [8,5,9, 7,6,1, 4,2,3],
      [4,2,6, 8,5,3, 7,9,1],
      [7,1,3, 9,2,4, 8,5,6],

      [9,6,1, 5,3,7, 2,8,4],
      [2,8,7, 4,1,9, 6,3,5],
      [3,4,5, 2,8,6, 1,7,9]
    ]
  }
];

export function getRandomPuzzle(): Puzzle {
  const base = puzzles[Math.floor(Math.random() * puzzles.length)];
  return generateVariant(base);
}

export function generateRandomPuzzle(difficulty: Difficulty): Puzzle {
  const base = puzzles[Math.floor(Math.random() * puzzles.length)];
  const variant = generateVariant(base);
  const solution = variant.solution;
  const givens = cloneBoard(solution);

  const ranges: Record<Difficulty, [number, number]> = {
    easy: [40, 49],
    medium: [32, 39],
    hard: [25, 31]
  };
  const [minKeep, maxKeep] = ranges[difficulty];
  const keep = randInt(minKeep, maxKeep);
  const remove = 81 - keep;

  const indices = shuffle([...Array(81).keys()]);
  for (let i = 0; i < remove; i++) {
    const idx = indices[i];
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    givens[r][c] = 0;
  }
  return { givens, solution };
}

// --- Simple generator via valid Sudoku isomorphisms ---
function generateVariant(base: Puzzle): Puzzle {
  // 1) Digit permutation (1..9)
  const digitOrder = shuffle([1,2,3,4,5,6,7,8,9]);
  const mapDigit = (n: number) => (n === 0 ? 0 : digitOrder[n - 1]);

  const mapBoardDigits = (b: Board): Board => b.map(row => row.map(mapDigit));
  let givens = mapBoardDigits(cloneBoard(base.givens));
  let solution = mapBoardDigits(cloneBoard(base.solution));

  // 2) Row/column permutations within bands/stacks and band/stack reorder
  const rowOrder = buildRowOrder();
  const colOrder = buildColOrder();

  givens = permuteBoard(givens, rowOrder, colOrder);
  solution = permuteBoard(solution, rowOrder, colOrder);

  // 3) Optional transpose for extra variety
  if (Math.random() < 0.5) {
    givens = transpose(givens);
    solution = transpose(solution);
  }

  return { givens, solution };
}

function permuteBoard(b: Board, rowOrder: number[], colOrder: number[]): Board {
  const out: Board = Array.from({ length: 9 }, () => Array(9).fill(0));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      out[r][c] = b[rowOrder[r]][colOrder[c]];
    }
  }
  return out;
}

function transpose(b: Board): Board {
  const out: Board = Array.from({ length: 9 }, () => Array(9).fill(0));
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) out[c][r] = b[r][c];
  return out;
}

function buildRowOrder(): number[] {
  const bandOrder = shuffle([0,1,2]);
  const result: number[] = [];
  for (const band of bandOrder) {
    const within = shuffle([0,1,2]);
    for (const w of within) result.push(band * 3 + w);
  }
  return result;
}

function buildColOrder(): number[] {
  const stackOrder = shuffle([0,1,2]);
  const result: number[] = [];
  for (const stack of stackOrder) {
    const within = shuffle([0,1,2]);
    for (const w of within) result.push(stack * 3 + w);
  }
  return result;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
