/**
 * GrandStaff.js — high-level wrapper around VexFlow 5.
 *
 * Renders a piano grand staff (treble + bass, brace, barlines) from
 * EasyScore note strings.  Canvas is sized for the worst-case key
 * signature (C# / Cb, 7 accidentals) so the layout never shifts when
 * cycling through all 12 keys.
 *
 * Quick start:
 *
 *   // 1. Compute a fixed canvas width once for your measure count:
 *   const W = GrandStaff.computeCanvasWidth({ numMeasures: 2 });
 *
 *   // 2. Build and draw — fluent API, all measures auto-barlined:
 *   new GrandStaff('output', {
 *     width:  W,          // keep constant across all key sigs
 *     height: 280,
 *     keySignature:  'Eb',  // C G D A E B F# C# / F Bb Eb Ab Db Gb Cb
 *     timeSignature: '4/4', // default
 *   })
 *   .addMeasure('C5/q, D5, E5, F5', 'C3/q, D3, E3, F3')
 *   .addMeasure('G5/q, A5, B5, C6', 'G3/q, A3, B3, C4')
 *   .colorNote('treble', 0, 0, 'red')  // optional: colour measure 0, note 0
 *   .draw();
 *
 * EasyScore note syntax:
 *   NoteName [accidental] Octave / duration [/ type]
 *   Durations : w h q 8 16 32
 *   Rest      : append /r  e.g. "B4/q/r"
 *   Accidentals in the string are independent of the key signature;
 *   the key sig is shown on the stave and applied by VexFlow automatically.
 *
 * Width / height resolution order (first wins):
 *   1. Explicit options.width / options.height
 *   2. container element's offsetWidth / offsetHeight
 *   3. Auto-computed from worst-case key sig + pixelsPerBeat
 */

(function (global) {

  // ── constants ────────────────────────────────────────────────────────────
  const PX_PER_KEY_ACCIDENTAL = 13;   // width of one key-sig accidental glyph
  const MAX_ACCIDENTALS       = 7;    // C# / Cb — worst case
  const RIGHT_MARGIN          = 20;

  // Empirically measured: where VexFlow naturally places the first note for
  // C major (treble clef + 4/4) relative to the stave's left edge.
  // Derived from: old FIRST_MEASURE_BASE_OVERHEAD(115) - old TIME_SIG_PAD(25) = 90.
  const NATURAL_NOTE_START_BASE = 90;

  // Tiny breathing gap added after the key/time sig. Keep small so the gap
  // looks natural rather than inflated, matching professional engraving.
  const SMALL_PAD = 8;

  const KEY_ACCIDENTALS = {
    'C': 0,
    'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
    'F': 1, 'Bb': 2, 'Eb': 3, 'Ab': 4, 'Db': 5, 'Gb': 6, 'Cb': 7,
  };

  // ── class ────────────────────────────────────────────────────────────────
  class GrandStaff {
    /**
     * @param {string} elementId  DOM id of the container <div>.
     * @param {object} [options]
     * @param {string} [options.keySignature="C"]     VexFlow key name.
     *   Sharps : C  G  D  A  E  B  F#  C#
     *   Flats  : F  Bb Eb Ab Db Gb Cb
     * @param {string} [options.timeSignature="4/4"]  e.g. "3/4", "6/8".
     * @param {number} [options.width]   Total SVG width in px.
     *   Pass GrandStaff.computeCanvasWidth() to keep all key sigs the same size.
     *   Omit to read the element's offsetWidth, or fall back to auto-compute.
     * @param {number} [options.height]  Total SVG height in px (default 280).
     * @param {number} [options.startX=40]  Left offset — the brace needs ~40 px.
     * @param {number} [options.startY=40]  Top offset for the first stave.
     */
    constructor(elementId, options = {}) {
      this.elementId     = elementId;
      this.keySignature  = options.keySignature  ?? 'C';
      this.timeSignature = options.timeSignature ?? '4/4';
      this.startX        = options.startX ?? 40;
      this.startY        = options.startY ?? 40;
      this._optWidth     = options.width  ?? null;
      this._optHeight    = options.height ?? null;
      this._measures     = [];
      this._noteColors   = [];  // [{ stave, measure, note, color }]
    }

    // ── static helpers ───────────────────────────────────────────────────────

    /**
     * Return the canvas width required to display `numMeasures` measures with
     * the worst-case key signature (C# / Cb, 7 accidentals).
     * Use this once to get a fixed width and pass it to every GrandStaff
     * instance so all key signatures render at the same canvas size.
     *
     * @param {object} [opts]
     * @param {number} [opts.numMeasures=1]
     * @param {number} [opts.pixelsPerBeat=58]
     * @param {string} [opts.timeSignature="4/4"]
     * @param {number} [opts.startX=40]
     */
    static computeCanvasWidth({ numMeasures = 1, pixelsPerBeat = 58,
                                 timeSignature = '4/4', startX = 40 } = {}) {
      const beats = parseInt(timeSignature.split('/')[0], 10);
      // Size for worst-case key (C# / Cb, 7 accidentals) so canvas never needs
      // to grow when cycling key signatures.
      const worstCaseHeaderWidth =
        NATURAL_NOTE_START_BASE + MAX_ACCIDENTALS * PX_PER_KEY_ACCIDENTAL + SMALL_PAD;
      return startX + worstCaseHeaderWidth + beats * pixelsPerBeat * numMeasures + RIGHT_MARGIN;
    }

    /**
     * Add a measure. Measures are rendered left-to-right in the order added.
     * The last measure automatically gets a final barline unless you explicitly
     * pass { final: false }.
     *
     * @param {string} trebleNotes  EasyScore note string for the treble staff.
     * @param {string} bassNotes    EasyScore note string for the bass staff.
     * @param {object} [options]
     * @param {boolean} [options.final]  Override final-barline detection.
     * @returns {GrandStaff} this (fluent chaining).
     */
    addMeasure(trebleNotes, bassNotes, options = {}) {
      this._measures.push({ trebleNotes, bassNotes, ...options });
      return this;
    }

    /**
     * Color a single note before drawing.
     *
     * @param {'treble'|'bass'} stave        Which staff.
     * @param {number}          measureIndex  0-based measure number.
     * @param {number}          noteIndex     0-based note index within the measure.
     * @param {string}          color         Any CSS color: 'red', '#f00', 'rgb(255,0,0)'.
     * @returns {GrandStaff} this (fluent chaining).
     *
     * @example
     * staff
     *   .addMeasure('C5/q, D5, E5, F5', 'C3/q, D3, E3, F3')
     *   .colorNote('treble', 0, 0, 'red')   // C5 red
     *   .colorNote('bass',   0, 2, 'blue')  // E3 blue
     *   .draw();
     */
    colorNote(stave, measureIndex, noteIndex, color) {
      this._noteColors.push({ stave, measure: measureIndex, note: noteIndex, color });
      return this;
    }

    // ── private helpers ──────────────────────────────────────────────────

    _beatsPerMeasure() {
      return parseInt(this.timeSignature.split('/')[0], 10);
    }

    // Resolve total canvas width: explicit option → element offsetWidth → auto.
    _resolveWidth() {
      if (this._optWidth) return this._optWidth;
      const el = document.getElementById(this.elementId);
      if (el && el.offsetWidth > 0) return el.offsetWidth;
      // Auto fallback: compute for worst-case key sig.
      return GrandStaff.computeCanvasWidth({
        numMeasures:   this._measures.length,
        timeSignature: this.timeSignature,
        startX:        this.startX,
      });
    }

    _resolveHeight() {
      if (this._optHeight) return this._optHeight;
      const el = document.getElementById(this.elementId);
      if (el && el.offsetHeight > 0) return el.offsetHeight;
      return 280;
    }

    // Width of the first-measure header (clef + key sig + time sig + small gap)
    // based on the ACTUAL key signature, not the worst-case maximum.
    _measure1HeaderWidth() {
      const acc = KEY_ACCIDENTALS[this.keySignature] ?? 0;
      return NATURAL_NOTE_START_BASE + acc * PX_PER_KEY_ACCIDENTAL + SMALL_PAD;
    }

    // Note area per measure derived from total canvas width.
    // All measures get the same note area so spacing is consistent within a key.
    // The ~8-19% variation in note area between extreme keys (C vs C#) is
    // far less jarring than the artificial dead zone the old approach created.
    _noteAreaWidth(totalWidth) {
      return (totalWidth - this.startX - this._measure1HeaderWidth() - RIGHT_MARGIN)
             / this._measures.length;
    }

    // ── public ───────────────────────────────────────────────────────────

    /** Render the grand staff into the container element. */
    draw() {
      if (!this._measures.length) return;

      VexFlow.setFonts('Bravura', 'Academico');

      const totalWidth    = this._resolveWidth();
      const totalHeight   = this._resolveHeight();
      const noteAreaWidth = this._noteAreaWidth(totalWidth);
      const timeSig       = this.timeSignature;
      const keySig        = this.keySignature;

      const factory = new VexFlow.Factory({
        renderer: { elementId: this.elementId, width: totalWidth, height: totalHeight },
      });

      const score = factory.EasyScore();
      let x = this.startX;

      this._measures.forEach((measure, i) => {
        const isFirst = i === 0;
        const isFinal = measure.final ?? (i === this._measures.length - 1);
        // First measure is wider by the header (clef + key sig + time sig + gap).
        const width = isFirst ? this._measure1HeaderWidth() + noteAreaWidth : noteAreaWidth;

        const sys = factory.System({ x, y: this.startY, width });

        // Build note arrays separately so colors can be applied before
        // they are handed to the voice formatter.
        const applyColors = (notes, stave) => {
          this._noteColors
            .filter(c => c.stave === stave && c.measure === i)
            .forEach(({ note: ni, color }) => {
              if (notes[ni]) notes[ni].setStyle({ fillStyle: color, strokeStyle: color });
            });
          return notes;
        };

        const trebleNotes = applyColors(score.notes(measure.trebleNotes, { stem: 'up' }), 'treble');
        const bassNotes   = applyColors(score.notes(measure.bassNotes, { clef: 'bass', stem: 'down' }), 'bass');

        const treble = sys.addStave({
          voices: [score.voice(trebleNotes, { time: timeSig })],
        });

        const bass = sys.addStave({
          voices: [score.voice(bassNotes, { time: timeSig })],
        });

        if (isFirst) {
          treble.addClef('treble').addKeySignature(keySig).addTimeSignature(timeSig);
          bass.addClef('bass').addKeySignature(keySig).addTimeSignature(timeSig);

          // Nudge notes just slightly past the time signature — natural gap,
          // no inflated dead zone.  getNoteStartX() is VexFlow's natural
          // position after clef + key sig + time sig.
          treble.setNoteStartX(treble.getNoteStartX() + SMALL_PAD);
          bass.setNoteStartX(bass.getNoteStartX()     + SMALL_PAD);

          sys.addConnector('brace');
          sys.addConnector('singleLeft');
        }

        if (isFinal) {
          treble.setEndBarType(VexFlow.Barline.type.END);
          bass.setEndBarType(VexFlow.Barline.type.END);
          sys.addConnector('boldDoubleRight');
        } else {
          sys.addConnector('singleRight');
        }

        x += width;
      });

      factory.draw();
    }
  }

  global.GrandStaff = GrandStaff;

})(window);
