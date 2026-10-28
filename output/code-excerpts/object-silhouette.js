// Extract foreground pixels and compensate for exposure changes.
for (let i = 0; i < w * h; i++) {
  const j = i * 4;
  const difference = (
    Math.abs(rgba[j]     - bg[j]     - shift) +
    Math.abs(rgba[j + 1] - bg[j + 1] - shift) +
    Math.abs(rgba[j + 2] - bg[j + 2] - shift)
  ) / 3;

  mask[i] = difference > threshold ? 1 : 0;
}

// Connected-component extraction and principal-axis analysis are omitted.
const long = hi - lo;
const short = sideHi - sideLo;
const aspect = long / Math.max(1, short);
const fill = count / Math.max(1, long * short);

// Reject components that do not resemble elongated objects.
if (
  aspect < 2.35 || aspect > 20 ||
  long < h * .17 || short < 3 || fill < .24
) continue;

// Calculate the two endpoints of the object's principal axis.
const a = {
  x: (cx + vx * lo) / w,
  y: (cy + vy * lo) / h
};
const b = {
  x: (cx + vx * hi) / w,
  y: (cy + vy * hi) / h
};
