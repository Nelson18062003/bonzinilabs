'use strict';
// Voice-timeline helpers (all times come from the narration; never hard-code seconds).
const tw = (seg, word, off = 0, nth = 0) => TL.wt(seg, word, null, nth) + off;          // start of a word
const te = (seg, word, off = 0, nth = 0) => TL.we(seg, word, null, nth) + off;          // end of a word
const ss = (seg, off = 0) => TL.seg(seg).start + off;                                   // segment start
const se = (seg, off = 0) => TL.seg(seg).end + off;                                     // segment end
const chs = (id, off = 0) => TL.ch(id).start + off;
const che = (id, off = 0) => TL.ch(id).end + off;
/** shot boundary helper: shots start a little before their first segment's voice (so the picture leads the words) */
const shotStart = (seg, lead = .35) => ss(seg, -lead);
// Shared grades for puppets (light of the place and time)
const GRADE = {
  day: null,
  shade: { mul: '#E9E2D6', tint: '#FFD9A0', tintA: .06 },                               // covered market alley / stall shade
  late: { mul: '#F2DCC0', tint: '#FF9F43', tintA: .08, rim: '#FFD08A', rimA: .3, rimSide: 'left' },   // late afternoon
  office: { mul: '#EDE6DA', tint: '#FFE7B8', tintA: .05, rim: '#FFF1CF', rimA: .25, rimSide: 'right' },
  night: { mul: '#9AA3D6', tint: '#FFB347', tintA: .08, rim: '#FFC46B', rimA: .45, rimSide: 'right' },  // maquis under the garlands
};
