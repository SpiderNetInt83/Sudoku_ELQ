export type NumberPadEvents = {
  onNumber: (n: number) => void;
  onErase: () => void;
  onHint: () => void;
  onCheck: () => void;
  onNew: () => void;
  onToggleNotes: () => void;
};

export class NumberPad {
  private scene: Phaser.Scene;
  private y: number;
  private container?: Phaser.GameObjects.Container;
  private events?: NumberPadEvents;
  private spacingX = 6;
  private spacingY = 10;
  private maxBtn = 72;
  private digitButtons: { n: number; rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  private disabledDigits = new Set<number>();
  private notesBtn?: { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };
  private notesActive = false;

  constructor(scene: Phaser.Scene, y: number) {
    this.scene = scene;
    this.y = y;
  }

  create(events: NumberPadEvents) {
    this.events = events;
    this.container?.destroy(true);
    this.container = this.scene.add.container(0, 0);
    this.layout();
    // Relayout on resize to keep it fitting the screen
    this.scene.scale.on('resize', this.layout, this);
  }

  destroy() {
    this.scene.scale.off('resize', this.layout, this);
    this.container?.destroy(true);
    this.container = undefined;
  }

  private layout = () => {
    if (!this.container || !this.events) return;
    this.container.removeAll(true);
    this.digitButtons = [];

    const width = this.scene.scale.width;
    const bottomMargin = 12;

    const countRow1 = 9; // numbers
    const countRow2 = 5; // controls (Notes + 4 actions)

    const sizeFor = (count: number) => {
      const totalSpacing = (count - 1) * this.spacingX;
      const maxForRow = Math.floor((width - totalSpacing - 2 * 8) / count); // 8px side padding
      return Math.max(28, Math.min(this.maxBtn, maxForRow));
    };

    const s1 = sizeFor(countRow1);
    const s2 = sizeFor(countRow2);
    const btnSize = Math.min(s1, s2); // keep consistent size across rows

    const row2Y = this.scene.scale.height - btnSize / 2 - bottomMargin; // bottom row anchored
    const row1Y = row2Y - (btnSize + this.spacingY);

    const xStart = (count: number) => (width - (count * btnSize + (count - 1) * this.spacingX)) / 2 + btnSize / 2;

    const mkBtn = (x: number, y: number, label: string, cb: () => void) => {
      const rect = this.scene.add.rectangle(x, y, btnSize, btnSize, 0xE0E0E0)
        .setStrokeStyle(2, 0x222222)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const fontSize = Math.max(16, Math.floor(btnSize * 0.45));
      const text = this.scene.add.text(x, y, label, { fontSize: `${fontSize}px`, color: '#111' }).setOrigin(0.5);
      rect.on('pointerdown', () => { cb(); (navigator.vibrate?.(10)); });
      this.container!.add([rect, text]);
    };

    // Row 1: numbers 1..9
    {
      let x = xStart(countRow1);
      for (let n = 1; n <= 9; n++) {
        const nx = x;
        const make = () => this.events!.onNumber(n);
        const rect = this.scene.add.rectangle(nx, row1Y, btnSize, btnSize, 0xE0E0E0)
          .setStrokeStyle(2, 0x222222)
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        const fontSize = Math.max(16, Math.floor(btnSize * 0.45));
        const text = this.scene.add.text(nx, row1Y, String(n), { fontSize: `${fontSize}px`, color: '#111' }).setOrigin(0.5);
        rect.on('pointerdown', () => { make(); (navigator.vibrate?.(10)); });
        this.container!.add([rect, text]);
        this.digitButtons.push({ n, rect, text });
        x += btnSize + this.spacingX;
      }
    }

    // Row 2: controls ✎ ⌫ ? ✓ ↻
    {
      let x = xStart(countRow2);
      // Notes toggle button (stored separately for visual state)
      const rect = this.scene.add.rectangle(x, row2Y, btnSize, btnSize, 0xE0E0E0)
        .setStrokeStyle(2, 0x222222)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const fontSize = Math.max(16, Math.floor(btnSize * 0.45));
      const text = this.scene.add.text(x, row2Y, '✎', { fontSize: `${fontSize}px`, color: '#111' }).setOrigin(0.5);
      rect.on('pointerdown', () => { this.events!.onToggleNotes(); (navigator.vibrate?.(10)); });
      this.container!.add([rect, text]);
      this.notesBtn = { rect, text };
      x += btnSize + this.spacingX;

      mkBtn(x, row2Y, '⌫', this.events.onErase); x += btnSize + this.spacingX;
      mkBtn(x, row2Y, '?', this.events.onHint); x += btnSize + this.spacingX;
      mkBtn(x, row2Y, '✓', this.events.onCheck); x += btnSize + this.spacingX;
      mkBtn(x, row2Y, '↻', this.events.onNew);
    }

    // Re-apply disabled state after rebuild
    this.disabledDigits.forEach(d => this.applyDigitState(d, false));
    // Re-apply notes active state
    this.applyNotesState();
  };

  // Public: enable/disable single digit button
  setDigitEnabled(n: number, enabled: boolean) {
    if (!enabled) this.disabledDigits.add(n); else this.disabledDigits.delete(n);
    this.applyDigitState(n, enabled);
  }

  // Public: bulk update from counts[1..9] (>=9 => disable)
  setDigitsFromCounts(counts: number[]) {
    for (let n = 1; n <= 9; n++) {
      this.setDigitEnabled(n, (counts[n] ?? 0) < 9);
    }
  }

  private applyDigitState(n: number, enabled: boolean) {
    const btn = this.digitButtons.find(b => b.n === n);
    if (!btn) return;
    if (enabled) {
      btn.rect.setFillStyle(0xE0E0E0).setStrokeStyle(2, 0x222222).setInteractive({ useHandCursor: true });
      btn.text.setColor('#111');
    } else {
      btn.rect.setFillStyle(0xF0F0F0).setStrokeStyle(2, 0xBDBDBD).disableInteractive();
      btn.text.setColor('#9E9E9E');
    }
  }

  // Public: reflect notes mode visually
  setNotesActive(active: boolean) {
    this.notesActive = active;
    this.applyNotesState();
  }

  private applyNotesState() {
    if (!this.notesBtn) return;
    if (this.notesActive) {
      this.notesBtn.rect.setFillStyle(0xFFE082).setStrokeStyle(2, 0xFF8F00);
      this.notesBtn.text.setColor('#111');
    } else {
      this.notesBtn.rect.setFillStyle(0xE0E0E0).setStrokeStyle(2, 0x222222);
      this.notesBtn.text.setColor('#111');
    }
  }
}
