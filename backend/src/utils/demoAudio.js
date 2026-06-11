import lamejs from "@breezystack/lamejs";

function buildDemoPcm(text, fixedSeconds) {
  const sampleRate = 22050;
  const seconds = fixedSeconds || Math.min(2 + text.length / 80, 8);
  const totalSamples = Math.floor(sampleRate * seconds);
  const samples = new Int16Array(totalSamples);
  const tones = [220, 277, 330, 247, 294];
  const segment = Math.max(1, Math.floor(totalSamples / tones.length));

  for (let i = 0; i < totalSamples; i++) {
    const toneIndex = Math.min(Math.floor(i / segment), tones.length - 1);
    const freq = tones[toneIndex];
    const t = i / sampleRate;
    const envelope = Math.min(1, Math.min(i, totalSamples - i) / (sampleRate * 0.05));
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.3 * envelope;
    samples[i] = Math.floor(sample * 32767);
  }

  return { sampleRate, samples };
}

export function generateDemoWav(text, fixedSeconds) {
  const { sampleRate, samples } = buildDemoPcm(text, fixedSeconds);
  const totalSamples = samples.length;
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

  for (let i = 0; i < totalSamples; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  return buffer;
}

export function generateDemoMp3(text, fixedSeconds) {
  const { sampleRate, samples } = buildDemoPcm(text, fixedSeconds);
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 64);
  const chunks = [];
  const frameSize = 1152;

  for (let i = 0; i < samples.length; i += frameSize) {
    const mp3Buffer = encoder.encodeBuffer(samples.subarray(i, i + frameSize));
    if (mp3Buffer.length > 0) {
      chunks.push(Buffer.from(mp3Buffer));
    }
  }

  const end = encoder.flush();
  if (end.length > 0) {
    chunks.push(Buffer.from(end));
  }

  return Buffer.concat(chunks);
}
