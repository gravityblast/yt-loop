# YT Loop

A Brave/Chrome extension for looping a section of a YouTube video from the sidebar. Built for practicing guitar along with songs: pick the tricky part, slow it down, and repeat until it sticks.

## Features

- **A–B loop**: set start and end as text (`65`, `1:05`, `1:05.5`, `1:02:03`)
- **Now** buttons grab the current playback time
- Fine-tune points with ±0.1s / ±1s buttons, or ↑/↓ in a field (Shift = 1s)
- **Playback speed** from 0.1× to 4×, in 0.05 steps, including values YouTube's menu doesn't offer (e.g. 0.85×)
- Loop points are remembered per video
- Lives in the side panel, so it stays open while you play

## Install

1. Clone this repo
2. Open `brave://extensions` (or `chrome://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the repo folder
5. Click the extension icon to open the side panel

After pulling changes, hit the reload arrow on the extension card and reload the YouTube tab.

## Practice workflow

1. Find the passage, hit **Now** for start and end while it plays
2. Nudge the points so the loop lands on the beat
3. Drop the speed to 0.75× or lower and play along
4. Bump the speed up in 0.05 steps as it gets comfortable, until you're at 1×

## Notes

- Works on regular watch pages (`youtube.com/watch?v=…`), not Shorts
- Controls whichever YouTube tab is active
- The loop stops automatically when you navigate to another video
