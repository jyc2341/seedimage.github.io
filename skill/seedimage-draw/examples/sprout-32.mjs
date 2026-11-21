/* 种子发芽图标：花盆 + 茎 + 双叶 + 高光
 * node scripts/draw.mjs examples/sprout-32.mjs out/sprout.png --scale 16 --code out/sprout.txt --ascii
 */
export const size = [32, 32];
export const title = '种子发芽 32×32';

export default function draw(s) {
  const pot = '#C1663B', potDark = '#8E4A2B', potLight = '#E09A70', soil = '#4E342E';
  const leaf = '#4CAF50', leafDark = '#2E7D32', leafLight = '#A5D6A7';

  /* 花盆：上宽下窄 */
  for (let y = 23; y <= 30; y++) {
    const inset = Math.floor((y - 23) / 3);
    s.line(8 + inset, y, 23 - inset, y, pot);
  }
  s.rect(7, 21, 24, 22, potDark, { fill: true });   // 盆沿
  s.line(8, 21, 23, 21, potLight);                  // 盆沿高光
  s.line(8, 22, 23, 22, soil);                      // 土

  /* 茎：微微弯曲 */
  for (let y = 11; y <= 21; y++) {
    const x = 15 + (y > 16 ? 1 : 0);
    s.px(x, y, leafDark);
    s.px(x + 1, y, leaf);
  }

  /* 双叶 */
  s.ellipse(7, 8, 15, 14, leaf, { fill: true });
  s.ellipse(16, 5, 25, 12, leaf, { fill: true });
  s.ellipse(9, 9, 12, 11, leafLight, { fill: true });
  s.ellipse(19, 7, 22, 9, leafLight, { fill: true });

  /* 土上的小芽点 + 高光 */
  s.px(12, 20, leafDark);
  s.px(20, 19, leafDark);
  s.outline('#1B3A2A');

  return s;
}
