import type { Board, CellPos, Puzzle, Difficulty } from '@/types';
import { NumberPad } from '@/ui/NumberPad';
import { generateRandomPuzzle } from '@/logic/PuzzleBank';
import { canPlace, isComplete, cloneBoard } from '@/logic/SudokuValidator';

// Background images (Vite will bundle these)
const BG_URLS = [
  new URL('../../assets/images/bg_1.jpg', import.meta.url).toString(),
  new URL('../../assets/images/bg_2.jpg', import.meta.url).toString(),
  new URL('../../assets/images/bg_3.jpg', import.meta.url).toString()
];

export class SudokuScene extends Phaser.Scene {
  private puzzle!: Puzzle;
  private current!: Board;
  private givens!: Board;

  private gridSize = 600;
  private cell = this.gridSize / 9;
  private startX = 0;
  private startY = 120;

  private selected: CellPos | null = null;
  private digits: Phaser.GameObjects.Text[][] = [];
  private highlightRect?: Phaser.GameObjects.Rectangle;
  private numberPad?: NumberPad;
  private bgImage?: Phaser.GameObjects.Image;
  private rowHighlight?: Phaser.GameObjects.Rectangle;
  private colHighlight?: Phaser.GameObjects.Rectangle;
  private blockHighlight?: Phaser.GameObjects.Rectangle;
  private notesMode: boolean = false;
  private notes: boolean[][][] = [];
  private notesTexts: Phaser.GameObjects.Text[][][] = [];
  private showNotesContainer?: Phaser.GameObjects.Container;
  private showNotesRect?: Phaser.GameObjects.Rectangle;
  private showNotesLabel?: Phaser.GameObjects.Text;
  private notesShown: boolean = false;

  // Difficulty UI
  private difficulty: Difficulty = 'easy';
  private diffContainer?: Phaser.GameObjects.Container;
  private diffButtons: { key: Difficulty; rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private onResize = () => {
    this.cameras.main.setBackgroundColor('#f5f5f7');
    this.layoutDifficultyUI();
    this.fitBackground();
    this.layoutShowNotesButton();
  };

  constructor() { super('SudokuScene'); }

  preload() {
    // Preload background images once
    BG_URLS.forEach((url, i) => this.load.image(`bg_${i+1}`, url));
  }

  create() {
    this.computeLayout();
    this.setRandomBackground();
    this.createDifficultyUI();
    this.loadPuzzle();
    this.drawGrid();
    this.drawDigits();
    this.createInputHandlers();
    this.layoutShowNotesButton();

    const padY = this.scale.height - 90;
    this.numberPad?.destroy();
    this.numberPad = new NumberPad(this, padY);
    this.numberPad.create({
      onNumber: n => this.placeNumber(n),
      onErase: () => this.eraseCurrent(),
      onHint: () => this.hint(),
      onCheck: () => this.checkBoard(),
      onNew: () => this.newGame(),
      onToggleNotes: () => this.toggleNotesMode()
    });

    // Синхронизируем доступность цифр при старте
    this.updateNumberAvailability();
    this.numberPad.setNotesActive(this.notesMode);

    this.scale.off('resize', this.onResize, this);
    this.scale.on('resize', this.onResize, this);
  }

  private computeLayout() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Чуть уменьшаем поле, чтобы больше пространства осталось под панель
    const target = Math.min(w * 0.9, h * 0.58);
    this.gridSize = Math.floor(target / 9) * 9;
    this.cell = this.gridSize / 9;
    this.startX = (w - this.gridSize) / 2 + this.cell / 2;
    this.startY = 170 + this.cell / 2; // опускаем поле ниже (учёт крупного заголовка)
  }

  private loadPuzzle() {
    this.puzzle = generateRandomPuzzle(this.difficulty);
    this.givens = cloneBoard(this.puzzle.givens);
    this.current = cloneBoard(this.puzzle.givens);
    this.initNotes();
  }

  private drawGrid() {
    const g = this.add.graphics();
    g.clear();

    // Клетки фон
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const x = this.startX + c * this.cell;
        const y = this.startY + r * this.cell;
        const light = ((Math.floor(r / 3) + Math.floor(c / 3)) % 2 === 0);
        const color = light ? 0xFFFFFF : 0xFAFAFA;
        this.add.rectangle(x, y, this.cell, this.cell, color)
          .setOrigin(0.5)
          .setStrokeStyle(1, 0xCCCCCC);
      }
    }

    const x0 = this.startX - this.cell / 2;
    const y0 = this.startY - this.cell / 2;
    const size = this.gridSize;

    // Внутренние линии сетки (тонкие), без внешней рамки
    g.lineStyle(1, 0xBDBDBD);
    for (let i = 1; i <= 8; i++) {
      // horiz
      g.strokeLineShape(new Phaser.Geom.Line(
        x0,
        y0 + i * this.cell,
        x0 + size,
        y0 + i * this.cell
      ));
      // vert
      g.strokeLineShape(new Phaser.Geom.Line(
        x0 + i * this.cell,
        y0,
        x0 + i * this.cell,
        y0 + size
      ));
    }

    // Толстые линии через 3 клетки (внутренние)
    g.lineStyle(4, 0x000000);
    [3, 6].forEach(i => {
      g.strokeLineShape(new Phaser.Geom.Line(x0, y0 + i * this.cell, x0 + size, y0 + i * this.cell));
      g.strokeLineShape(new Phaser.Geom.Line(x0 + i * this.cell, y0, x0 + i * this.cell, y0 + size));
    });

    // Внешняя толстая рамка по периметру (включая боковые стороны)
    g.lineStyle(4, 0x000000);
    g.strokeRect(x0, y0, size, size);
  }

  private drawDigits() {
    this.digits.forEach(row => row.forEach(t => t.destroy()));
    this.digits = [];
    // destroy existing notes texts
    this.notesTexts.forEach(row => row.forEach(arr => arr.forEach(t => t.destroy())));
    this.notesTexts = [];

    for (let r = 0; r < 9; r++) {
      const row: Phaser.GameObjects.Text[] = [];
      const notesRow: Phaser.GameObjects.Text[][] = [];
      for (let c = 0; c < 9; c++) {
        const x = this.startX + c * this.cell;
        const y = this.startY + r * this.cell;
        const val = this.current[r][c];
        const isGiven = this.givens[r][c] !== 0;

        const txt = this.add.text(x, y, val ? String(val) : '', {
          fontSize: `${Math.floor(this.cell * 0.5)}px`,
          color: isGiven ? '#000000' : '#1565C0',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2);

        row.push(txt);

        // create 9 tiny note texts within the cell
        const minis: Phaser.GameObjects.Text[] = [];
        const miniSize = Math.max(10, Math.floor(this.cell * 0.18));
        for (let n = 1; n <= 9; n++) {
          const sr = Math.floor((n - 1) / 3);
          const sc = (n - 1) % 3;
          const nx = x + (sc - 1) * (this.cell / 3);
          const ny = y + (sr - 1) * (this.cell / 3);
          const t = this.add.text(nx, ny, String(n), { fontSize: `${miniSize}px`, color: '#777' })
            .setOrigin(0.5)
            .setDepth(1);
          minis.push(t);
        }
        notesRow.push(minis);
        this.updateNotesTextForCell(r, c, minis);
      }
      this.digits.push(row);
      this.notesTexts.push(notesRow);
    }
  }

  private createInputHandlers() {
    // Интерактивная зона только поверх сетки, чтобы UI над/под полем работал
    const x0 = this.startX - this.cell / 2;
    const y0 = this.startY - this.cell / 2;
    const hit = this.add.zone(x0 + this.gridSize / 2, y0 + this.gridSize / 2, this.gridSize, this.gridSize)
      .setOrigin(0.5)
      .setInteractive();

    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const { x, y } = p;
      const c = Math.floor((x - (this.startX - this.cell / 2)) / this.cell);
      const r = Math.floor((y - (this.startY - this.cell / 2)) / this.cell);
      if (r >= 0 && r < 9 && c >= 0 && c < 9) {
        this.selectCell({ row: r, col: c });
      }
    });
  }

  private selectCell(pos: CellPos) {
    this.selected = pos;
    this.updateHighlights();
  }

  private placeNumber(n: number) {
    if (!this.selected) return;
    const { row, col } = this.selected;

    // Notes mode: toggle pencil marks
    if (this.notesMode) {
      if (n === 0) { this.eraseCurrent(); return; }
      this.toggleNote(n);
      return;
    }

    if (this.givens[row][col] !== 0) return; // нельзя изменять данную клетку

    if (n === 0) {
      this.current[row][col] = 0;
      this.digits[row][col].setText('');
      this.updateNumberAvailability();
      this.updateHighlights();
      return;
    }

    if (canPlace(this.current, row, col, n)) {
      this.current[row][col] = n;
      this.digits[row][col].setText(String(n));
      // clear notes at this cell and remove from peers
      for (let k = 1; k <= 9; k++) this.notes[row][col][k] = false;
      this.updateNotesTextForCell(row, col);
      this.removeNoteFromPeers(row, col, n);
      (navigator.vibrate?.(12));
      this.updateNumberAvailability();
      this.updateHighlights();
      if (isComplete(this.current)) {
        this.winFlash();
      }
    } else {
      this.flashCell(row, col);
      (navigator.vibrate?.(30));
    }
  }

  private flashCell(r: number, c: number) {
    const rect = this.add.rectangle(
      this.startX + c * this.cell,
      this.startY + r * this.cell,
      this.cell, this.cell,
      0xFF5252, 0.25
    ).setOrigin(0.5);
    this.time.delayedCall(180, () => rect.destroy());
  }

  private hint() {
    if (!this.selected) return;
    const { row, col } = this.selected;
    const target = this.puzzle.solution[row][col];
    if (this.givens[row][col] === 0) {
      this.placeNumber(target);
    }
  }

  private checkBoard() {
    // Простая сверка с solution для текущих заполненных клеток.
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cur = this.current[r][c];
        if (cur !== 0 && cur !== this.puzzle.solution[r][c]) {
          this.flashCell(r, c);
        }
      }
    }
  }

  private newGame() {
    this.children.removeAll(true);
    this.selected = null;
    // recreate with the same difficulty
    this.create();
  }

  private winFlash() {
    const banner = this.add.text(this.scale.width / 2, this.startY + this.gridSize / 2, '🎉 Sudoku Complete!', {
      fontSize: `${Math.floor(this.cell * 0.6)}px`,
      color: '#2E7D32'
    }).setOrigin(0.5);
    this.tweens.add({ targets: banner, scale: 1.2, duration: 250, yoyo: true, repeat: 2 });
  }

  // --- Background helpers ---
  private setRandomBackground() {
    const idx = Math.floor(Math.random() * BG_URLS.length) + 1; // 1..3
    const key = `bg_${idx}`;
    this.bgImage?.destroy();
    this.bgImage = this.add.image(this.scale.width / 2, this.scale.height / 2, key)
      .setOrigin(0.5)
      .setDepth(-100)
      .setAlpha(0.25);
    this.fitBackground();
  }

  private fitBackground() {
    if (!this.bgImage) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const key = this.bgImage.texture.key;
    const tex = this.textures.get(key);
    const src = tex.getSourceImage() as HTMLImageElement;
    const tw = src.width || 1;
    const th = src.height || 1;
    const scale = Math.max(w / tw, h / th);
    this.bgImage.setScale(scale).setPosition(w / 2, h / 2);
  }

  // --- Difficulty UI ---
  private createDifficultyUI() {
    this.diffContainer?.destroy(true);
    this.diffContainer = this.add.container(0, 0);
    this.diffButtons = [];
    this.layoutDifficultyUI();
  }

  private layoutDifficultyUI() {
    if (!this.diffContainer) return;
    this.diffContainer.removeAll(true);
    this.diffButtons = [];

    const labels: { key: Difficulty; title: string }[] = [
      { key: 'easy', title: 'Легкий' },
      { key: 'medium', title: 'Средний' },
      { key: 'hard', title: 'Тяжелый' }
    ];

    const pad = 8;
    const width = this.scale.width;
    const btnCount = labels.length;
    const spacing = 8;
    const totalSpacing = (btnCount - 1) * spacing + 2 * pad;
    const btnW = Math.floor((width - totalSpacing) / btnCount);
    const btnH = 36;

    // Title and subtitle
    const yTitle = 40;
    const ySub = 82;
    const yBtns = 130; // опускаем кнопки ниже подзаголовка

    const title = this.add.text(width / 2, yTitle, 'SUDOKU', {
      fontSize: '56px',
      color: '#111',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const sub = this.add.text(width / 2, ySub, 'by EightLegsQuest', {
      fontSize: '18px',
      color: '#555'
    }).setOrigin(0.5);

    this.diffContainer.add([title, sub]);

    let x = pad + btnW / 2;

    labels.forEach(({ key, title }) => {
      const selected = this.difficulty === key;
      const fill = selected ? 0xFFE082 : 0xE0E0E0;
      const stroke = selected ? 0xFF8F00 : 0x424242;
      const rect = this.add.rectangle(x, yBtns, btnW, btnH, fill)
        .setStrokeStyle(2, stroke)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(x, yBtns, title, { fontSize: '18px', color: '#111' }).setOrigin(0.5);
      rect.on('pointerdown', () => {
        if (this.difficulty !== key) {
          this.difficulty = key;
          this.newGame();
        }
      });
      this.diffContainer!.add([rect, label]);
      this.diffButtons.push({ key, rect, label });
      x += btnW + spacing;
    });
  }

  private updateNumberAvailability() {
    // counts[1..9]
    const counts = Array(10).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = this.current[r][c];
        if (v >= 1 && v <= 9) counts[v]++;
      }
    }
    this.numberPad?.setDigitsFromCounts(counts);
  }

  private toggleNotesMode() {
    this.notesMode = !this.notesMode;
    this.numberPad?.setNotesActive(this.notesMode);
  }

  private eraseCurrent() {
    if (!this.selected) return;
    const { row, col } = this.selected;
    if (this.notesMode) {
      for (let n = 1; n <= 9; n++) this.notes[row][col][n] = false;
      this.updateNotesTextForCell(row, col);
      (navigator.vibrate?.(10));
      return;
    }
    if (this.givens[row][col] !== 0) return;
    this.current[row][col] = 0;
    this.digits[row][col].setText('');
    this.updateNumberAvailability();
    this.updateHighlights();
  }

  private initNotes() {
    this.notes = [];
    for (let r = 0; r < 9; r++) {
      const row: boolean[][] = [] as unknown as boolean[][];
      for (let c = 0; c < 9; c++) {
        row.push(Array(10).fill(false) as boolean[]); // 1..9
      }
      this.notes.push(row as unknown as boolean[][]);
    }
  }

  private updateNotesTextForCell(r: number, c: number, minis?: Phaser.GameObjects.Text[]) {
    const arr = minis ?? this.notesTexts[r]?.[c];
    if (!arr) return;
    const hasValue = this.current[r][c] !== 0;
    for (let n = 1; n <= 9; n++) {
      const t = arr[n - 1];
      const visible = this.notesShown && !hasValue && this.notes[r][c][n];
      t.setVisible(visible);
    }
  }

  private toggleNote(n: number) {
    if (!this.selected) return;
    const { row, col } = this.selected;
    if (this.givens[row][col] !== 0) return;
    if (this.current[row][col] !== 0) return;
    this.notes[row][col][n] = !this.notes[row][col][n];
    this.updateNotesTextForCell(row, col);
  }

  private removeNoteFromPeers(r: number, c: number, n: number) {
    // row and column
    for (let i = 0; i < 9; i++) {
      this.notes[r][i][n] = false;
      this.updateNotesTextForCell(r, i);
      this.notes[i][c][n] = false;
      this.updateNotesTextForCell(i, c);
    }
    // block
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let rr = br; rr < br + 3; rr++) {
      for (let cc = bc; cc < bc + 3; cc++) {
        this.notes[rr][cc][n] = false;
        this.updateNotesTextForCell(rr, cc);
      }
    }
  }

  // Create/relayout "Show Notes" button under the grid
  private layoutShowNotesButton() {
    this.showNotesContainer?.destroy(true);
    const width = Math.min(this.scale.width - 24, 460);
    const height = 42;
    const x = this.scale.width / 2;
    const yBottom = (this.startY - this.cell / 2) + this.gridSize;
    const y = yBottom + 38; // опускаем ещё на ~14px
    const active = this.notesShown;
    const fill = active ? 0xFFE082 : 0xE0E0E0;
    const stroke = active ? 0xFF8F00 : 0x424242;
    const rect = this.add.rectangle(x, y, width, height, fill)
      .setStrokeStyle(2, stroke)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, 'Показать заметки', { fontSize: '18px', color: '#111' }).setOrigin(0.5);
    rect.on('pointerdown', () => {
      this.notesShown = !this.notesShown;
      if (this.notesShown) {
        this.fillAllNotesAuto();
      }
      this.updateAllNotesVisibility();
      this.updateShowNotesButtonStyle();
      (navigator.vibrate?.(10));
    });
    this.showNotesRect = rect;
    this.showNotesLabel = label;
    this.showNotesContainer = this.add.container(0, 0, [rect, label]);
  }

  // Auto-fill candidates notes for all empty cells
  private fillAllNotesAuto() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.current[r][c] !== 0) continue;
        for (let n = 1; n <= 9; n++) {
          this.notes[r][c][n] = canPlace(this.current, r, c, n);
        }
        this.updateNotesTextForCell(r, c);
      }
    }
  }

  private updateAllNotesVisibility() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        this.updateNotesTextForCell(r, c);
      }
    }
  }

  private updateShowNotesButtonStyle() {
    if (!this.showNotesRect) return;
    const active = this.notesShown;
    const fill = active ? 0xFFE082 : 0xE0E0E0;
    const stroke = active ? 0xFF8F00 : 0x424242;
    this.showNotesRect.setFillStyle(fill).setStrokeStyle(2, stroke);
  }

  // --- Highlight helpers ---
  private updateHighlights() {
    // Remove previous overlays
    this.rowHighlight?.destroy();
    this.colHighlight?.destroy();
    this.blockHighlight?.destroy();
    this.highlightRect?.destroy();

    // Reset text colors to default
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const isGiven = this.givens[r][c] !== 0;
        this.digits[r][c].setColor(isGiven ? '#000000' : '#1565C0');
      }
    }

    if (!this.selected) return;
    const { row, col } = this.selected;

    const x0 = this.startX - this.cell / 2;
    const y0 = this.startY - this.cell / 2;

    // Row highlight
    this.rowHighlight = this.add.rectangle(
      x0 + this.gridSize / 2,
      this.startY + row * this.cell,
      this.gridSize,
      this.cell,
      0x90CAF9,
      0.18
    ).setOrigin(0.5).setDepth(1);

    // Column highlight
    this.colHighlight = this.add.rectangle(
      this.startX + col * this.cell,
      y0 + this.gridSize / 2,
      this.cell,
      this.gridSize,
      0x90CAF9,
      0.18
    ).setOrigin(0.5).setDepth(1);

    // Block highlight (3x3)
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    this.blockHighlight = this.add.rectangle(
      this.startX + (bc + 1) * this.cell,
      this.startY + (br + 1) * this.cell,
      this.cell * 3,
      this.cell * 3,
      0xBBDEFB,
      0.16
    ).setOrigin(0.5).setDepth(1);

    // Selected cell highlight on top
    this.highlightRect = this.add.rectangle(
      this.startX + col * this.cell,
      this.startY + row * this.cell,
      this.cell,
      this.cell,
      0xFFD54F,
      0.25
    ).setOrigin(0.5).setStrokeStyle(2, 0xFF6F00).setDepth(3);

    // Same-digit highlight
    const val = this.current[row][col];
    if (val >= 1 && val <= 9) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.current[r][c] === val) {
            this.digits[r][c].setColor('#1976D2');
          }
        }
      }
      this.digits[row][col].setColor('#0D47A1');
    }
  }
}
