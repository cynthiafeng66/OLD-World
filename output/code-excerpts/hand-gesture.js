// Prefer 3D landmarks and estimate palm length.
const p = world?.length === 21 ? world : landmarks;
const palm = length3(p[0], p[9]);

let extended = 0;
const vectors = [];

// Check the four fingers, excluding the thumb.
for (const root of [5, 9, 13, 17]) {
  const a = p[root], b = p[root + 1];
  const c = p[root + 2], d = p[root + 3];

  const reach = length3(a, d);
  const path = length3(a, b) + length3(b, c) + length3(c, d);

  // Count fingers that are sufficiently straight and extended.
  if (
    reach / Math.max(path, .0001) > .86 &&
    reach > palm * .5 &&
    length3(p[0], d) > length3(p[0], b) * 1.12
  ) extended++;

  vectors.push({
    x: (d.x - a.x) / Math.max(reach, .0001),
    y: (d.y - a.y) / Math.max(reach, .0001),
    z: ((d.z || 0) - (a.z || 0)) / Math.max(reach, .0001)
  });
}

// Require similar finger directions and limited fingertip separation.
const parallel = vectors.slice(1).every(v =>
  v.x * vectors[0].x +
  v.y * vectors[0].y +
  v.z * vectors[0].z > .72
);
const spread = length3(p[8], p[20]) / palm;
if (extended < 3 || !parallel || spread > .95) return null;

// Use the wrist as the handle and fingertips as the blade tip.
const base = { x: landmarks[0].x, y: landmarks[0].y };
const tip = {
  x: (landmarks[8].x + landmarks[12].x) / 2,
  y: (landmarks[8].y + landmarks[12].y) / 2
};
