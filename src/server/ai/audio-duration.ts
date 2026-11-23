import 'server-only';

export function getAudioDurationMs(buffer: Buffer, mimeType: string): number | null {
  if (
    mimeType !== 'audio/wav' ||
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE' ||
    buffer.readUInt32LE(4) + 8 !== buffer.length
  ) {
    return null;
  }

  let offset = 12;
  let audioBytes = 0;
  let validFormat = false;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) return null;

    if (chunkId === 'fmt ') {
      if (size < 16) return null;
      validFormat =
        buffer.readUInt16LE(dataStart) === 1 &&
        buffer.readUInt16LE(dataStart + 2) === 1 &&
        buffer.readUInt32LE(dataStart + 4) === 16_000 &&
        buffer.readUInt32LE(dataStart + 8) === 32_000 &&
        buffer.readUInt16LE(dataStart + 12) === 2 &&
        buffer.readUInt16LE(dataStart + 14) === 16;
    } else if (chunkId === 'data') {
      audioBytes += size;
    }

    offset = dataEnd + (size % 2);
  }

  if (!validFormat || audioBytes === 0 || audioBytes % 2 !== 0) return null;
  return (audioBytes / 32_000) * 1000;
}
