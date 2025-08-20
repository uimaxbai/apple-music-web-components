# \<am-lyrics>

This webcomponent follows the [open-wc](https://github.com/open-wc/open-wc) recommendation.

## Installation

```bash
npm install @uimaxbai/am-lyrics # For react users and those crazy enough to not use the CDN
```

Or, just use the CDN.

## Usage

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@uimaxbai/am-lyrics@latest/dist/src/am-lyrics.min.js';
</script>

<am-lyrics
  query="Uptown Funk"
  music-id=""
  isrc=""
  current-time="0"
  duration=""
  highlight-color="#f00"
  hover-background-color="#e0e0e0"
  hide-source-footer="false"
  font-family="'Inter', Arial, sans-serif"
  autoscroll
  interpolate
></am-lyrics>
```

## Properties & Attributes

| Property/Attribute | Type | Default | Description |
|-------------------|------|---------|-------------|
| `query` | `string` | `undefined` | Search query for Apple Music song |
| `music-id` | `string` | `undefined` | Specific Apple Music song ID (rarely used) |
| `isrc` | `string` | `undefined` | ISRC code to verify correct song match |
| `current-time` | `number` | `0` | Current playback time in milliseconds |
| `duration` | `number` | `undefined` | Song duration in milliseconds. **Set to `-1` to reset/stop playback** |
| `highlight-color` | `string` | `"#000"` | Color for highlighted/active lyrics |
| `hover-background-color` | `string` | `"#f0f0f0"` | Background color on line hover |
| `hide-source-footer` | `boolean` | `false` | Hide/show the source attribution footer |
| `font-family` | `string` | `undefined` | Custom font family for lyrics |
| `autoscroll` | `boolean` | `true` | Enable automatic scrolling to active lyrics |
| `interpolate` | `boolean` | `true` | Enable smooth word-by-word highlighting animation |

## CSS Custom Properties (CSS Variables)

You can customize the appearance using CSS custom properties:

```css
am-lyrics {
  /* Highlight color for active lyrics */
  --am-lyrics-highlight-color: #007aff;
  
  /* Hover background color (fallback) */
  --hover-background-color: #f5f5f5;
  
  /* Alternative highlight color (fallback) */
  --highlight-color: #000;
}
```

**Note**: The CSS variables take precedent over the set properties above.



## Events

### `line-click`

Fired when a user clicks on a lyrics line.

```javascript
amLyrics.addEventListener('line-click', (event) => {
  console.log('Seek to:', event.detail.timestamp); // timestamp in milliseconds
});
```

### For React Users

First, ensure you have `react` and `@lit/react` installed in your project.

```bash
npm install react @lit/react # Very important or errors will arise
```

Then, you can import the `AmLyrics` component from `am-lyrics/react` and use it in your components.

```jsx
'use client'; // VERY IMPORTANT!!!

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AmLyrics } from '@uimaxbai/am-lyrics/react';

export default function App() {
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sync audio player time with the component
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let animationFrameId: number;

    const updateCurrentTime = () => {
      setCurrentTime(audio.currentTime * 1000);
      animationFrameId = requestAnimationFrame(updateCurrentTime); // Use requestAnimationFrame to prevent choppy scrolling
    };

    const handlePlay = () => {
      animationFrameId = requestAnimationFrame(updateCurrentTime);
    };

    const handlePause = () => {
      cancelAnimationFrame(animationFrameId);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime * 1000); // Convert to milliseconds
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  // Handle line clicks to seek the audio
  const handleLineClick = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<{ timestamp: number }>;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = customEvent.detail.timestamp / 1000; // Convert to seconds
      audio.play();
    }
  }, []);

  return (
    <div>
      <audio ref={audioRef} src="/uptown_funk.flac" controls />
        <AmLyrics
          query="Uptown Funk"
          currentTime={currentTime}
          onLineClick={handleLineClick}
          autoScroll
          highlightColor='#fff'
        />
    </div>
  );
}
```

Using NextJS? See [`next.md`](./next.md).

### SSR

Lit web components only partially support SSR, so this package is very volatile in SSR. Either:

- Use the CDN solution and place it direct into your HTML or
- Disable SSR on the page with lyrics.

Using NextJS? See [`next.md`](./next.md).

The timer needs to be defined by yourself. For example:

### Just play the lyrics

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

See [`demo/index.html`](./demo/index.html) for a functional demo.

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
