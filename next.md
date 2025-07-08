# Usage with NextJS

See the working example [here](https://github.com/uimaxbai/am-lyrics-next-example).

0. Follow instructions in [README.md](./README.md) for using this as a React component.
1. Install [`@lit-labs/nextjs`](https://www.npmjs.com/package/@lit-labs/nextjs):

```bash
npm i @lit-labs/nextjs
```

2. Update `next.config.js`:

```js
// next.config.js
const withLitSSR = require('@lit-labs/nextjs')();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add your own config here
  reactStrictMode: true,
};

module.exports = withLitSSR(nextConfig);
```

or `next.config.ts`:

```ts
import type { NextConfig } from "next";

const withLitSSR = require('@lit-labs/nextjs')();

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true
};

module.exports = withLitSSR(nextConfig);
```

3. **Add 'use client' directive if you haven't already**
4. Dynamically import the web component

```tsx
// Put me at the start of the file: above the React example in README.md.
import dynamic from 'next/dynamic';
import '@uimaxbai/am-lyrics/am-lyrics.js';

const AmLyrics = dynamic(
  () => import('@uimaxbai/am-lyrics/react').then((mod) => mod.AmLyrics),
  { ssr: false }
);
```

5. Profit (follow the README's React guide from here)

You will get an issue that says 'HTMLElement can't be found', but that can be safely ignored.

See the working example [here](https://github.com/uimaxbai/am-lyrics-next-example).
