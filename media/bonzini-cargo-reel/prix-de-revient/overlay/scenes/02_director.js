'use strict';
// Caption hooks composed across scenes: captionHide(fn) / captionY(fn). fn(t, page) → bool | y | null
const _capHide = [], _capY = [];
function captionHide(fn) { _capHide.push(fn); }
function captionY(fn) { _capY.push(fn); }
window.CAPTION_HIDE = (t, p) => _capHide.some(f => f(t, p));
window.CAPTION_Y = (t, p) => { for (const f of _capY) { const y = f(t, p); if (y != null) return y; } return 1340; };
