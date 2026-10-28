# Kitchen camera interaction

Open the kitchen on `http://127.0.0.1:8766/` (or HTTPS) and click **Start camera**. All video processing runs locally. The MediaPipe model and WASM runtime are bundled under `vendor/mediapipe/`.

| Input | Recognition |
| --- | --- |
| Rounded white bundle, like reference 1 | Dough |
| White toy knife, black rectangular prop, or another rectangular prop | Knife |
| Closed fist | Make bread |
| V / peace sign | Free exploration |

**Auto · Objects first** selects an object before considering gestures. A fist holding a prop cannot also activate Make bread. A short grace period prevents brief object occlusion from becoming a fist action. Hand-only and object-only options are available for testing. Background capture is optional and can help with textured props. Flip tip reverses the knife's direction.

Recognition acquires after three stable frames. Losing a target stops active input immediately; its visual proxy fades briefly. Knife input includes a continuous tip sweep; dough, bread and exploration never emit an active knife input. The room camera remains free and recognition never resets its position. Stopping the camera or leaving the tab releases the stream and worker. Collapsing the panel keeps recognition running.

## Implementation

- `recognition.mjs`: joint geometry for fist/V signs; colour regions, principal axes and contour shape for rectangular props and rounded white bundles; object-first arbitration.
- `tracking-core.mjs`: background silhouette fallback, stable target acquisition, smoothing and movement tracking. The legacy `handKnife` export is retained for compatibility; the current controller uses the new gesture rules.
- `camera-controller.js`: stream, local hand worker, frame processing and recognition priority.
- `kitchen-input.js`: English labels, camera preview, knife/dough feedback and events.

Shape recognition is colour-independent for rectangles, but still needs a visible contour. Very small, clipped, occluded or low-contrast objects can be missed. The rounded-white rule recognizes a dough proxy rather than identifying ingredients. The output contains screen position and direction, not physical depth. These interaction proxies do not change furniture textures or exported room geometry.

## Game interface

`window.kitchenKnife.state` holds the tracked pose; `window.kitchen.interaction` holds the current recognition state. The pose has `action: 'knife' | 'dough' | 'bread' | 'explore'` and `source: 'hand' | 'object'`.

```js
window.addEventListener('kitchen:recognition', ({detail: input}) => {
  if (!input.active) return;
  // input.action and input.label identify the current interaction.
  // input.pose.base / tip are normalized 0..1 mirrored screen positions.
});

window.addEventListener('kitchen:knife-input', ({detail: input}) => {
  if (!input.active) return;
  // Knife only. input.sweep is {from, to}, or null on acquisition/reacquisition.
});
```

Always check `active`. Retained poses during visual fade are not active inputs. The `confidence` field is a shape/joint match score, not a calibrated probability. Make bread currently selects the bread interaction and displays fist-controlled dough feedback; this module does not implement a complete baking recipe or scoring system.

## Verification

```sh
node scripts/test-recognition.mjs
node scripts/test-knife-tracking.mjs
python3 -m http.server 8766 --bind 127.0.0.1
node scripts/check-knife-input.cjs
node scripts/check-recognition-references.cjs /local/ref1.png /local/ref2.png /local/ref3.png /local/ref4.png /local/ref5.png
```

Browser scripts use a synthetic Canvas stream, never the real webcam. Configure `PLAYWRIGHT_PATH` and `CHROME_PATH` if needed. Reference images are supplied from local paths, stay in browser memory, and are not copied into served assets. Reports under `output/` contain labels and checks, not the reference images. Checks cover all five references, mirrored/dimmed inputs, fist-plus-object priority, loss, English feedback, free camera, stream cleanup and absence of remote requests.
