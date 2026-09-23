import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(ROOT, 'assets', 'sounds');
const SAMPLE_RATE = 44100;

function seededNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

function envelope(time, duration, attack = 0.008, release = 0.08) {
  const attackGain = Math.min(1, time / attack);
  const releaseGain = Math.min(1, Math.max(0, duration - time) / release);
  return Math.max(0, Math.min(attackGain, releaseGain));
}

function addTone(buffer, start, duration, fromHz, toHz, amplitude, waveform = 'sine') {
  const startSample = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.floor(duration * SAMPLE_RATE);
  let phase = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / Math.max(1, sampleCount - 1);
    const frequency = fromHz + (toHz - fromHz) * progress;
    phase += (2 * Math.PI * frequency) / SAMPLE_RATE;
    const wave = waveform === 'square' ? Math.sign(Math.sin(phase)) : Math.sin(phase);
    const time = index / SAMPLE_RATE;
    buffer[startSample + index] += wave * amplitude * envelope(time, duration);
  }
}

function addNoise(buffer, start, duration, amplitude, seed) {
  const random = seededNoise(seed);
  const startSample = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.floor(duration * SAMPLE_RATE);
  let filtered = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    filtered = filtered * 0.72 + random() * 0.28;
    const time = index / SAMPLE_RATE;
    buffer[startSample + index] += filtered * amplitude * envelope(time, duration, 0.002, 0.025);
  }
}

function encodeWave(samples) {
  const pcmBytes = samples.length * 2;
  const output = Buffer.alloc(44 + pcmBytes);
  output.write('RIFF', 0);
  output.writeUInt32LE(36 + pcmBytes, 4);
  output.write('WAVE', 8);
  output.write('fmt ', 12);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36);
  output.writeUInt32LE(pcmBytes, 40);
  samples.forEach((sample, index) => {
    const limited = Math.max(-1, Math.min(1, sample));
    output.writeInt16LE(Math.round(limited * 32767), 44 + index * 2);
  });
  return output;
}

function createSound(filename, duration, compose) {
  const samples = new Float64Array(Math.ceil(duration * SAMPLE_RATE));
  compose(samples);
  writeFileSync(join(OUTPUT_DIR, filename), encodeWave(samples));
}

mkdirSync(OUTPUT_DIR, { recursive: true });

createSound('mission-complete.wav', 0.72, (samples) => {
  addNoise(samples, 0.01, 0.035, 0.13, 101);
  addTone(samples, 0.06, 0.16, 520, 600, 0.24);
  addTone(samples, 0.24, 0.16, 660, 740, 0.25);
  addTone(samples, 0.42, 0.23, 820, 980, 0.27);
  addTone(samples, 0.44, 0.20, 410, 490, 0.08);
});

createSound('approval-required.wav', 0.78, (samples) => {
  addNoise(samples, 0.01, 0.025, 0.11, 202);
  addTone(samples, 0.05, 0.19, 720, 720, 0.23, 'square');
  addTone(samples, 0.33, 0.27, 720, 620, 0.24, 'square');
  addTone(samples, 0.36, 0.22, 360, 310, 0.07);
});

createSound('tool-failed.wav', 0.72, (samples) => {
  addNoise(samples, 0.01, 0.045, 0.17, 303);
  addTone(samples, 0.06, 0.25, 310, 210, 0.27, 'square');
  addTone(samples, 0.34, 0.26, 250, 145, 0.25, 'square');
  addNoise(samples, 0.59, 0.06, 0.09, 304);
});

createSound('interrupted.wav', 0.52, (samples) => {
  addNoise(samples, 0.01, 0.03, 0.13, 404);
  addTone(samples, 0.05, 0.16, 230, 175, 0.25);
  addTone(samples, 0.25, 0.18, 190, 135, 0.24);
});

console.log(`Generated 4 original WAV files in ${OUTPUT_DIR}`);
