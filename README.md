# \<am-lyrics>

This webcomponent follows the [open-wc](https://github.com/open-wc/open-wc) recommendation.

## Installation

```bash
npm install am-lyrics
```

Or, just use the CDN.

## Usage

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/am-lyrics@latest/dist/src/am-lyrics.min.js';
</script>

<am-lyrics
  query="Uptown Funk"
  music-id=""
  isrc=""
  duration=""
  highlight-color="#f00"
  hide-source-footer="false"
  font-family="'Inter', Arial, sans-serif"
  autoscroll
></am-lyrics>
<!--
<am-lyrics
  query="Uptown Funk"               // Search Apple Music for a song
  music-id=""                       // Use this if you have a specific song ID from Apple Music (almost never)
  isrc=""                           // To be used WITH a query, just to double check if it is correct
  duration=""                       // Duration of your timer (the component takes it in and syncs to the words. See JS below)
  highlight-color="#000"            // Color of the highlighted words
  hide-source-footer="false"        // Controls whether the footer at the bottom is a larger one or a more compact GitHub link.
  font-family="'Inter', sans-serif" // BYOF
  autoscroll                        // Self-explanatory
  @line-click=${handleLineClick}    // Event listener for line clicks to skip to that part of the song.
></am-lyrics>
-->
```

The timer needs to be defined by yourself. For example:

### Just play the lyrics!

```html
<script>
  let animationFrameId;
  let songStartTime = 0;
  let systemStartTime = 0;

  function stopAnimation() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function animate() {
    const amLyrics = document.querySelector('am-lyrics');
    if (!amLyrics) return;

    const elapsedTime = Date.now() - systemStartTime;
    amLyrics.currentTime = songStartTime + elapsedTime;

    animationFrameId = requestAnimationFrame(animate);
  }

  function startPlayback() {
    stopAnimation();
    songStartTime = 0;
    systemStartTime = Date.now(); // Use dates instead of setInterval() for more accuracy
    animate();
  }

  function handleLineClick(e) {
    stopAnimation();
    songStartTime = e.detail.timestamp;
    systemStartTime = Date.now();
    animate();
  }

  function handleSearch() {
    const searchInput = document.querySelector('#search-input');
    const amLyrics = document.querySelector('am-lyrics');
    if (searchInput && amLyrics) {
      amLyrics.query = searchInput.value;
      amLyrics.isrc = '';
      amLyrics.musicId = '';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const amLyrics = document.querySelector('am-lyrics');
    const searchButton = document.querySelector('#search-button');
    const startButton = document.querySelector('#start-button');

    if (amLyrics) {
      amLyrics.addEventListener('line-click', handleLineClick);
    }

    if (searchButton) {
      searchButton.addEventListener('click', handleSearch);
    }

    if (startButton) {
      startButton.addEventListener('click', startPlayback);
    }
  });
</script>
```

### With an `<audio>` element

You can synchronize the lyrics with an HTML `<audio>` element.

```html
<audio id="audio-player" src="path/to/your/song.mp3" controls></audio>
<am-lyrics query="Uptown Funk"></am-lyrics>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    const amLyrics = document.querySelector('am-lyrics');
    const audioPlayer = document.querySelector('#audio-player');

    if (amLyrics && audioPlayer) {
      // Update lyrics time when audio time updates
      audioPlayer.addEventListener('timeupdate', () => {
        // The component expects time in milliseconds
        amLyrics.currentTime = audioPlayer.currentTime * 1000;
      });

      // Seek audio when a lyric line is clicked
      amLyrics.addEventListener('line-click', (e) => {
        // The event detail contains the timestamp in milliseconds
        audioPlayer.currentTime = e.detail.timestamp / 1000;
        audioPlayer.play();
      });
    }
  });
</script>
```

See `demo/index.html` for a functional demo.

## Development

### Dependencies

For some reason, npm breaks when trying to install (or just takes too long for me :(). For a faster installation, use `yarn` or `bun` which are both compatible with `node` and `package.json`.

```bash
yarn install
bun i
```

### Local developer demo with `web-dev-server`

```bash
npm start
```

### Linting and formatting

To scan the project for linting and formatting errors, run

```bash
npm run lint
```

To automatically fix linting and formatting errors, run

```bash
npm run format
```
