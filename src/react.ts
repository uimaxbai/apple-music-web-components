import React from 'react';
import { createComponent } from '@lit/react';
import { AmLyrics as AmLyricsWC } from './AmLyrics.js';

// This creates the React-usable component
export const AmLyrics = createComponent({
  tagName: 'am-lyrics',
  elementClass: AmLyricsWC,
  react: React,
  // Map custom events to React-style on<Event> props
  events: {
    onLineClick: 'line-click',
  },
});
