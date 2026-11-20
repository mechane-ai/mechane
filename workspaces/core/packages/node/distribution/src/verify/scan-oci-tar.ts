import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE } from '@mechane/records';
import { Effect, Option } from 'effect';
import { createHash } from 'node:crypto';
import type { Hash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';

const TAR_BLOCK_BYTES = 512;
const STREAM_CHUNK_BYTES = 256 * BYTES_PER_KIBIBYTE;
const TEXT_MAX_BYTES = 4 * BYTES_PER_MEBIBYTE;
const EXTENDED_HEADER_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;
const NAME_START = 0;
const NAME_END = 100;
const SIZE_START = 124;
const SIZE_END = 136;
const CHECKSUM_START = 148;
const CHECKSUM_END = 156;
const TYPEFLAG_OFFSET = 156;
const PREFIX_START = 345;
const PREFIX_END = 500;
const ASCII_SPACE = 0x20;
const BASE256_HIGH_BYTE = 128;
const BYTE_RADIX = 256;
const OCTAL_RADIX = 8;
const END_ZERO_BLOCKS = 2;
const PAX_TYPEFLAGS: ReadonlySet<string> = new Set(['x', 'g']);

export type ScannedTarEntry = { readonly sha256: string; readonly bytes: number; readonly text: string | null };

type ScanTarInput = { readonly path: string };

type PaxOverrides = { readonly path?: string | undefined; readonly bytes?: number | undefined };

type FileAccumulator = {
  readonly kind: 'file';
  readonly name: string;
  readonly totalBytes: number;
  readonly remainingBytes: number;
  readonly paddingBytes: number;
  readonly hash: Hash;
  readonly chunks: ReadonlyArray<Buffer> | null;
};

type MetaAccumulator = {
  readonly kind: 'pax' | 'gnu-longname';
  readonly remainingBytes: number;
  readonly paddingBytes: number;
  readonly chunks: ReadonlyArray<Buffer>;
};

type SkipAccumulator = { readonly kind: 'skip'; readonly remainingBytes: number; readonly paddingBytes: number };

type ActiveEntry = FileAccumulator | MetaAccumulator | SkipAccumulator;

/** Streams an uncompressed POSIX/PAX tar archive once, hashing every regular file and retaining small JSON blobs. */
export const scanOciTar = Effect.fn('scanOciTar')(function* ({
  path,
}: ScanTarInput): Effect.fn.Return<ReadonlyMap<string, ScannedTarEntry>, DistributionFailed> {
  return yield* Effect.tryPromise({
    try: () => readTarEntries(path),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Verify, reason: String(cause) }),
  });
});

function readAsciiField(block: Buffer, start: number, end: number): string {
  const slice = block.subarray(start, end);
  const zero = slice.indexOf(0);

  if (zero === -1) {
    return slice.toString('utf8');
  }

  return slice.subarray(0, zero).toString('utf8');
}

function parseOctal(raw: string): number {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return 0;
  }

  if (!/^[0-7]+$/u.test(trimmed)) {
    throw new Error('guest archive contains a malformed numeric header field');
  }

  const value = Number.parseInt(trimmed, OCTAL_RADIX);

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('guest archive header number exceeds safe range');
  }

  return value;
}

function parseSizeBytes(block: Buffer): number {
  const first = block[SIZE_START];

  if (first !== undefined && first >= BASE256_HIGH_BYTE) {
    let value = first - BASE256_HIGH_BYTE;

    for (let index = SIZE_START + 1; index < SIZE_END; index += 1) {
      const byte = block[index] ?? 0;
      value = value * BYTE_RADIX + byte;
    }

    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('guest archive entry size exceeds safe range');
    }

    return value;
  }

  return parseOctal(readAsciiField(block, SIZE_START, SIZE_END));
}

function isZeroBlock(block: Buffer): boolean {
  for (let index = 0; index < block.byteLength; index += 1) {
    if (block[index] !== 0) {
      return false;
    }
  }

  return true;
}

function verifyHeaderChecksum(block: Buffer): void {
  const recorded = parseOctal(readAsciiField(block, CHECKSUM_START, CHECKSUM_END));
  let unsignedSum = 0;

  for (let index = 0; index < TAR_BLOCK_BYTES; index += 1) {
    if (index >= CHECKSUM_START && index < CHECKSUM_END) {
      unsignedSum += ASCII_SPACE;
    } else {
      unsignedSum += block[index] ?? 0;
    }
  }

  if (unsignedSum !== recorded) {
    throw new Error('guest archive header checksum is invalid');
  }
}

function normalizeTarPath(raw: string): string {
  const stripped = raw.replace(/^(?:\.\/)+/u, '');

  if (stripped.length === 0) {
    throw new Error('guest archive contains an empty entry path');
  }

  return stripped;
}

function parsePaxRecords(content: Buffer, current: PaxOverrides): PaxOverrides {
  let offset = 0;
  let nextPath = current.path;
  let nextBytes = current.bytes;

  while (offset < content.byteLength) {
    const space = content.indexOf(ASCII_SPACE, offset);

    if (space === -1) {
      throw new Error('guest archive PAX extended header is malformed');
    }

    const lengthText = content.subarray(offset, space).toString('ascii');
    const length = Math.trunc(Number(lengthText));

    if (!Number.isSafeInteger(length) || length <= space - offset || offset + length > content.byteLength) {
      throw new Error('guest archive PAX extended header length is invalid');
    }

    const record = content.subarray(space + 1, offset + length - 1).toString('utf8');
    const equals = record.indexOf('=');

    if (equals !== -1) {
      const key = record.slice(0, equals);
      const value = record.slice(equals + 1);

      if (key === 'path') {
        nextPath = value;
      } else if (key === 'size') {
        const parsed = Math.trunc(Number(value));

        if (!Number.isSafeInteger(parsed) || parsed < 0) {
          throw new Error('guest archive PAX size field is invalid');
        }

        nextBytes = parsed;
      }
    }

    offset += length;
  }

  return { path: nextPath, bytes: nextBytes };
}

function paddingBytesFor(totalBytes: number): number {
  const remainder = totalBytes % TAR_BLOCK_BYTES;

  if (remainder === 0) {
    return 0;
  }

  return TAR_BLOCK_BYTES - remainder;
}

function headerTypeflag(block: Buffer): string {
  const byte = block[TYPEFLAG_OFFSET] ?? 0;

  if (byte === 0) {
    return '0';
  }

  return String.fromCodePoint(byte);
}

function rawHeaderPath(block: Buffer): string {
  const name = readAsciiField(block, NAME_START, NAME_END);
  const prefix = readAsciiField(block, PREFIX_START, PREFIX_END);

  if (prefix.length > 0) {
    return `${prefix}/${name}`;
  }

  return name;
}

function appendActiveSlice(active: ActiveEntry, slice: Buffer, remainingBytes: number): ActiveEntry {
  switch (active.kind) {
    case 'skip':
      return { ...active, remainingBytes };
    case 'pax':
    case 'gnu-longname':
      return { ...active, remainingBytes, chunks: [...active.chunks, Buffer.from(slice)] };
    case 'file':
      active.hash.update(slice);

      if (active.chunks === null) {
        return { ...active, remainingBytes };
      }

      return { ...active, remainingBytes, chunks: [...active.chunks, Buffer.from(slice)] };
  }
}

function createOciTarScanner() {
  const entries = new Map<string, ScannedTarEntry>();
  let header: Buffer = Buffer.alloc(0);
  let active: Option.Option<ActiveEntry> = Option.none();
  let skipPaddingBytes = 0;
  let zeroBlocks = 0;
  let paxNext: PaxOverrides = {};
  let gnuLongName: Option.Option<string> = Option.none();

  function finalize(entry: ActiveEntry): void {
    skipPaddingBytes = entry.paddingBytes;
    active = Option.none();

    switch (entry.kind) {
      case 'skip':
        return;
      case 'pax':
        paxNext = parsePaxRecords(Buffer.concat(entry.chunks), paxNext);

        return;
      case 'gnu-longname': {
        const joined = Buffer.concat(entry.chunks);
        const zero = joined.indexOf(0);
        const view = sliceBeforeZero(joined, zero);
        gnuLongName = Option.some(view.toString('utf8'));

        return;
      }
      case 'file': {
        const text = decodeRetainedChunks(entry.chunks);

        entries.set(entry.name, { sha256: entry.hash.digest('hex'), bytes: entry.totalBytes, text });
      }
    }
  }

  function startEntry(entry: ActiveEntry): void {
    if (entry.remainingBytes === 0) {
      finalize(entry);

      return;
    }

    active = Option.some(entry);
  }

  function beginHeader(block: Buffer): void {
    if (isZeroBlock(block)) {
      zeroBlocks += 1;

      return;
    }

    if (zeroBlocks >= END_ZERO_BLOCKS) {
      throw new Error('guest archive has unexpected data after end-of-archive marker');
    }

    zeroBlocks = 0;

    verifyHeaderChecksum(block);

    const headerBytes = parseSizeBytes(block);
    const typeflag = headerTypeflag(block);

    if (PAX_TYPEFLAGS.has(typeflag)) {
      if (headerBytes > EXTENDED_HEADER_MAX_BYTES) {
        throw new Error('guest archive PAX extended header exceeds limit');
      }

      startEntry({ kind: 'pax', remainingBytes: headerBytes, paddingBytes: paddingBytesFor(headerBytes), chunks: [] });

      return;
    }

    if (typeflag === 'L') {
      if (headerBytes > EXTENDED_HEADER_MAX_BYTES) {
        throw new Error('guest archive GNU longname exceeds limit');
      }

      startEntry({
        kind: 'gnu-longname',
        remainingBytes: headerBytes,
        paddingBytes: paddingBytesFor(headerBytes),
        chunks: [],
      });

      return;
    }

    const totalBytes = paxNext.bytes ?? headerBytes;
    const rawPath = paxNext.path ?? Option.getOrUndefined(gnuLongName) ?? rawHeaderPath(block);
    paxNext = {};
    gnuLongName = Option.none();

    if (typeflag === '0') {
      const normalized = normalizeTarPath(rawPath);

      if (entries.has(normalized)) {
        throw new Error(`guest archive contains duplicate entry ${normalized}`);
      }

      const chunks = createChunkBuffer(totalBytes);

      startEntry({
        kind: 'file',
        name: normalized,
        totalBytes,
        remainingBytes: totalBytes,
        paddingBytes: paddingBytesFor(totalBytes),
        hash: createHash('sha256'),
        chunks,
      });

      return;
    }

    if (totalBytes > 0) {
      active = Option.some({ kind: 'skip', remainingBytes: totalBytes, paddingBytes: paddingBytesFor(totalBytes) });
    }
  }

  function consumeActive(current: ActiveEntry, chunk: Buffer, offset: number): number {
    const take = Math.min(current.remainingBytes, chunk.byteLength - offset);
    const slice = chunk.subarray(offset, offset + take);
    const remainingBytes = current.remainingBytes - take;
    const updated = appendActiveSlice(current, slice, remainingBytes);

    if (remainingBytes === 0) {
      finalize(updated);
    } else {
      active = Option.some(updated);
    }

    return offset + take;
  }

  function consumeHeader(chunk: Buffer, offset: number): number {
    const needed = TAR_BLOCK_BYTES - header.byteLength;
    const take = Math.min(needed, chunk.byteLength - offset);
    const slice = chunk.subarray(offset, offset + take);

    if (header.byteLength === 0 && take === TAR_BLOCK_BYTES) {
      beginHeader(slice);

      return offset + take;
    }

    header = Buffer.concat([header, slice]);

    if (header.byteLength === TAR_BLOCK_BYTES) {
      const block = header;
      header = Buffer.alloc(0);

      beginHeader(block);
    }

    return offset + take;
  }

  function advance(chunk: Buffer, offset: number): number {
    if (skipPaddingBytes > 0) {
      const take = Math.min(skipPaddingBytes, chunk.byteLength - offset);
      skipPaddingBytes -= take;

      return offset + take;
    }

    if (Option.isSome(active)) {
      return consumeActive(active.value, chunk, offset);
    }

    return consumeHeader(chunk, offset);
  }

  function consume(chunk: Buffer): void {
    let offset = 0;

    while (offset < chunk.byteLength) {
      offset = advance(chunk, offset);
    }
  }

  function finish(): ReadonlyMap<string, ScannedTarEntry> {
    if (Option.isSome(active) || skipPaddingBytes > 0 || header.byteLength > 0) {
      throw new Error('guest archive ended unexpectedly');
    }

    return entries;
  }

  return { consume, finish };
}

function sliceBeforeZero(joined: Buffer, zero: number): Buffer {
  if (zero === -1) {
    return joined;
  }

  return joined.subarray(0, zero);
}

function decodeRetainedChunks(chunks: ReadonlyArray<Buffer> | null): string | null {
  if (chunks === null) {
    return null;
  }

  return Buffer.concat(chunks).toString('utf8');
}

function createChunkBuffer(totalBytes: number): ReadonlyArray<Buffer> | null {
  if (totalBytes <= TEXT_MAX_BYTES) {
    return [];
  }

  return null;
}

async function readTarEntries(path: string): Promise<ReadonlyMap<string, ScannedTarEntry>> {
  const scanner = createOciTarScanner();
  const stream = createReadStream(path, { highWaterMark: STREAM_CHUNK_BYTES });

  for await (const rawChunk of stream) {
    if (Buffer.isBuffer(rawChunk)) {
      scanner.consume(rawChunk);
    } else if (typeof rawChunk === 'string') {
      scanner.consume(Buffer.from(rawChunk));
    }
  }

  return scanner.finish();
}
