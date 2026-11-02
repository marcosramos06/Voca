/* Personal memory model. Each word keeps an estimate of how long you will remember it. */
const Memory = {
  KEEP: 0.9,
  levelOf(s) { return s >= 21 ? 5 : s >= 7 ? 4 : s >= 3 ? 3 : s >= 1 ? 2 : 1; },
  /* Older cards only have a box number, so give them a matching starting estimate. */
  normalize(c, day) {
    if (c.s) return c;
    const old = [0, 1, 3, 7, 16, 35, 80][c.b || 0] || 0;
    return { ...c, s: old || 0.5, ease: 2.2, lapses: 0, last: (c.d || day) - old };
  },
  /* Chance of recalling the word today. */
  recall(c, day) {
    if (!c.s) return 0;
    return Math.pow(this.KEEP, Math.max(0, day - (c.last == null ? day : c.last)) / c.s);
  },
  /* result: "good", "accent" or "bad". tune stretches or shortens gaps for this learner. */
  review(card, result, day, tune = 1) {
    if (!card.b) {
      const s = result === "bad" ? 0.4 : 1.5;
      return { b: this.levelOf(s), s, ease: 2.3, lapses: result === "bad" ? 1 : 0, last: day, d: result === "bad" ? day : day + 1 };
    }
    const c = this.normalize(card, day), r = this.recall(c, day);
    if (result === "bad") {
      const s = Math.max(0.4, c.s * 0.35);
      return { ...c, s, ease: Math.max(1.3, c.ease - 0.2), lapses: (c.lapses || 0) + 1, last: day, d: day, b: this.levelOf(s) };
    }
    const harder = 1 + (1 - r) * 1.5, partial = result === "accent" ? 0.75 : 1;
    const s = Math.min(365, c.s * Math.max(1.2, c.ease * harder * partial));
    return { ...c, s, ease: Math.min(3, c.ease + (result === "good" ? 0.05 : 0)), last: day, d: day + Math.max(1, Math.round(s * tune)), b: this.levelOf(s) };
  },
  /* Keeps review accuracy near 87%: easy reviews stretch gaps, hard ones shorten them. */
  tune(outcomes = []) {
    if (outcomes.length < 20) return 1;
    const rate = outcomes.reduce((n, x) => n + x, 0) / outcomes.length;
    return Math.min(1.5, Math.max(0.6, 1 + (rate - 0.87) * 3));
  },
};
