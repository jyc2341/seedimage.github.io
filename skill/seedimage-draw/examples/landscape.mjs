/* 风景：程序化生成渐变天空、太阳、山峦、水面波光
 * node scripts/draw.mjs examples/landscape.mjs out/landscape.png --scale 8
 */
export const size = [64, 48];
export const title = '风景 64×48';

export default function draw(s) {
  const sky = ['#0B1E3A', '#123A63', '#1E5A8A', '#3E8FBF', '#8FD0E8', '#FFD9A0'];
  for (let y = 0; y < 30; y++) {
    s.line(0, y, 63, y, sky[Math.min(sky.length - 1, Math.floor(y / 5))]);
  }

  s.circle(46, 12, 6, '#FFE08A', { fill: true });
  s.circle(46, 12, 3, '#FFF6D0', { fill: true });

  for (let x = 0; x < 64; x++) {
    const far = 30 - Math.round(7 + 6 * Math.sin(x / 9 + 1));
    s.line(x, far, x, 31, '#2E4A63');
    const near = 30 - Math.round(3 + 4 * Math.sin(x / 5));
    s.line(x, near, x, 31, '#1E3346');
  }

  for (let y = 32; y < 48; y++) {
    s.line(0, y, 63, y, y < 39 ? '#123B5C' : '#0C2740');
  }
  s.map((x, y, key) => (y >= 33 && y < 41 && (x + y * 3) % 7 === 0 ? '#7FD1FF' : (key ? key : null)));

  return s;
}
