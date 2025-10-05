import { html, css, LitElement } from 'lit';
import { property, state, query } from 'lit/decorators.js';

const VERSION = '0.5.3';
const INSTRUMENTAL_THRESHOLD_MS = 3000; // Show ellipsis for gaps >= 3s
const BASE_API_URL = 'https://paxsenix.alwaysdata.net/';
const KPOE_SERVERS = [
  'https://lyricsplus.prjktla.workers.dev',
  'https://lyrics-plus-backend.vercel.app',
  'https://lyricsplus.onrender.com',
  'https://lyricsplus.prjktla.online',
];
const DEFAULT_KPOE_SOURCE_ORDER =
  'apple,lyricsplus,musixmatch,spotify,musixmatch-word';

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

interface SongMetadata {
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
}

interface SongCatalogResult {
  title?: string;
  artist?: string;
  album?: string;
  durationMs?: number;
  id?: {
    appleMusic?: string;
    [key: string]: unknown;
  };
  isrc?: string;
}

interface ParsedQueryMetadata {
  title?: string;
  artist?: string;
  album?: string;
}

interface YouLyPlusLyricsResult {
  lines: LyricsLine[];
  source?: string;
}

interface ResolvedMetadata {
  metadata?: SongMetadata;
  appleId?: string;
  appleSong?: any;
  catalogIsrc?: string;
}

export class AmLyrics extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family:
        -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
        Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background: transparent;
      height: 100%;
      overflow: hidden; /* Ensure the host doesn't show scrollbars */
    }

    .lyrics-container {
      padding: 20px;
      border-radius: 8px;
      background-color: transparent;
      width: 100%;
      height: 100%;
      max-height: 100vh; /* Ensure it doesn't exceed viewport height */
      overflow-y: auto;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch; /* iOS smooth scrolling */
      box-sizing: border-box; /* Include padding in height calculation */
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
      word-wrap: break-word;
      overflow-wrap: break-word;
      display: flex;
      flex-direction: column; /* Allow reordering of main and background text */
      line-height: 1.2; /* Tighten line height to reduce gaps */
      gap: 2px; /* Small consistent gap between main and background text */
      /* Performance optimizations */
      contain: layout style paint;
      transform: translate3d(0, 0, 0);
    }

    .lyrics-line > span {
      flex-shrink: 0; /* Prevent the main text span from shrinking */
      margin: 0; /* Remove default margins */
    }

    .lyrics-line:hover {
      background-color: var(
        --am-lyrics-hover-background,
        var(--hover-background-color, #f0f0f0)
      );
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
      /* Use background gradient for highlighting instead of pseudo-element */
      background: linear-gradient(
        to right,
        var(--am-lyrics-highlight-color, var(--highlight-color, #000)) 0%,
        var(--am-lyrics-highlight-color, var(--highlight-color, #000))
          var(--line-progress, 0%),
        #888 var(--line-progress, 0%),
        #888 100%
      );
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      /* Fallback for browsers that don't support background-clip: text */
      color: #888;
      white-space: pre-wrap;
      /* Performance optimizations */
      transform: translate3d(0, 0, 0);
      will-change: background-size;
    }

    .progress-text::before {
      /* Remove the pseudo-element approach entirely */
      display: none;
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
      margin: 0; /* Remove margins - use flexbox gap instead */
      flex-shrink: 0; /* Prevent shrinking */
      line-height: 1.1; /* Slightly tighter line height for background text */
    }

    .background-text.before {
      order: -1; /* Place before main text when background starts earlier */
    }

    .background-text.after {
      order: 1; /* Place after main text when background starts later */
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

  @property({ type: String, attribute: 'song-title' })
  songTitle?: string;

  @property({ type: String, attribute: 'song-artist' })
  songArtist?: string;

  @property({ type: String, attribute: 'song-album' })
  songAlbum?: string;

  @property({ type: Number, attribute: 'song-duration' })
  songDurationMs?: number;

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

  @state()
  private lyricsSource: string | null = null;

  @state()
  private shouldNormalizeSpacing = false;

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

  private userScrollTimeoutId?: number;

  @state()
  private isUserScrolling = false;

  private isProgrammaticScroll = false;

  connectedCallback() {
    super.connectedCallback();
    this.fetchLyrics();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.userScrollTimeoutId) {
      clearTimeout(this.userScrollTimeoutId);
    }
  }

  private async fetchLyrics() {
    this.isLoading = true;
    this.lyrics = undefined;
    this.lyricsSource = null;
    this.shouldNormalizeSpacing = false;
    try {
      const resolvedMetadata = await this.resolveSongMetadata();

      const isMusicIdOnlyRequest =
        Boolean(this.musicId) &&
        !this.songTitle &&
        !this.songArtist &&
        !this.query;

      if (resolvedMetadata?.metadata && !isMusicIdOnlyRequest) {
        const youLyResult = await AmLyrics.fetchLyricsFromYouLyPlus(
          resolvedMetadata.metadata,
        );

        if (youLyResult && youLyResult.lines.length > 0) {
          this.lyrics = youLyResult.lines;
          this.lyricsSource = youLyResult.source ?? 'LyricsPlus (KPoe)';
          this.shouldNormalizeSpacing = false;
          this.onLyricsLoaded();
          return;
        }
      }

      let fallbackAppleId = resolvedMetadata?.appleId ?? this.musicId;
      let fallbackAppleSong = resolvedMetadata?.appleSong;

      if (!fallbackAppleId && this.query) {
        fallbackAppleSong =
          fallbackAppleSong ??
          (await this.searchAppleMusic(
            this.query,
            resolvedMetadata?.catalogIsrc ?? this.isrc,
          ));

        if (fallbackAppleSong) {
          fallbackAppleId =
            fallbackAppleSong.id ?? fallbackAppleSong.appleId ?? undefined;
        }
      }

      const appleResult = await this.fetchLyricsFromApple(fallbackAppleId);

      if (appleResult && appleResult.lines.length > 0) {
        const spacedLines = AmLyrics.ensureAppleWordSpacing(appleResult.lines);
        this.lyrics = spacedLines;
        this.lyricsSource = appleResult.source ?? 'Apple Music';
        this.shouldNormalizeSpacing = true;
        this.onLyricsLoaded();
        return;
      }

      this.lyrics = undefined;
      this.lyricsSource = null;
    } finally {
      this.isLoading = false;
    }
  }

  private onLyricsLoaded() {
    this.activeLineIndices = [];
    this.activeMainWordIndices.clear();
    this.activeBackgroundWordIndices.clear();
    this.mainWordProgress.clear();
    this.backgroundWordProgress.clear();
    this.mainWordAnimations.clear();
    this.backgroundWordAnimations.clear();

    if (this.lyricsContainer) {
      this.isProgrammaticScroll = true;
      this.lyricsContainer.scrollTop = 0;
      window.setTimeout(() => {
        this.isProgrammaticScroll = false;
      }, 100);
    }
  }

  private async resolveSongMetadata(): Promise<ResolvedMetadata> {
    const metadata: SongMetadata = {
      title: this.songTitle?.trim() ?? '',
      artist: this.songArtist?.trim() ?? '',
      album: this.songAlbum?.trim() || undefined,
      durationMs: undefined,
    };

    if (typeof this.songDurationMs === 'number' && this.songDurationMs > 0) {
      metadata.durationMs = this.songDurationMs;
    } else if (typeof this.duration === 'number' && this.duration > 0) {
      metadata.durationMs = this.duration;
    }

    let appleSong: any = null;
    let appleId = this.musicId;
    let catalogIsrc: string | undefined;

    if (
      this.query &&
      (!metadata.title || !metadata.artist || !metadata.album)
    ) {
      const parsed = AmLyrics.parseQueryMetadata(this.query);
      if (parsed) {
        if (!metadata.title && parsed.title) {
          metadata.title = parsed.title;
        }
        if (!metadata.artist && parsed.artist) {
          metadata.artist = parsed.artist;
        }
        if (!metadata.album && parsed.album) {
          metadata.album = parsed.album;
        }
      }
    }

    let catalogResult: SongCatalogResult | null = null;

    if (this.query) {
      catalogResult = await AmLyrics.searchLyricsPlusCatalog(this.query);

      if (catalogResult) {
        if (!metadata.title && catalogResult.title) {
          metadata.title = catalogResult.title;
        }
        if (!metadata.artist && catalogResult.artist) {
          metadata.artist = catalogResult.artist;
        }
        if (!metadata.album && catalogResult.album) {
          metadata.album = catalogResult.album;
        }
        if (
          metadata.durationMs == null &&
          typeof catalogResult.durationMs === 'number' &&
          catalogResult.durationMs > 0
        ) {
          metadata.durationMs = catalogResult.durationMs;
        }

        if (!appleId && catalogResult.id?.appleMusic) {
          appleId = catalogResult.id.appleMusic;
        }

        if (!catalogIsrc && catalogResult.isrc) {
          catalogIsrc = catalogResult.isrc;
        }
      }
    }

    if (this.query) {
      const needsMetadata = !metadata.title || !metadata.artist;
      const needsAppleId = !appleId;

      if (needsMetadata || needsAppleId) {
        appleSong = await this.searchAppleMusic(
          this.query,
          catalogIsrc ?? this.isrc,
        );

        if (appleSong) {
          if (needsAppleId && !appleId) {
            appleId = appleSong.id ?? appleSong.appleId ?? undefined;
          }

          if (!metadata.title) {
            const appleTitle =
              appleSong?.attributes?.name || appleSong?.name || '';
            if (appleTitle) {
              metadata.title = appleTitle;
            }
          }
          if (!metadata.artist) {
            const appleArtist =
              appleSong?.attributes?.artistName ||
              appleSong?.artistName ||
              appleSong?.artist ||
              '';
            if (appleArtist) {
              metadata.artist = appleArtist;
            }
          }
          if (!metadata.album) {
            const appleAlbum =
              appleSong?.attributes?.albumName ||
              appleSong?.albumName ||
              appleSong?.album;
            if (appleAlbum) {
              metadata.album = appleAlbum;
            }
          }

          const durationCandidate =
            appleSong?.attributes?.durationInMillis ??
            appleSong?.durationInMillis ??
            appleSong?.duration ??
            undefined;

          if (
            metadata.durationMs == null &&
            typeof durationCandidate === 'number' &&
            durationCandidate > 0
          ) {
            metadata.durationMs = durationCandidate;
          }
        }
      }
    }

    const trimmedTitle = metadata.title?.trim() ?? '';
    const trimmedArtist = metadata.artist?.trim() ?? '';
    const trimmedAlbum = metadata.album?.trim();
    const sanitizedDuration =
      typeof metadata.durationMs === 'number' &&
      Number.isFinite(metadata.durationMs) &&
      metadata.durationMs > 0
        ? Math.round(metadata.durationMs)
        : undefined;

    const finalMetadata =
      trimmedTitle && trimmedArtist
        ? {
            title: trimmedTitle,
            artist: trimmedArtist,
            album: trimmedAlbum || undefined,
            durationMs: sanitizedDuration,
          }
        : undefined;

    return {
      metadata: finalMetadata,
      appleId,
      appleSong,
      catalogIsrc,
    };
  }

  private async searchAppleMusic(
    searchTerm: string,
    isrcMatch?: string,
  ): Promise<any | null> {
    const trimmedQuery = searchTerm?.trim();
    if (!trimmedQuery) return null;

    try {
      const response = await fetch(
        `${BASE_API_URL}searchAppleMusic.php?q=${encodeURIComponent(trimmedQuery)}`,
      );
      if (!response.ok) {
        return null;
      }

      const decoded = await response.json();
      if (!Array.isArray(decoded) || decoded.length === 0) {
        return null;
      }

      const targetIsrc = (isrcMatch ?? this.isrc)?.trim();
      if (targetIsrc) {
        const match = decoded.find((item: any) => {
          const candidateIsrc =
            item?.isrc || item?.attributes?.isrc || item?.attributes?.isrcValue;
          return (
            typeof candidateIsrc === 'string' && candidateIsrc === targetIsrc
          );
        });
        if (match) {
          return match;
        }
      }

      return decoded[0];
    } catch (error) {
      return null;
    }
  }

  private static parseQueryMetadata(
    rawQuery: string,
  ): ParsedQueryMetadata | null {
    const trimmed = rawQuery?.trim();
    if (!trimmed) return null;

    const result: ParsedQueryMetadata = {};

    const hyphenSplit = trimmed.split(/\s[-–—]\s/);
    if (hyphenSplit.length >= 2) {
      const [rawTitle, ...rest] = hyphenSplit;
      const rawArtist = rest.join(' - ');
      const titleCandidate = rawTitle.trim();
      const artistCandidate = rawArtist.trim();
      if (titleCandidate && artistCandidate) {
        result.title = titleCandidate;
        result.artist = artistCandidate;
        return result;
      }
    }

    const bySplit = trimmed.split(/\s+[bB]y\s+/);
    if (bySplit.length === 2) {
      const [maybeTitle, maybeArtist] = bySplit.map(part => part.trim());
      if (maybeTitle && maybeArtist) {
        result.title = maybeTitle;
        result.artist = maybeArtist;
        return result;
      }
    }

    return null;
  }

  private static async searchLyricsPlusCatalog(
    searchTerm: string,
  ): Promise<SongCatalogResult | null> {
    const trimmedQuery = searchTerm?.trim();
    if (!trimmedQuery) return null;

    for (const base of KPOE_SERVERS) {
      const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const url = `${normalizedBase}/v1/songlist/search?q=${encodeURIComponent(
        trimmedQuery,
      )}`;

      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(url);
        if (response.ok) {
          // eslint-disable-next-line no-await-in-loop
          const payload = await response.json();
          let results: SongCatalogResult[] = [];

          const typedPayload = payload as {
            results?: SongCatalogResult[];
          } | null;

          if (Array.isArray(typedPayload?.results)) {
            results = typedPayload.results as SongCatalogResult[];
          } else if (Array.isArray(payload)) {
            results = payload as SongCatalogResult[];
          }

          if (results.length > 0) {
            const primary = results.find(
              (item: SongCatalogResult) => item?.id && item.id.appleMusic,
            );
            return (primary ?? results[0]) as SongCatalogResult;
          }
        }
      } catch (error) {
        // Ignore and try next server
      }
    }

    return null;
  }

  private static async fetchLyricsFromYouLyPlus(
    metadata: SongMetadata,
  ): Promise<YouLyPlusLyricsResult | null> {
    const title = metadata.title?.trim();
    const artist = metadata.artist?.trim();

    if (!title || !artist) {
      return null;
    }

    const params = new URLSearchParams({ title, artist });

    if (metadata.album) {
      params.append('album', metadata.album);
    }

    if (metadata.durationMs && metadata.durationMs > 0) {
      params.append(
        'duration',
        Math.round(metadata.durationMs / 1000).toString(),
      );
    }

    params.append('source', DEFAULT_KPOE_SOURCE_ORDER);

    for (const base of KPOE_SERVERS) {
      const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const url = `${normalizedBase}/v2/lyrics/get?${params.toString()}`;

      let payload: any = null;

      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(url);
        if (response.ok) {
          // eslint-disable-next-line no-await-in-loop
          payload = await response.json();
        }
      } catch (error) {
        payload = null;
      }

      if (payload) {
        const lines = AmLyrics.convertKPoeLyrics(payload);
        if (lines && lines.length > 0) {
          const sourceLabel =
            payload?.metadata?.source ||
            payload?.metadata?.provider ||
            'LyricsPlus (KPoe)';
          return { lines, source: sourceLabel };
        }
      }
    }

    return null;
  }

  private async fetchLyricsFromApple(
    appleId?: string | null,
  ): Promise<YouLyPlusLyricsResult | null> {
    const resolvedId = appleId ?? this.musicId;
    if (!resolvedId) {
      return null;
    }

    try {
      const response = await fetch(
        `${BASE_API_URL}getAppleMusicLyrics.php?id=${encodeURIComponent(resolvedId)}`,
      );
      if (!response.ok) {
        return null;
      }

      const lyricsData: LyricsResponse = await response.json();
      if (!lyricsData?.content || !Array.isArray(lyricsData.content)) {
        return null;
      }

      return {
        lines: lyricsData.content,
        source: lyricsData.info || 'Apple Music',
      };
    } catch (error) {
      return null;
    }
  }

  private static convertKPoeLyrics(payload: any): LyricsLine[] | null {
    if (!payload) {
      return null;
    }

    let rawLyrics: any[] | null = null;
    if (Array.isArray(payload?.lyrics)) {
      rawLyrics = payload.lyrics;
    } else if (Array.isArray(payload?.data?.lyrics)) {
      rawLyrics = payload.data.lyrics;
    } else if (Array.isArray(payload?.data)) {
      rawLyrics = payload.data;
    }

    if (!rawLyrics || rawLyrics.length === 0) {
      return null;
    }

    const sanitizedEntries = rawLyrics.filter((item: any) => Boolean(item));
    const lines: LyricsLine[] = [];

    for (const entry of sanitizedEntries) {
      const lineText = typeof entry.text === 'string' ? entry.text : '';
      const lineStart = AmLyrics.toMilliseconds(entry.time);
      const lineDuration = AmLyrics.toMilliseconds(entry.duration);
      const explicitEnd = AmLyrics.toMilliseconds(entry.endTime);
      const lineEnd = explicitEnd || lineStart + (lineDuration || 0);

      const syllabus = Array.isArray(entry.syllabus)
        ? entry.syllabus.filter((s: any) => Boolean(s))
        : [];
      const mainSyllables: Syllable[] = [];
      const backgroundSyllables: Syllable[] = [];

      if (syllabus.length > 0) {
        for (const syl of syllabus) {
          const sylStart = AmLyrics.toMilliseconds(syl.time, lineStart);
          const sylDuration = AmLyrics.toMilliseconds(syl.duration);
          const sylEnd = sylDuration > 0 ? sylStart + sylDuration : lineEnd;
          const syllable: Syllable = {
            text: typeof syl.text === 'string' ? syl.text : '',
            part: Boolean(syl.part),
            timestamp: sylStart,
            endtime: sylEnd,
          };

          if (syl.isBackground) {
            backgroundSyllables.push(syllable);
          } else {
            mainSyllables.push(syllable);
          }
        }
      }

      if (mainSyllables.length === 0 && lineText) {
        mainSyllables.push({
          text: lineText,
          part: false,
          timestamp: lineStart,
          endtime: lineEnd || lineStart,
        });
      }

      const lineResult: LyricsLine = {
        text: mainSyllables,
        background: backgroundSyllables.length > 0,
        backgroundText: backgroundSyllables,
        oppositeTurn: Array.isArray(entry.element)
          ? entry.element.includes('opposite') ||
            entry.element.includes('right')
          : false,
        timestamp: lineStart,
        endtime: lineEnd || lineStart,
      };

      lines.push(lineResult);
    }

    return lines;
  }

  private static ensureAppleWordSpacing(lines: LyricsLine[]): LyricsLine[] {
    return lines.map(line => ({
      ...line,
      text: AmLyrics.applySpacingToSyllables(line.text),
      backgroundText: line.backgroundText
        ? AmLyrics.applySpacingToSyllables(line.backgroundText)
        : line.backgroundText,
    }));
  }

  private static applySpacingToSyllables(syllables: Syllable[]): Syllable[] {
    if (!Array.isArray(syllables)) {
      return syllables;
    }

    return syllables.map((syllable, index) => {
      if (!syllable || typeof syllable.text !== 'string') {
        return syllable;
      }

      const next = syllables[index + 1];
      const shouldAppendSpace =
        Boolean(next) &&
        !next?.part &&
        !syllable.text.endsWith(' ') &&
        !AmLyrics.endsWithNoSpaceMarker(syllable.text) &&
        !AmLyrics.startsWithPunctuation(next?.text ?? '');

      if (shouldAppendSpace) {
        return { ...syllable, text: `${syllable.text} ` };
      }

      return syllable;
    });
  }

  private static startsWithPunctuation(text: string): boolean {
    return /^[\s.,!?;:)\]}`“”"'’`-]/.test(text);
  }

  private static endsWithNoSpaceMarker(text: string): boolean {
    return /[\s\-–—~'’]$/.test(text);
  }

  private static shouldApplySyllableMargin(syllable: Syllable | undefined) {
    if (!syllable || syllable.part) {
      return false;
    }

    if (typeof syllable.text !== 'string' || syllable.text.length === 0) {
      return false;
    }

    return !AmLyrics.endsWithNoSpaceMarker(syllable.text);
  }

  private static toMilliseconds(value: unknown, fallback = 0): number {
    const num = Number(value);
    if (!Number.isFinite(num) || Number.isNaN(num)) {
      return fallback;
    }

    if (!Number.isInteger(num)) {
      return Math.round(num * 1000);
    }

    return Math.max(0, Math.round(num));
  }

  firstUpdated() {
    // Set up scroll event listener for user scroll detection
    if (this.lyricsContainer) {
      this.lyricsContainer.addEventListener(
        'scroll',
        this.handleUserScroll.bind(this),
        { passive: true },
      );
    }
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    // Handle duration reset (-1 stops playback and resets currentTime to 0)
    if (changedProperties.has('duration') && this.duration === -1) {
      this.currentTime = 0;
      this.activeLineIndices = [];
      this.activeMainWordIndices.clear();
      this.activeBackgroundWordIndices.clear();
      this.mainWordProgress.clear();
      this.backgroundWordProgress.clear();
      this.mainWordAnimations.clear();
      this.backgroundWordAnimations.clear();
      this.isUserScrolling = false;

      // Cancel any running animations
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = undefined;
      }

      // Clear user scroll timeout
      if (this.userScrollTimeoutId) {
        clearTimeout(this.userScrollTimeoutId);
        this.userScrollTimeoutId = undefined;
      }

      // Scroll to top
      if (this.lyricsContainer) {
        this.lyricsContainer.scrollTop = 0;
      }

      return; // Exit early, don't process other changes
    }

    if (
      (changedProperties.has('query') ||
        changedProperties.has('musicId') ||
        changedProperties.has('isrc') ||
        changedProperties.has('songTitle') ||
        changedProperties.has('songArtist') ||
        changedProperties.has('songAlbum') ||
        changedProperties.has('songDurationMs')) &&
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
      !this.isUserScrolling &&
      changedProperties.has('activeLineIndices') &&
      this.activeLineIndices.length > 0
    ) {
      this.scrollToActiveLine();
    }

    // Smoothly scroll to the indicator when entering a gap
    const instrumental = this.findInstrumentalGapAt(this.currentTime);
    const idx = instrumental ? instrumental.insertBeforeIndex : null;
    if (this.autoScroll && !this.isUserScrolling) {
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

  private handleUserScroll() {
    // Ignore programmatic scrolls
    if (this.isProgrammaticScroll) {
      return;
    }

    // Mark that user is currently scrolling
    this.isUserScrolling = true;

    // Clear any existing timeout
    if (this.userScrollTimeoutId) {
      clearTimeout(this.userScrollTimeoutId);
    }

    // Set timeout to re-enable auto-scroll after 2 seconds of no scrolling
    this.userScrollTimeoutId = window.setTimeout(() => {
      this.isUserScrolling = false;
      this.userScrollTimeoutId = undefined;

      // Optionally scroll back to current active line when re-enabling auto-scroll
      if (this.activeLineIndices.length > 0) {
        this.scrollToActiveLine();
      }
    }, 2000);
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

  private static getBackgroundTextPlacement(
    line: LyricsLine,
  ): 'before' | 'after' {
    if (
      !line.backgroundText ||
      line.backgroundText.length === 0 ||
      line.text.length === 0
    ) {
      return 'after'; // Default to after if no comparison is possible
    }

    // Compare the start times of the first syllables
    const mainTextStartTime = line.text[0].timestamp;
    const backgroundTextStartTime = line.backgroundText[0].timestamp;

    return backgroundTextStartTime < mainTextStartTime ? 'before' : 'after';
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

      // Check if the line has background text placed before the main text
      const hasBackgroundBefore = activeLineElement.querySelector(
        '.background-text.before',
      );

      // Calculate the offset to center the main text content, accounting for background text placement
      let offsetAdjustment = 0;
      if (hasBackgroundBefore) {
        const backgroundElement = hasBackgroundBefore as HTMLElement;
        offsetAdjustment = backgroundElement.clientHeight / 2; // Adjust to focus on main content
      }

      const top =
        lineTop - containerHeight / 2 + lineHeight / 2 - offsetAdjustment;

      // Use requestAnimationFrame for smoother iOS performance
      requestAnimationFrame(() => {
        this.isProgrammaticScroll = true;
        this.lyricsContainer?.scrollTo({ top, behavior: 'smooth' });
        // Reset the flag after a short delay to allow the scroll to complete
        setTimeout(() => {
          this.isProgrammaticScroll = false;
        }, 100);
      });
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

      // Check if the target line has background text placed before the main text
      const hasBackgroundBefore = target.querySelector(
        '.background-text.before',
      );

      // Calculate the offset to center the main text content, accounting for background text placement
      let offsetAdjustment = 0;
      if (hasBackgroundBefore) {
        const backgroundElement = hasBackgroundBefore as HTMLElement;
        offsetAdjustment = backgroundElement.clientHeight / 2; // Adjust to focus on main content
      }

      const top =
        lineTop - containerHeight / 2 + lineHeight / 2 - offsetAdjustment;

      // Use requestAnimationFrame for smoother iOS performance
      requestAnimationFrame(() => {
        this.isProgrammaticScroll = true;
        this.lyricsContainer?.scrollTo({ top, behavior: 'smooth' });
        // Reset the flag after a short delay to allow the scroll to complete
        setTimeout(() => {
          this.isProgrammaticScroll = false;
        }, 100);
      });
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

    // Set both old internal CSS variables (for backward compatibility)
    // and new public CSS variables (which take precedence)
    this.style.setProperty(
      '--hover-background-color',
      this.hoverBackgroundColor,
    );
    this.style.setProperty('--highlight-color', this.highlightColor);

    const sourceLabel = this.lyricsSource ?? 'Unavailable';

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

        const backgroundPlacement = AmLyrics.getBackgroundTextPlacement(line);
        const shouldShowBackground =
          line.backgroundText &&
          line.backgroundText.length > 0 &&
          (isLineActive || bgIsPlayingNow);

        // Create background text element
        const backgroundTextElement = shouldShowBackground
          ? html`<span class="background-text ${backgroundPlacement}">
              ${line.backgroundText!.map((syllable, wordIndex) => {
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
                  100}%; margin-right: ${this.shouldNormalizeSpacing &&
                  AmLyrics.shouldApplySyllableMargin(syllable)
                    ? '.5ch'
                    : '0'}; --transition-style: ${isLineActive
                    ? 'all'
                    : 'color'}"
                  >${syllable.text}</span
                >`;
              })}
            </span>`
          : '';

        // Create main text element
        const mainTextElement = html`<span>
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
              style="--line-progress: ${progress * 100}%; margin-right: ${this
                .shouldNormalizeSpacing &&
              AmLyrics.shouldApplySyllableMargin(syllable)
                ? '.5ch'
                : '0'}; --transition-style: ${isLineActive ? 'all' : 'color'}"
              >${syllable.text}</span
            >`;
          })}
        </span>`;

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
            ${backgroundPlacement === 'before' ? backgroundTextElement : ''}
            ${mainTextElement}
            ${backgroundPlacement === 'after' ? backgroundTextElement : ''}
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
              ${!this.hideSourceFooter
                ? html`<p>Source: ${sourceLabel}</p>`
                : ''}
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
