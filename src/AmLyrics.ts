import { html, css, LitElement } from 'lit';
import { property, state, query } from 'lit/decorators.js';

const VERSION = '0.4.1';

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
      color: rgba(136, 136, 136, 0.7);
      font-size: 0.8em;
      font-style: italic;
      margin-left: 10px;
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
  private activeLineIndex = -1;

  @state()
  private activeMainWordIndex = -1;

  @state()
  private activeBackgroundWordIndex = -1;

  @state()
  private mainWordProgress = 0;

  @state()
  private backgroundWordProgress = 0;

  private animationFrameId?: number;

  private mainWordAnimation = { startTime: 0, duration: 0 };

  private backgroundWordAnimation = { startTime: 0, duration: 0 };

  @query('.lyrics-container')
  private lyricsContainer?: HTMLElement;

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

      const newLineIndex = this.findActiveLineIndex(this.currentTime);

      // Reset animation if line changes or if we skip time.
      // A threshold of 0.5s (500ms) is used to detect a "skip".
      if (newLineIndex !== this.activeLineIndex || timeDiff > 0.5) {
        this.startAnimationFromTime(this.currentTime);
      }
      // For small, continuous updates, we do nothing and let the animation loop handle it.
    }

    if (
      this.autoScroll &&
      changedProperties.has('activeLineIndex') &&
      this.activeLineIndex !== -1
    ) {
      this.scrollToActiveLine();
    }
  }

  private findActiveLineIndex(time: number): number {
    if (!this.lyrics) return -1;
    for (let i = 0; i < this.lyrics.length; i += 1) {
      if (time >= this.lyrics[i].timestamp && time <= this.lyrics[i].endtime) {
        return i;
      }
    }
    return -1;
  }

  private startAnimationFromTime(time: number) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    if (!this.lyrics) return;

    const lineIndex = this.findActiveLineIndex(time);
    this.activeLineIndex = lineIndex;

    if (lineIndex === -1) {
      this.activeMainWordIndex = -1;
      this.activeBackgroundWordIndex = -1;
      this.mainWordAnimation = { startTime: 0, duration: 0 };
      this.backgroundWordAnimation = { startTime: 0, duration: 0 };
      return;
    }

    const line = this.lyrics[lineIndex];

    // Find main word based on the reset time
    let mainWordIdx = -1;
    for (let i = 0; i < line.text.length; i += 1) {
      if (time >= line.text[i].timestamp && time <= line.text[i].endtime) {
        mainWordIdx = i;
        break;
      }
    }
    this.activeMainWordIndex = mainWordIdx;

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
    this.activeBackgroundWordIndex = backWordIdx;

    // With the state correctly set, configure the animation parameters
    this.setupAnimations();

    // Start the animation loop
    if (this.interpolate) {
      this.animateProgress();
    }
  }

  private updateActiveLineAndWords() {
    if (!this.lyrics) return;

    const lineIdx = this.findActiveLineIndex(this.currentTime);
    this.activeLineIndex = lineIdx;

    if (lineIdx !== -1) {
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
      this.activeMainWordIndex = mainWordIdx;

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
      this.activeBackgroundWordIndex = backWordIdx;
    } else {
      this.activeMainWordIndex = -1;
      this.activeBackgroundWordIndex = -1;
    }
  }

  private setupAnimations() {
    if (this.activeLineIndex === -1 || !this.lyrics) {
      this.mainWordAnimation = { startTime: 0, duration: 0 };
      this.backgroundWordAnimation = { startTime: 0, duration: 0 };
      return;
    }

    const line = this.lyrics[this.activeLineIndex];

    // Main word animation
    if (this.activeMainWordIndex !== -1) {
      const word = line.text[this.activeMainWordIndex];
      const wordDuration = word.endtime - word.timestamp;
      const elapsedInWord = this.currentTime - word.timestamp;
      this.mainWordAnimation = {
        startTime: performance.now() - elapsedInWord,
        duration: wordDuration,
      };
    } else {
      this.mainWordAnimation = { startTime: 0, duration: 0 };
    }

    // Background word animation
    if (this.activeBackgroundWordIndex !== -1 && line.backgroundText) {
      const word = line.backgroundText[this.activeBackgroundWordIndex];
      const wordDuration = word.endtime - word.timestamp;
      const elapsedInWord = this.currentTime - word.timestamp;
      this.backgroundWordAnimation = {
        startTime: performance.now() - elapsedInWord,
        duration: wordDuration,
      };
    } else {
      this.backgroundWordAnimation = { startTime: 0, duration: 0 };
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
    if (!this.lyricsContainer || this.activeLineIndex < 0) {
      return;
    }

    const activeLineElement = this.lyricsContainer.querySelector(
      `.lyrics-line:nth-child(${this.activeLineIndex + 1})`,
    ) as HTMLElement;

    if (activeLineElement) {
      const containerHeight = this.lyricsContainer.clientHeight;
      const lineTop = activeLineElement.offsetTop;
      const lineHeight = activeLineElement.clientHeight;

      this.lyricsContainer.scrollTop =
        lineTop - containerHeight / 2 + lineHeight / 2;
    }
  }

  private animateProgress() {
    const now = performance.now();
    let running = false;

    const line = this.lyrics?.[this.activeLineIndex];
    if (!line) {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = undefined;
      }
      return;
    }

    // Main text animation
    if (this.mainWordAnimation.duration > 0) {
      const elapsed = now - this.mainWordAnimation.startTime;
      if (elapsed >= 0) {
        const progress = Math.min(1, elapsed / this.mainWordAnimation.duration);
        this.mainWordProgress = progress;

        if (progress < 1) {
          running = true;
        } else {
          // Word animation finished. Look for the next word in the same line.
          this.mainWordAnimation.duration = 0;
          const nextWordIndex = this.activeMainWordIndex + 1;
          if (
            this.activeMainWordIndex !== -1 &&
            nextWordIndex < line.text.length
          ) {
            const currentWord = line.text[this.activeMainWordIndex];
            const nextWord = line.text[nextWordIndex];

            this.activeMainWordIndex = nextWordIndex;
            const gap = nextWord.timestamp - currentWord.endtime;
            const nextWordDuration = nextWord.endtime - nextWord.timestamp;

            this.mainWordAnimation = {
              startTime: performance.now() + gap,
              duration: nextWordDuration,
            };
            running = true;
          }
        }
      } else {
        // Waiting in a gap
        this.mainWordProgress = 0;
        running = true;
      }
    }

    // Background text animation
    if (this.backgroundWordAnimation.duration > 0) {
      const elapsed = now - this.backgroundWordAnimation.startTime;
      if (elapsed >= 0) {
        const progress = Math.min(
          1,
          elapsed / this.backgroundWordAnimation.duration,
        );
        this.backgroundWordProgress = progress;

        if (progress < 1) {
          running = true;
        } else {
          // Word animation finished. Look for the next word in the same line.
          this.backgroundWordAnimation.duration = 0;
          if (
            line.backgroundText &&
            this.activeBackgroundWordIndex !== -1 &&
            this.activeBackgroundWordIndex < line.backgroundText.length - 1
          ) {
            const nextWordIndex = this.activeBackgroundWordIndex + 1;
            const currentWord =
              line.backgroundText[this.activeBackgroundWordIndex];
            const nextWord = line.backgroundText[nextWordIndex];

            this.activeBackgroundWordIndex = nextWordIndex;
            const gap = nextWord.timestamp - currentWord.endtime;
            const nextWordDuration = nextWord.endtime - nextWord.timestamp;

            this.backgroundWordAnimation = {
              startTime: performance.now() + gap,
              duration: nextWordDuration,
            };
            running = true;
          }
        }
      } else {
        // Waiting in a gap
        this.backgroundWordProgress = 0;
        running = true;
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
      return this.lyrics.map((line, lineIndex) => {
        const isLineActive = lineIndex === this.activeLineIndex;

        return html`
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
                const isWordActive =
                  isLineActive && wordIndex === this.activeMainWordIndex;
                const isWordPassed =
                  isLineActive &&
                  (wordIndex < this.activeMainWordIndex ||
                    (this.activeMainWordIndex === -1 &&
                      this.currentTime > syllable.endtime));
                let progress = 0;
                if (isWordActive) {
                  progress = this.interpolate ? this.mainWordProgress : 1;
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
            ${line.backgroundText && line.backgroundText.length > 0
              ? html`<span class="background-text">
                  ${line.backgroundText.map((syllable, wordIndex) => {
                    const isWordActive =
                      isLineActive &&
                      wordIndex === this.activeBackgroundWordIndex;
                    const isWordPassed =
                      isLineActive &&
                      (wordIndex < this.activeBackgroundWordIndex ||
                        (this.activeBackgroundWordIndex === -1 &&
                          this.currentTime > syllable.endtime));
                    let progress = 0;
                    if (isWordActive) {
                      progress = this.interpolate
                        ? this.backgroundWordProgress
                        : 1;
                    } else if (isWordPassed) {
                      progress = 1;
                    }

                    return html`<span
                      class="progress-text"
                      style="--line-progress: ${progress *
                      100}%; ; margin-right: ${syllable.part
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
