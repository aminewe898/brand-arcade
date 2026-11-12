// Renders the generative soundtrack offline to WAV files so its loudness can be
// measured (the same code runs in the browser). Usage: npm run music:render
import { OfflineAudioContext } from 'node-web-audio-api';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createMusic, STEP } from '../src/audio/music.js';

const SR = 44100;
const SECONDS = STEP * 64 * 2; // two passes of the 4-bar loop

function wav(buffer) {
  const ch = buffer.numberOfChannels;
  const n = buffer.length;
  const out = Buffer.alloc(44 + n * ch * 2);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + n * ch * 2, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(ch, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * ch * 2, 28);
  out.writeUInt16LE(ch * 2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(n * ch * 2, 40);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      out.writeInt16LE(Math.round(v * 32767), o);
      o += 2;
    }
  }
  return out;
}

mkdirSync('tools/out', { recursive: true });
for (const intensity of [0, 1, 2]) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * SECONDS), SR);
  // same bus gain as src/audio/audio.js (musicBus) so the file is the in-game level
  const bus = ctx.createGain();
  bus.gain.value = 0.6;
  bus.connect(ctx.destination);
  const music = createMusic(ctx, bus);
  music.setIntensity(intensity);
  music.start(0.05);
  music.schedule(SECONDS);
  const rendered = await ctx.startRendering();
  const file = `tools/out/music-intensity-${intensity}.wav`;
  writeFileSync(file, wav(rendered));
  console.log('wrote', file, `${SECONDS.toFixed(1)} s`);
}
