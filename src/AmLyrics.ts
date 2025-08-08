import { html, css, LitElement } from 'lit';
import { property, state, query } from 'lit/decorators.js';

const VERSION = '0.4.2';
const INSTRUMENTAL_THRESHOLD_MS = 3000; // Show ellipsis for gaps >= 3s

interface Syllable {
  text: string;
  part: boolean;
  timestamp: number;
  endtime: number;
}

interface LyricsLine {
  text: Syllable[];
  background: boolean;
  backgroundText: Syllable[];
  oppositeTurn: boolean;
  timestamp: number;
  endtime: number;
}

interface LyricsResponse {
  info: string;
  type: string;
  content: LyricsLine[];
}

export class AmLyrics extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family:
        -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
        Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background: transparent;
    }

    .lyrics-container {
      padding: 20px;
      border-radius: 8px;
      background-color: transparent;
      height: 300px; /* Example height */
      overflow-y: auto;
      scroll-behavior: smooth;
    }

    .lyrics-line {
      margin: 10px 0;
      padding: 10px;
      border-radius: 5px;
      transition: all 0.3s ease-in-out;
      text-align: left; /* Default to left */
      cursor: pointer;
      position: relative;
      font-size: 2em; /* Increased font size */
      color: #888; /* Default text color to gray */
    }

    .lyrics-line:hover {
      background-color: var(--hover-background-color, #f0f0f0);
    }

    .opposite-turn {
      text-align: right; /* Opposite is right */
    }

    .active-line {
      font-weight: bold;
      /* No background color needed, just boldness */
    }

    .progress-text {
      position: relative;
      display: inline-block;
    }

    .progress-text::before {
      content: attr(data-text);
      position: absolute;
      top: 0;
      left: 0;
      width: var(--line-progress, 0%);
      color: var(--highlight-color, #000); /* Highlight color to black */
      overflow: hidden;
      /* Spring animation */
      /* transition: width 0.05s ; */
      white-space: nowrap;
      transition: var(--transition-style, all) 0.05s
        cubic-bezier(0.25, 0.1, 0.25, 1.5);
    }

    .active-word {
      /* No longer needed for highlighting, but keeping for potential future use */
    }

    span {
      transition:
        color 0.2s ease-in-out,
        text-decoration 0.2s ease-in-out;
    }

    .background-text {
      display: block;
      color: rgba(136, 136, 136, 0.8);
      font-size: 0.8em; /* a bit smaller than main line */
      font-style: normal; /* no italics */
      margin: 4px 0 0 0; /* place just below the main line */
    }
    .progress-text:last-child {
      margin-right: 0 !important; /* Remove margin for the last word */
    }

    .lyrics-footer {
      text-align: left;
      font-size: 0.8em;
      color: #888;
      padding: 10px 0;
      border-top: 1px solid #eee;
      margin-top: 10px;
    }

    .lyrics-footer p {
      margin: 5px 0;
    }

    .lyrics-footer a {
      color: #555;
      text-decoration: none;
    }

    .lyrics-footer a:hover {
      text-decoration: underline;
    }

    .lyrics-footer.compact {
      border-top: none;
      margin-top: 0;
      padding-top: 0;
    }

    /* Instrumental indicator */
    .instrumental-line {
      display: inline-flex;
      align-items: baseline;
      gap: 8px;
      color: #aaa;
      font-size: 0.9em;
      padding: 4px 10px;
      animation: instrumentalIn 220ms ease;
    }
    @keyframes instrumentalIn {
      from {
        opacity: 0;
        transform: translateY(-6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .instrumental-duration {
      color: #aaa;
      font-size: 0.8em;
    }
  `;

  @property({ type: String })
  query?: string;

  @property({ type: String })
  musicId?: string;

  @property({ type: String })
  isrc?: string;

  @property({ type: String, attribute: 'highlight-color' })
  highlightColor = '#000';

  @property({ type: String, attribute: 'hover-background-color' })
  hoverBackgroundColor = '#f0f0f0';

  @property({ type: Boolean, attribute: 'hide-source-footer' })
  hideSourceFooter = false;

  @property({ type: String, attribute: 'font-family' })
  fontFamily?: string;

  @property({ type: Boolean })
  autoScroll = true;

  @property({ type: Boolean })
  interpolate = true;

  @property({ type: Number })
  duration?: number;

  @property({ type: Number })
  currentTime = 0;

  @state()
  private isLoading = false;

  @state()
  private lyrics?: LyricsLine[];

  @state()
  private activeLineIndices: number[] = [];

  @state()
  private activeMainWordIndices: Map<number, number> = new Map();

  @state()
  private activeBackgroundWordIndices: Map<number, number> = new Map();

  @state()
  private mainWordProgress: Map<number, number> = new Map();

  @state()
  private backgroundWordProgress: Map<number, number> = new Map();

  private animationFrameId?: number;

  private mainWordAnimations: Map<
    number,
    { startTime: number; duration: number }
  > = new Map();

  private backgroundWordAnimations: Map<
    number,
    { startTime: number; duration: number }
  > = new Map();

  @query('.lyrics-container')
  private lyricsContainer?: HTMLElement;

  private lastInstrumentalIndex: number | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.fetchLyrics();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private async fetchLyrics() {
    this.isLoading = true;
    this.lyrics = undefined;
    try {
      const baseURL = 'https://paxsenix.alwaysdata.net/';
      let appleID = this.musicId;

      if (!appleID && this.query) {
        const search = encodeURIComponent(this.query);
        try {
          const searchResponse = await fetch(
            `${baseURL}searchAppleMusic.php?q=${search}`,
          );
          if (!searchResponse.ok) {
            return;
          }
          const decoded = await searchResponse.json();

          if (this.isrc) {
            const song = decoded.find((s: any) => s.isrc === this.isrc);
            if (song) {
              appleID = song.id;
            }
          } else if (decoded.length > 0) {
            appleID = decoded[0].id;
          }
        } catch (e) {
          return;
        }
      }

      if (appleID) {
        try {
          const lyricsResponse = await fetch(
            `${baseURL}getAppleMusicLyrics.php?id=${appleID}`,
          );
          if (!lyricsResponse.ok) {
            return;
          }
          const lyricsData: LyricsResponse = await lyricsResponse.json();
          this.lyrics = lyricsData.content;
          if (this.lyricsContainer) {
            this.lyricsContainer.scrollTop = 0;
          }
        } catch (e) {
          //
        }
      }
    } finally {
      this.isLoading = false;
    }
  }

  firstUpdated() {
    this.fetchLyrics();
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (
      (changedProperties.has('query') ||
        changedProperties.has('musicId') ||
        changedProperties.has('isrc')) &&
      !changedProperties.has('currentTime')
    ) {
      this.fetchLyrics();
    }

    if (changedProperties.has('currentTime') && this.lyrics) {
      const oldTime = (changedProperties.get('currentTime') as number) ?? 0;
      const timeDiff = Math.abs(this.currentTime - oldTime);

      const newActiveLines = this.findActiveLineIndices(this.currentTime);

      // Reset animation if active lines change or if we skip time.
      // A threshold of 0.5s (500ms) is used to detect a "skip".
      const linesChanged = !AmLyrics.arraysEqual(
        newActiveLines,
        this.activeLineIndices,
      );
      if (linesChanged || timeDiff > 0.5) {
        this.startAnimationFromTime(this.currentTime);
      }
      // For small, continuous updates, we do nothing and let the animation loop handle it.
    }

    if (
      this.autoScroll &&
      changedProperties.has('activeLineIndices') &&
      this.activeLineIndices.length > 0
    ) {
      this.scrollToActiveLine();
    }

    // Smoothly scroll to the indicator when entering a gap
    const instrumental = this.findInstrumentalGapAt(this.currentTime);
    const idx = instrumental ? instrumental.insertBeforeIndex : null;
    if (this.autoScroll) {
      if (idx !== null && idx !== this.lastInstrumentalIndex) {
        this.scrollToInstrumental(idx);
        this.lastInstrumentalIndex = idx;
      } else if (idx === null && this.lastInstrumentalIndex !== null) {
        // Gap ended — gently scroll to the line that begins now
        this.scrollToInstrumental(this.lastInstrumentalIndex);
        this.lastInstrumentalIndex = null;
      }
    }
  }

  private static arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  private findActiveLineIndices(time: number): number[] {
    if (!this.lyrics) return [];
    const activeLines: number[] = [];
    for (let i = 0; i < this.lyrics.length; i += 1) {
      if (time >= this.lyrics[i].timestamp && time <= this.lyrics[i].endtime) {
        activeLines.push(i);
      }
    }
    return activeLines;
  }

  private findInstrumentalGapAt(
    time: number,
  ): { insertBeforeIndex: number; gapStart: number; gapEnd: number } | null {
    if (!this.lyrics || this.lyrics.length === 0) return null;

    // Start-of-song gap: from 0 to first line timestamp
    const first = this.lyrics[0];
    if (time >= 0 && time < first.timestamp) {
      const gapStart = 0;
      const gapEnd = first.timestamp;
      if (gapEnd - gapStart >= INSTRUMENTAL_THRESHOLD_MS) {
        return { insertBeforeIndex: 0, gapStart, gapEnd };
      }
      return null;
    }

    // Find consecutive pair (i, i+1) that bounds the current time
    for (let i = 0; i < this.lyrics.length - 1; i += 1) {
      const curr = this.lyrics[i];
      const next = this.lyrics[i + 1];
      const gapStart = curr.endtime;
      const gapEnd = next.timestamp;
      if (time > gapStart && time < gapEnd) {
        if (gapEnd - gapStart >= INSTRUMENTAL_THRESHOLD_MS) {
          return { insertBeforeIndex: i + 1, gapStart, gapEnd };
        }
        return null;
      }
    }

    return null;
  }

  private startAnimationFromTime(time: number) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    if (!this.lyrics) return;

    const activeLineIndices = this.findActiveLineIndices(time);
    this.activeLineIndices = activeLineIndices;

    // Clear previous state
    this.activeMainWordIndices.clear();
    this.activeBackgroundWordIndices.clear();
    this.mainWordAnimations.clear();
    this.backgroundWordAnimations.clear();
    this.mainWordProgress.clear();
    this.backgroundWordProgress.clear();

    if (activeLineIndices.length === 0) {
      return;
    }

    // Set up animations for each active line
    for (const lineIndex of activeLineIndices) {
      const line = this.lyrics[lineIndex];

      // Find main word based on the reset time
      let mainWordIdx = -1;
      for (let i = 0; i < line.text.length; i += 1) {
        if (time >= line.text[i].timestamp && time <= line.text[i].endtime) {
          mainWordIdx = i;
          break;
        }
      }
      this.activeMainWordIndices.set(lineIndex, mainWordIdx);

      // Find background word based on the reset time
      let backWordIdx = -1;
      if (line.backgroundText) {
        for (let i = 0; i < line.backgroundText.length; i += 1) {
          if (
            time >= line.backgroundText[i].timestamp &&
            time <= line.backgroundText[i].endtime
          ) {
            backWordIdx = i;
            break;
          }
        }
      }
      this.activeBackgroundWordIndices.set(lineIndex, backWordIdx);
    }

    // With the state correctly set, configure the animation parameters
    this.setupAnimations();

    // Start the animation loop
    if (this.interpolate) {
      this.animateProgress();
    }
  }

  private updateActiveLineAndWords() {
    if (!this.lyrics) return;

    const activeLineIndices = this.findActiveLineIndices(this.currentTime);
    this.activeLineIndices = activeLineIndices;

    // Clear previous state
    this.activeMainWordIndices.clear();
    this.activeBackgroundWordIndices.clear();

    for (const lineIdx of activeLineIndices) {
      const line = this.lyrics[lineIdx];
      let mainWordIdx = -1;
      for (let i = 0; i < line.text.length; i += 1) {
        if (
          this.currentTime >= line.text[i].timestamp &&
          this.currentTime <= line.text[i].endtime
        ) {
          mainWordIdx = i;
          break;
        }
      }
      this.activeMainWordIndices.set(lineIdx, mainWordIdx);

      let backWordIdx = -1;
      if (line.backgroundText) {
        for (let i = 0; i < line.backgroundText.length; i += 1) {
          if (
            this.currentTime >= line.backgroundText[i].timestamp &&
            this.currentTime <= line.backgroundText[i].endtime
          ) {
            backWordIdx = i;
            break;
          }
        }
      }
      this.activeBackgroundWordIndices.set(lineIdx, backWordIdx);
    }
  }

  private setupAnimations() {
    if (this.activeLineIndices.length === 0 || !this.lyrics) {
      this.mainWordAnimations.clear();
      this.backgroundWordAnimations.clear();
      return;
    }

    for (const lineIndex of this.activeLineIndices) {
      const line = this.lyrics[lineIndex];
      const mainWordIndex = this.activeMainWordIndices.get(lineIndex) ?? -1;
      const backgroundWordIndex =
        this.activeBackgroundWordIndices.get(lineIndex) ?? -1;

      // Main word animation
      if (mainWordIndex !== -1) {
        const word = line.text[mainWordIndex];
        const wordDuration = word.endtime - word.timestamp;
        const elapsedInWord = this.currentTime - word.timestamp;
        this.mainWordAnimations.set(lineIndex, {
          startTime: performance.now() - elapsedInWord,
          duration: wordDuration,
        });
      } else {
        this.mainWordAnimations.set(lineIndex, { startTime: 0, duration: 0 });
      }

      // Background word animation
      if (backgroundWordIndex !== -1 && line.backgroundText) {
        const word = line.backgroundText[backgroundWordIndex];
        const wordDuration = word.endtime - word.timestamp;
        const elapsedInWord = this.currentTime - word.timestamp;
        this.backgroundWordAnimations.set(lineIndex, {
          startTime: performance.now() - elapsedInWord,
          duration: wordDuration,
        });
      } else {
        this.backgroundWordAnimations.set(lineIndex, {
          startTime: 0,
          duration: 0,
        });
      }
    }
  }

  private handleLineClick(line: LyricsLine) {
    const event = new CustomEvent('line-click', {
      detail: {
        timestamp: line.timestamp,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  private scrollToActiveLine() {
    if (!this.lyricsContainer || this.activeLineIndices.length === 0) {
      return;
    }

    // Scroll to the first active line
    const firstActiveLineIndex = Math.min(...this.activeLineIndices);
    const activeLineElement = this.lyricsContainer.querySelector(
      `.lyrics-line:nth-child(${firstActiveLineIndex + 1})`,
    ) as HTMLElement;

    if (activeLineElement) {
      const containerHeight = this.lyricsContainer.clientHeight;
      const lineTop = activeLineElement.offsetTop;
      const lineHeight = activeLineElement.clientHeight;

      const top = lineTop - containerHeight / 2 + lineHeight / 2;
      this.lyricsContainer.scrollTo({ top, behavior: 'smooth' });
    }
  }

  private scrollToInstrumental(insertBeforeIndex: number) {
    if (!this.lyricsContainer) return;
    const target = this.lyricsContainer.querySelector(
      `.lyrics-line:nth-child(${insertBeforeIndex + 1})`,
    ) as HTMLElement | null;

    if (target) {
      const containerHeight = this.lyricsContainer.clientHeight;
      const lineTop = target.offsetTop;
      const lineHeight = target.clientHeight;
      const top = lineTop - containerHeight / 2 + lineHeight / 2;
      this.lyricsContainer.scrollTo({ top, behavior: 'smooth' });
    }
  }

  private animateProgress() {
    const now = performance.now();
    let running = false;

    if (!this.lyrics || this.activeLineIndices.length === 0) {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = undefined;
      }
      return;
    }

    // Process each active line
    for (const lineIndex of this.activeLineIndices) {
      const line = this.lyrics[lineIndex];
      const mainWordAnimation = this.mainWordAnimations.get(lineIndex);

      // Main text animation
      if (mainWordAnimation && mainWordAnimation.duration > 0) {
        const elapsed = now - mainWordAnimation.startTime;
        if (elapsed >= 0) {
          const progress = Math.min(1, elapsed / mainWordAnimation.duration);
          this.mainWordProgress.set(lineIndex, progress);

          if (progress < 1) {
            running = true;
          } else {
            // Word animation finished. Look for the next word in the same line.
            const currentMainWordIndex =
              this.activeMainWordIndices.get(lineIndex) ?? -1;
            const nextWordIndex = currentMainWordIndex + 1;
            if (
              currentMainWordIndex !== -1 &&
              nextWordIndex < line.text.length
            ) {
              const currentWord = line.text[currentMainWordIndex];
              const nextWord = line.text[nextWordIndex];

              this.activeMainWordIndices.set(lineIndex, nextWordIndex);
              const gap = nextWord.timestamp - currentWord.endtime;
              const nextWordDuration = nextWord.endtime - nextWord.timestamp;

              this.mainWordAnimations.set(lineIndex, {
                startTime: performance.now() + gap,
                duration: nextWordDuration,
              });
              running = true;
            } else {
              this.mainWordAnimations.set(lineIndex, {
                startTime: 0,
                duration: 0,
              });
            }
          }
        } else {
          // Waiting in a gap
          this.mainWordProgress.set(lineIndex, 0);
          running = true;
        }
      }

      // Background text animation
      const backgroundWordAnimation =
        this.backgroundWordAnimations.get(lineIndex);
      if (backgroundWordAnimation && backgroundWordAnimation.duration > 0) {
        const elapsed = now - backgroundWordAnimation.startTime;
        if (elapsed >= 0) {
          const progress = Math.min(
            1,
            elapsed / backgroundWordAnimation.duration,
          );
          this.backgroundWordProgress.set(lineIndex, progress);

          if (progress < 1) {
            running = true;
          } else {
            // Word animation finished. Look for the next word in the same line.
            const currentBackgroundWordIndex =
              this.activeBackgroundWordIndices.get(lineIndex) ?? -1;
            if (
              line.backgroundText &&
              currentBackgroundWordIndex !== -1 &&
              currentBackgroundWordIndex < line.backgroundText.length - 1
            ) {
              const nextWordIndex = currentBackgroundWordIndex + 1;
              const currentWord =
                line.backgroundText[currentBackgroundWordIndex];
              const nextWord = line.backgroundText[nextWordIndex];

              this.activeBackgroundWordIndices.set(lineIndex, nextWordIndex);
              const gap = nextWord.timestamp - currentWord.endtime;
              const nextWordDuration = nextWord.endtime - nextWord.timestamp;

              this.backgroundWordAnimations.set(lineIndex, {
                startTime: performance.now() + gap,
                duration: nextWordDuration,
              });
              running = true;
            } else {
              this.backgroundWordAnimations.set(lineIndex, {
                startTime: 0,
                duration: 0,
              });
            }
          }
        } else {
          // Waiting in a gap
          this.backgroundWordProgress.set(lineIndex, 0);
          running = true;
        }
      }
    }

    if (running) {
      this.animationFrameId = requestAnimationFrame(
        this.animateProgress.bind(this),
      );
    } else if (this.animationFrameId) {
      // Stop animation if no words are running
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }

  render() {
    if (this.fontFamily) {
      this.style.fontFamily = this.fontFamily;
    }
    this.style.setProperty(
      '--hover-background-color',
      this.hoverBackgroundColor,
    );

    const renderContent = () => {
      if (this.isLoading) {
        return html`<div class="loading-indicator">Loading...</div>`;
      }
      if (!this.lyrics || this.lyrics.length === 0) {
        return html`<div class="no-lyrics">No lyrics found.</div>`;
      }

      const instrumental = this.findInstrumentalGapAt(this.currentTime);

      return this.lyrics.map((line, lineIndex) => {
        const isLineActive = this.activeLineIndices.includes(lineIndex);
        const bgIsPlayingNow =
          line.backgroundText && line.backgroundText.length > 0
            ? line.backgroundText.some(
                syl =>
                  this.currentTime >= syl.timestamp &&
                  this.currentTime <= syl.endtime,
              )
            : false;

        let maybeInstrumentalBlock: unknown = null;
        if (instrumental && instrumental.insertBeforeIndex === lineIndex) {
          const remainingSeconds = Math.max(
            0,
            Math.ceil((instrumental.gapEnd - this.currentTime) / 1000),
          );
          if (remainingSeconds > 0) {
            maybeInstrumentalBlock = html`<div
              class="instrumental-line"
              aria-label="Instrumental gap"
            >
              <span class="instrumental-duration">${remainingSeconds}s</span>
            </div>`;
          }
        }

        return html`
          ${maybeInstrumentalBlock}
          <div
            class="lyrics-line ${line.oppositeTurn
              ? 'opposite-turn'
              : ''} ${isLineActive ? 'active-line' : ''}"
            @click=${() => this.handleLineClick(line)}
            tabindex="0"
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                this.handleLineClick(line);
              }
            }}
          >
            <span>
              ${line.text.map((syllable, wordIndex) => {
                const activeMainWordIndex =
                  this.activeMainWordIndices.get(lineIndex) ?? -1;
                const isWordActive =
                  isLineActive && wordIndex === activeMainWordIndex;
                const isWordPassed =
                  isLineActive &&
                  (wordIndex < activeMainWordIndex ||
                    (activeMainWordIndex === -1 &&
                      this.currentTime > syllable.endtime));
                let progress = 0;
                if (isWordActive) {
                  progress = this.interpolate
                    ? (this.mainWordProgress.get(lineIndex) ?? 0)
                    : 1;
                } else if (isWordPassed) {
                  progress = 1;
                }

                return html`<span
                  class="progress-text"
                  style="--line-progress: ${progress *
                  100}%; margin-right: ${syllable.part
                    ? '0'
                    : '.5ch'}; --transition-style: ${isLineActive
                    ? 'all'
                    : 'color'}; --highlight-color: ${this.highlightColor}"
                  data-text="${syllable.text}${syllable.part ? ' ' : ''}"
                  >${syllable.text}</span
                >`;
              })}
            </span>
            ${line.backgroundText &&
            line.backgroundText.length > 0 &&
            (isLineActive || bgIsPlayingNow)
              ? html`<span class="background-text">
                  ${line.backgroundText.map((syllable, wordIndex) => {
                    const activeBackgroundWordIndex =
                      this.activeBackgroundWordIndices.get(lineIndex) ?? -1;
                    const isWordActive =
                      isLineActive && wordIndex === activeBackgroundWordIndex;
                    const isWordPassed =
                      isLineActive &&
                      (wordIndex < activeBackgroundWordIndex ||
                        (activeBackgroundWordIndex === -1 &&
                          this.currentTime > syllable.endtime));
                    let progress = 0;
                    if (isWordActive) {
                      progress = this.interpolate
                        ? (this.backgroundWordProgress.get(lineIndex) ?? 0)
                        : 1;
                    } else if (isWordPassed) {
                      progress = 1;
                    }

                    return html`<span
                      class="progress-text"
                      style="--line-progress: ${progress *
                      100}%; margin-right: ${syllable.part
                        ? '0'
                        : '.5ch'}; --transition-style: ${isLineActive
                        ? 'all'
                        : 'color'}; --highlight-color: ${this.highlightColor}"
                      data-text="${syllable.text}"
                      >${syllable.text}</span
                    >`;
                  })}
                </span>`
              : ''}
          </div>
        `;
      });
    };

    return html`
      <div class="lyrics-container">
        ${renderContent()}
        ${!this.isLoading
          ? html` <footer
              class="lyrics-footer ${this.hideSourceFooter ? 'compact' : ''}"
            >
              ${!this.hideSourceFooter ? html`<p>Source: Apple Music</p>` : ''}
              v${VERSION} •
              <a
                href="https://github.com/uimaxbai/apple-music-web-components"
                target="_blank"
                rel="noopener noreferrer"
                >Star me on GitHub
              </a>
            </footer>`
          : ''}
      </div>
    `;
  }
}
