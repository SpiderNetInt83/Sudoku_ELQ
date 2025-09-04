export type Board = number[][]; // 0 — пусто
export interface CellPos { row: number; col: number; }
export interface Puzzle {
  givens: Board; // стартовые числа
  solution: Board; // полное решение (для hint/check)
}
export type Difficulty = 'easy' | 'medium' | 'hard';
