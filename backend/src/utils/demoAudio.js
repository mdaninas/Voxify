export function generateDemoWav(text, fixedSeconds) {
  const sampleRate = 22050;
  const seconds = fixedSeconds || Math.min(2 + text.length / 80, 8);
  const totalSamples = Math.floor(sampleRate * seconds);
  const dataSize = totalSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const tones = [220, 277, 330, 247, 294];
  const segment = Math.floor(totalSamples / tones.length);

  for (let i = 0; i < totalSamples; i++) {
    const toneIndex = Math.min(Math.floor(i / segment), tones.length - 1);
    const freq = tones[toneIndex];
    const t = i / sampleRate;
    const envelope = Math.min(1, Math.min(i, totalSamples - i) / (sampleRate * 0.05));
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.3 * envelope;
    buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
  }

  return buffer;
}
