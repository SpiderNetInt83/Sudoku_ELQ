import Phaser from 'phaser';
import { SudokuScene } from '@/scenes/SudokuScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#f5f5f7',
  width: 720,
  height: 1280,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [SudokuScene]
};

new Phaser.Game(config);

