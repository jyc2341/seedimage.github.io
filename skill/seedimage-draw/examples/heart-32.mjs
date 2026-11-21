/* 爱心：用数学不等式画心形 + 自动描边
 * node scripts/draw.mjs examples/heart-32.mjs out/heart.png --scale 8 --ascii
 */
export const size = [32, 32];
export const title = '爱心 32×32';

export default function draw(s) {
  s.def(1, '#8E1B1B');   // 描边：深红
  s.def(2, '#E53935');   // 主体：红
  s.def(3, '#FF9E9E');   // 高光：浅红

  const cx = 16, cy = 16, r = 12;
  for (let y = 0; y < size[1]; y++) {
    for (let x = 0; x < size[0]; x++) {
      const nx = (x + 0.5 - cx) / r;
      const ny = -(y + 0.5 - cy) / r;
      const f = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * Math.pow(ny, 3);
      if (f <= 0) s.px(x, y, 2);
    }
  }

  s.ellipse(8, 7, 13, 11, 3, { fill: true });  // 左上角高光
  s.outline(1);                                 // 自动描边
  return s;
}
