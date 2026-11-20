import type {
  AlignmentConfidence,
  ChatAlignmentSettings,
  ChatEvent,
  ChatLogParseResult,
  ChatSourceFormat,
} from './types';

export const MAX_CHAT_RAW_BYTES = 25 * 1024 * 1024; // 25 MB hard cap
export const MAX_CHAT_EVENTS = 150_000;
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const MAX_USERNAME_LENGTH = 80;

export const REACTION_KEYWORDS: readonly string[] = [
  'LMAO',
  'LMFAO',
  'LOL',
  'WTF',
  'OMG',
  'NO WAY',
  'BRO',
  'CLIP IT',
  'CLIP THAT',
  'INSANE',
  'CLUTCH',
  'POG',
  'POGGERS',
  'KEKW',
  'OMEGALUL',
  'AYO',
  'CRAZY',
  'WHAT',
  'HUH',
  'LETS GO',
  'SHEESH',
  'RIP',
  'OOO',
  'GG',
  'GOAT',
  'W',
  'HYPE',
];

const SINGLE_LETTER_ALLOW = new Set(['W', 'L']);
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

export function normalizeChatText(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractReactionSignals(message: string): {
  matchedKeywords: string[];
  hasEmoji: boolean;
  isAllCapsBurst: boolean;
  isExclamationBurst: boolean;
} {
  const cleaned = normalizeChatText(message);
  const upper = cleaned.toUpperCase();
  const hasEmoji = EMOJI_REGEX.test(cleaned);
  const matched: string[] = [];

  for (const kw of REACTION_KEYWORDS) {
    if (kw.includes(' ')) {
      if (upper.includes(kw)) matched.push(kw);
      continue;
    }
    if (SINGLE_LETTER_ALLOW.has(kw)) {
      const tokenRe = new RegExp(`(?:^|\\s)${kw}+(?:$|\\s|[!?.])`, 'i');
      if (tokenRe.test(upper)) matched.push(kw);
      continue;
    }
    // Match exact word or elongated reaction like LMAOOOO / NOOO / WHAAT
    const regex = new RegExp(`(?:^|[^A-Z0-9])${kw}+[A-Z]*(?:$|[^A-Z0-9])`);
    if (regex.test(upper)) {
      matched.push(kw);
    }
  }

  const lettersOnly = cleaned.replace(/[^a-zA-Z]/g, '');
  const upperLetters = cleaned.replace(/[^A-Z]/g, '');
  const isAllCapsBurst =
    lettersOnly.length >= 4 && upperLetters.length / lettersOnly.length >= 0.75;
  const isExclamationBurst = /!{2,}|\?{2,}/.test(cleaned);

  return {
    matchedKeywords: matched,
    hasEmoji,
    isAllCapsBurst,
    isExclamationBurst,
  };
}

/**
 * Parses flexible timestamps:
 * - Numeric seconds (e.g. 124.5 or -12)
 * - Epoch milliseconds (> 1e12) or epoch seconds (> 1e9)
 * - "123.4s"
 * - "MM:SS(.mmm)" or "HH:MM:SS(.mmm)" (supports optional leading negative sign)
 * - ISO-8601 date-time string
 */
export function parseChatTimestamp(value: unknown): {
  kind: 'relative' | 'epoch' | 'invalid';
  seconds: number;
  rawText: string;
} {
  if (value === null || value === undefined) {
    return { kind: 'invalid', seconds: NaN, rawText: '' };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { kind: 'invalid', seconds: NaN, rawText: String(value) };
    }
    if (value > 1e12) {
      return { kind: 'epoch', seconds: value / 1000, rawText: String(value) };
    }
    if (value > 1e8) {
      return { kind: 'epoch', seconds: value, rawText: String(value) };
    }
    return { kind: 'relative', seconds: value, rawText: String(value) };
  }

  const rawText = String(value).trim().replace(/^\[|\]$/g, '');
  if (!rawText) {
    return { kind: 'invalid', seconds: NaN, rawText: '' };
  }

  // Plain numeric string or trailing 's'
  const numericMatch = /^([+-]?\d+(?:\.\d+)?)s?$/i.exec(rawText);
  if (numericMatch) {
    const num = Number(numericMatch[1]);
    if (!Number.isFinite(num)) return { kind: 'invalid', seconds: NaN, rawText };
    if (num > 1e12) return { kind: 'epoch', seconds: num / 1000, rawText };
    if (num > 1e8) return { kind: 'epoch', seconds: num, rawText };
    return { kind: 'relative', seconds: num, rawText };
  }

  // HMS or MS format: optional '-', H:M:S(.ms) or M:S(.ms)
  const hmsMatch = /^(-)?(\d{1,3}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/.exec(rawText);
  if (hmsMatch) {
    const sign = hmsMatch[1] ? -1 : 1;
    const partA = Number(hmsMatch[2]);
    const partB = Number(hmsMatch[3]);
    const partC = hmsMatch[4] !== undefined ? Number(hmsMatch[4]) : null;

    if (partC !== null) {
      if (partB >= 60 || partC >= 60) {
        return { kind: 'invalid', seconds: NaN, rawText };
      }
      return {
        kind: 'relative',
        seconds: sign * (partA * 3600 + partB * 60 + partC),
        rawText,
      };
    }

    if (partB >= 60) {
      return { kind: 'invalid', seconds: NaN, rawText };
    }
    return {
      kind: 'relative',
      seconds: sign * (partA * 60 + partB),
      rawText,
    };
  }

  // ISO-8601 timestamp
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(rawText)) {
    const ms = Date.parse(rawText);
    if (Number.isFinite(ms)) {
      return { kind: 'epoch', seconds: ms / 1000, rawText };
    }
  }

  return { kind: 'invalid', seconds: NaN, rawText };
}

function pickField(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in obj && obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    lowerMap.set(k.toLowerCase(), v);
  }
  for (const key of keys) {
    if (lowerMap.has(key.toLowerCase())) {
      return lowerMap.get(key.toLowerCase());
    }
  }
  return undefined;
}

function extractRawRecordFields(rec: Record<string, unknown>): {
  tsVal: unknown;
  userVal: unknown;
  msgVal: unknown;
} {
  const tsVal = pickField(rec, [
    'timestampSec',
    'content_offset_seconds',
    'offset_seconds',
    'timestamp',
    'time',
    'ts',
    'offset',
    'seconds',
    'created_at',
  ]);
  let userVal = pickField(rec, [
    'username',
    'user',
    'author',
    'display_name',
    'sender',
    'name',
    'commenter',
  ]);
  if (userVal && typeof userVal === 'object') {
    const nested = userVal as Record<string, unknown>;
    userVal =
      pickField(nested, ['display_name', 'name', 'username', 'id']) ?? 'anonymous';
  }

  let msgVal = pickField(rec, [
    'message',
    'text',
    'body',
    'content',
    'comment',
  ]);
  if (msgVal && typeof msgVal === 'object') {
    const nested = msgVal as Record<string, unknown>;
    msgVal = pickField(nested, ['body', 'text', 'message']) ?? '';
  }

  return { tsVal, userVal, msgVal };
}

function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function detectChatFormat(
  rawText: string,
  filename?: string
): ChatSourceFormat {
  const ext = filename?.split('.').pop()?.toLowerCase();
  if (ext === 'jsonl' || ext === 'ndjson') return 'jsonl';
  if (ext === 'csv') return 'csv';
  if (ext === 'txt' || ext === 'log') return 'txt';
  if (ext === 'json') {
    // Distinguish JSON array/object vs JSON lines even when named .json
    const trimmed = rawText.trimStart();
    if (trimmed.startsWith('{') && trimmed.includes('\n{')) {
      return 'jsonl';
    }
    return 'json';
  }

  const trimmed = rawText.trimStart();
  if (trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('{')) {
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline > 0) {
      const secondLine = trimmed.slice(firstNewline + 1).trimStart();
      if (secondLine.startsWith('{')) return 'jsonl';
    }
    return 'json';
  }
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? '';
  if (firstLine.includes(',') && /time|timestamp|offset|user|message|text/i.test(firstLine)) {
    return 'csv';
  }
  if (/^\S+,\S+,.+/.test(firstLine) && !firstLine.startsWith('[')) {
    return 'csv';
  }
  return 'txt';
}

interface IntermediateParsedEvent {
  parsedTs: ReturnType<typeof parseChatTimestamp>;
  username: string;
  message: string;
}

function parsePlainTextLine(line: string): IntermediateParsedEvent | null {
  // Patterns:
  // [00:12:34] alice: hello
  // 00:12:34.500 - alice: hello
  // 124.5 alice: hello
  // 2026-11-20T12:01:05Z alice: hello
  const bracketed =
    /^\[([^\]]+)\]\s*([^:\-\n]{1,80}?)\s*:\s*(.+)$/.exec(line);
  if (bracketed) {
    const parsedTs = parseChatTimestamp(bracketed[1]);
    if (parsedTs.kind !== 'invalid') {
      return { parsedTs, username: bracketed[2], message: bracketed[3] };
    }
  }

  const delimited =
    /^(\S+)\s*(?:-|\|)?\s*([^:\n]{1,80}?)\s*:\s*(.+)$/.exec(line);
  if (delimited) {
    const parsedTs = parseChatTimestamp(delimited[1]);
    if (parsedTs.kind !== 'invalid') {
      return { parsedTs, username: delimited[2], message: delimited[3] };
    }
  }

  return null;
}

export function parseChatLog(
  rawText: string,
  options?: {
    filename?: string;
    format?: ChatSourceFormat;
    alignment?: Partial<ChatAlignmentSettings>;
  }
): ChatLogParseResult {
  if (typeof rawText !== 'string') {
    throw new Error('Chat log content must be a UTF-8 text string.');
  }
  if (Buffer.byteLength(rawText, 'utf8') > MAX_CHAT_RAW_BYTES) {
    throw new Error('Chat log exceeds the 25 MB safety limit.');
  }

  const format = options?.format ?? detectChatFormat(rawText, options?.filename);
  const warnings: string[] = [];
  const alignmentNotes: string[] = [];
  const rawRecords: IntermediateParsedEvent[] = [];
  let totalLines = 0;
  let skippedLines = 0;

  if (format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('Malformed JSON chat log: unable to parse JSON payload.');
    }

    let items: unknown[] | null = null;
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const candidateArr =
        obj.comments ?? obj.messages ?? obj.chat ?? obj.events ?? obj.data;
      if (Array.isArray(candidateArr)) {
        items = candidateArr;
      }
    }

    if (!items) {
      throw new Error(
        'JSON chat log must be an array of events or an object with comments/messages/events.'
      );
    }

    totalLines = items.length;
    for (const item of items) {
      if (rawRecords.length >= MAX_CHAT_EVENTS) {
        warnings.push(`Truncated chat import after ${MAX_CHAT_EVENTS.toLocaleString()} events for memory safety.`);
        break;
      }
      if (!item || typeof item !== 'object') {
        skippedLines++;
        continue;
      }
      const { tsVal, userVal, msgVal } = extractRawRecordFields(item as Record<string, unknown>);
      const parsedTs = parseChatTimestamp(tsVal);
      const message = normalizeChatText(String(msgVal ?? ''));
      const username = normalizeChatText(String(userVal ?? 'anonymous')) || 'anonymous';
      if (parsedTs.kind === 'invalid' || !message) {
        skippedLines++;
        continue;
      }
      rawRecords.push({ parsedTs, username, message });
    }
  } else if (format === 'jsonl') {
    const lines = rawText.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      totalLines++;
      if (rawRecords.length >= MAX_CHAT_EVENTS) {
        warnings.push(`Truncated JSONL import after ${MAX_CHAT_EVENTS.toLocaleString()} events.`);
        break;
      }
      try {
        const obj = JSON.parse(line);
        if (!obj || typeof obj !== 'object') {
          skippedLines++;
          continue;
        }
        const { tsVal, userVal, msgVal } = extractRawRecordFields(obj as Record<string, unknown>);
        const parsedTs = parseChatTimestamp(tsVal);
        const message = normalizeChatText(String(msgVal ?? ''));
        const username = normalizeChatText(String(userVal ?? 'anonymous')) || 'anonymous';
        if (parsedTs.kind === 'invalid' || !message) {
          skippedLines++;
          continue;
        }
        rawRecords.push({ parsedTs, username, message });
      } catch {
        skippedLines++;
      }
    }
  } else if (format === 'csv') {
    const lines = rawText.split(/\r?\n/);
    let headerCols: string[] | null = null;
    let tsIdx = 0;
    let userIdx = 1;
    let msgIdx = 2;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      totalLines++;
      const cols = splitCsvRow(line);
      if (headerCols === null) {
        const lower = cols.map((c) => c.toLowerCase());
        const looksLikeHeader = lower.some((c) =>
          ['timestamp', 'time', 'offset', 'created_at', 'username', 'user', 'message', 'text'].includes(c)
        );
        if (looksLikeHeader) {
          headerCols = lower;
          tsIdx = Math.max(
            0,
            lower.findIndex((c) =>
              ['timestampsec', 'timestamp', 'time', 'offset', 'seconds', 'created_at'].includes(c)
            )
          );
          userIdx = lower.findIndex((c) =>
            ['username', 'user', 'author', 'sender', 'name'].includes(c)
          );
          msgIdx = lower.findIndex((c) =>
            ['message', 'text', 'body', 'content', 'comment'].includes(c)
          );
          if (msgIdx === -1) msgIdx = cols.length - 1;
          continue;
        }
        headerCols = [];
      }

      if (rawRecords.length >= MAX_CHAT_EVENTS) {
        warnings.push(`Truncated CSV import after ${MAX_CHAT_EVENTS.toLocaleString()} events.`);
        break;
      }

      if (cols.length < 2) {
        skippedLines++;
        continue;
      }

      const parsedTs = parseChatTimestamp(cols[tsIdx]);
      const username =
        userIdx >= 0 && cols[userIdx]
          ? normalizeChatText(cols[userIdx])
          : 'anonymous';
      const message = normalizeChatText(cols[msgIdx] ?? '');
      if (parsedTs.kind === 'invalid' || !message) {
        skippedLines++;
        continue;
      }
      rawRecords.push({ parsedTs, username, message });
    }
  } else {
    // Plain timestamped text lines
    const lines = rawText.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      totalLines++;
      if (rawRecords.length >= MAX_CHAT_EVENTS) {
        warnings.push(`Truncated text chat import after ${MAX_CHAT_EVENTS.toLocaleString()} events.`);
        break;
      }
      const parsed = parsePlainTextLine(line);
      if (!parsed) {
        skippedLines++;
        continue;
      }
      const message = normalizeChatText(parsed.message);
      const username = normalizeChatText(parsed.username) || 'anonymous';
      if (!message) {
        skippedLines++;
        continue;
      }
      rawRecords.push({
        parsedTs: parsed.parsedTs,
        username,
        message,
      });
    }
  }

  // Normalize epoch timestamps if absolute wall-clock timestamps were used
  let inferredClockBaseSec: number | null = null;
  const epochRecords = rawRecords.filter((r) => r.parsedTs.kind === 'epoch');
  if (epochRecords.length > 0) {
    inferredClockBaseSec = Math.min(...epochRecords.map((r) => r.parsedTs.seconds));
    alignmentNotes.push(
      'Wall-clock timestamps detected; normalized relative to earliest chat message. Verify offset alignment if stream recording started earlier or later.'
    );
  }

  const videoStartOffsetSec = Number(options?.alignment?.videoStartOffsetSec ?? 0) || 0;
  const chatStartOffsetSec = Number(options?.alignment?.chatStartOffsetSec ?? 0) || 0;
  const manualSyncOffsetSec = Number(options?.alignment?.manualSyncOffsetSec ?? 0) || 0;
  const videoDurationSec =
    typeof options?.alignment?.videoDurationSec === 'number' &&
    options.alignment.videoDurationSec > 0
      ? options.alignment.videoDurationSec
      : null;

  let negativeMappedCount = 0;
  let postDurationCount = 0;

  const events: ChatEvent[] = [];
  rawRecords.forEach((rec, index) => {
    const rawRelSec =
      rec.parsedTs.kind === 'epoch' && inferredClockBaseSec !== null
        ? rec.parsedTs.seconds - inferredClockBaseSec
        : rec.parsedTs.seconds;

    const mappedSec = rawRelSec + chatStartOffsetSec - videoStartOffsetSec + manualSyncOffsetSec;

    if (mappedSec < 0) {
      negativeMappedCount++;
    }
    if (videoDurationSec !== null && mappedSec > videoDurationSec) {
      postDurationCount++;
    }

    const msgClipped = rec.message.slice(0, MAX_CHAT_MESSAGE_LENGTH);
    const userClipped = rec.username.slice(0, MAX_USERNAME_LENGTH);
    const sig = extractReactionSignals(msgClipped);

    events.push({
      id: `ce-${index + 1}`,
      timestampSec: mappedSec,
      rawTimestampSec: rawRelSec,
      rawTimestamp: rec.parsedTs.rawText,
      username: userClipped,
      normalizedUser: userClipped.toLowerCase(),
      message: msgClipped,
      normalizedMessage: msgClipped.toLowerCase(),
      hasEmoji: sig.hasEmoji,
      matchedKeywords: sig.matchedKeywords,
      isAllCapsBurst: sig.isAllCapsBurst,
      isExclamationBurst: sig.isExclamationBurst,
    });
  });

  // Sort chronologically
  events.sort((a, b) => a.timestampSec - b.timestampSec);

  const outOfBoundsCount = negativeMappedCount + postDurationCount;
  if (negativeMappedCount > 0) {
    alignmentNotes.push(
      `${negativeMappedCount} chat message${negativeMappedCount === 1 ? '' : 's'} occurred before video start (t < 0s) and were ignored for in-video spikes.`
    );
  }
  if (postDurationCount > 0 && videoDurationSec !== null) {
    alignmentNotes.push(
      `${postDurationCount} chat message${postDurationCount === 1 ? '' : 's'} extend past video duration (${videoDurationSec.toFixed(1)}s).`
    );
  }
  if (skippedLines > 0) {
    warnings.push(
      `Skipped ${skippedLines} malformed or empty line${skippedLines === 1 ? '' : 's'} while parsing ${format.toUpperCase()} chat log.`
    );
  }

  let alignmentConfidence: AlignmentConfidence = 'high';
  if (events.length === 0) {
    alignmentConfidence = 'low';
    alignmentNotes.push('No valid timestamped chat messages were parsed from this file.');
  } else {
    const oobRatio = outOfBoundsCount / events.length;
    if (oobRatio > 0.35 || (inferredClockBaseSec !== null && videoStartOffsetSec === 0 && chatStartOffsetSec === 0 && manualSyncOffsetSec === 0)) {
      alignmentConfidence = oobRatio > 0.35 ? 'low' : 'medium';
    }
  }

  const inVideoEvents = events.filter(
    (e) => e.timestampSec >= 0 && (videoDurationSec === null || e.timestampSec <= videoDurationSec)
  );

  return {
    format,
    events: inVideoEvents,
    totalLines,
    validEvents: inVideoEvents.length,
    skippedLines,
    outOfBoundsCount,
    minTimestampSec: inVideoEvents.length > 0 ? inVideoEvents[0].timestampSec : null,
    maxTimestampSec:
      inVideoEvents.length > 0 ? inVideoEvents[inVideoEvents.length - 1].timestampSec : null,
    inferredClockBaseSec,
    alignmentConfidence,
    alignmentNotes,
    warnings,
    sampleEvents: inVideoEvents.slice(0, 8).map((e) => ({
      timestampSec: e.timestampSec,
      rawTimestamp: e.rawTimestamp,
      username: e.username,
      message: e.message,
    })),
  };
}
