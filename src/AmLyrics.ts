import { html, css, LitElement } from 'lit';
import { property, state, query } from 'lit/decorators.js';

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
      background-color: #f0f0f0;
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
      transition: width 0.05s cubic-bezier(0.25, 0.1, 0.25, 1.5);
      white-space: nowrap;
      transition: var(--transition-style, all) 0.05s;
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

  @property({ type: Boolean, attribute: 'hide-source-footer' })
  hideSourceFooter = false;

  @property({ type: String, attribute: 'font-family' })
  fontFamily?: string;

  @property({ type: Boolean })
  autoScroll = true;

  @property({ type: Number })
  duration?: number;

  @property({ type: Number })
  currentTime = 0;

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

  @query('.lyrics-container')
  private lyricsContainer?: HTMLElement;

  connectedCallback() {
    super.connectedCallback();
    this.fetchLyrics();
  }

  private async fetchLyrics() {
    const baseURL = 'https://paxsenix.alwaysdata.net/';
    let appleID = this.musicId;

    if (!appleID && this.query) {
      const search = encodeURIComponent(this.query);
      try {
        const searchResponse = await fetch(
          `${baseURL}searchAppleMusic.php?q=${search}`,
        );
        if (!searchResponse.ok) {
          console.error('Search failed', searchResponse);
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
        console.error('Error during search', e);
        return;
      }
    }

    if (appleID) {
      try {
        const lyricsResponse = await fetch(
          `${baseURL}getAppleMusicLyrics.php?id=${appleID}`,
        );
        if (!lyricsResponse.ok) {
          console.error('Failed to get lyrics', lyricsResponse);
          return;
        }
        const lyricsData: LyricsResponse = await lyricsResponse.json();
        this.lyrics = lyricsData.content;
        if (this.lyricsContainer) {
          this.lyricsContainer.scrollTop = 0;
        }
      } catch (e) {
        console.error('Error fetching lyrics', e);
      }
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
      const oldActiveLineIndex = this.activeLineIndex;
      let lineIdx = -1;

      for (let i = 0; i < this.lyrics.length; i += 1) {
        if (
          this.currentTime >= this.lyrics[i].timestamp &&
          this.currentTime <= this.lyrics[i].endtime
        ) {
          lineIdx = i;
          break;
        }
      }

      this.activeLineIndex = lineIdx;

      if (lineIdx !== -1) {
        const line = this.lyrics[lineIdx];

        // Find active main word
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

        if (mainWordIdx !== -1) {
          const word = line.text[mainWordIdx];
          const wordDuration = word.endtime - word.timestamp;
          if (wordDuration > 0) {
            this.mainWordProgress = Math.max(
              0,
              Math.min(1, (this.currentTime - word.timestamp) / wordDuration),
            );
          }
        } else {
          this.mainWordProgress = 0;
        }

        // Find active background word
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

        if (backWordIdx !== -1) {
          const word = line.backgroundText[backWordIdx];
          const wordDuration = word.endtime - word.timestamp;
          if (wordDuration > 0) {
            this.backgroundWordProgress = Math.max(
              0,
              Math.min(1, (this.currentTime - word.timestamp) / wordDuration),
            );
          }
        } else {
          this.backgroundWordProgress = 0;
        }
      } else {
        this.activeMainWordIndex = -1;
        this.activeBackgroundWordIndex = -1;
        this.mainWordProgress = 0;
        this.backgroundWordProgress = 0;
      }

      if (this.autoScroll && this.activeLineIndex !== oldActiveLineIndex) {
        this.scrollToActiveLine();
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

  render() {
    if (this.fontFamily) {
      this.style.fontFamily = this.fontFamily;
    }

    return html`
      <div class="lyrics-container">
        ${this.lyrics?.map((line, lineIndex) => {
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
                    progress = this.mainWordProgress;
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
                        progress = this.backgroundWordProgress;
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
        })}
      </div>
      <footer class="lyrics-footer ${this.hideSourceFooter ? '' : 'compact'}">
        ${!this.hideSourceFooter ? '' : html`<p>Source: Apple Music</p>`}
        <a
          href="https://github.com/uimaxbai/apple-music-web-components"
          target="_blank"
          rel="noopener noreferrer"
          >Star me on GitHub
        </a>
      </footer>
    `;
  }
}
