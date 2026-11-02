/* Speech recognition where the browser offers it. */
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const Voice = {
  supported: !!Recognition,
  active: null,
  /* Resolves with { text, confidence }, or rejects with { code }. */
  listen(lang, onInterim) {
    return new Promise((resolve, reject) => {
      if (!Recognition) return reject({ code: "unsupported" });
      this.stop();
      let done = false, best = "", confidence = 0;
      const r = new Recognition();
      r.lang = lang; r.continuous = false; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e) => {
        let line = "";
        for (const part of e.results) { line += part[0].transcript; if (part.isFinal) confidence = part[0].confidence || confidence; }
        best = line.trim();
        if (onInterim) onInterim(best);
      };
      r.onerror = (e) => { if (done) return; done = true; this.active = null; reject({ code: e.error || "failed" }); };
      r.onend = () => { if (done) return; done = true; this.active = null; best ? resolve({ text: best, confidence }) : reject({ code: "no-speech" }); };
      this.active = r;
      try { r.start(); } catch (e) { done = true; this.active = null; reject({ code: "failed" }); }
    });
  },
  stop() { if (this.active) { try { this.active.abort(); } catch (e) {} this.active = null; } },
};
