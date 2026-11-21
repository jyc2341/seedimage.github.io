/* 徽章：图形 + 5×7 点阵文字
 * node scripts/draw.mjs examples/badge.mjs out/badge.png --scale 6
 */
export const size = [72, 40];
export const title = '徽章 72×40';

export default function draw(s) {
  s.rect(0, 0, 71, 39, '#12233A', { fill: true });   // 底
  s.rect(1, 1, 70, 38, '#2E6FA8');                    // 内边框
  s.rect(3, 3, 68, 36, '#1B3A57', { fill: true });
  s.rect(3, 3, 68, 36, '#7FD1FF');

  s.text(36, 9, 'SEED', '#FFFFFF', { align: 'center', scale: 2 });
  s.text(36, 25, 'IMAGE 1.0', '#7FD1FF', { align: 'center', scale: 1 });

  return s;
}
