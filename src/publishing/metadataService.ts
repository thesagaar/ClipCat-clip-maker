import { assessRightsReadiness, buildAttributionInfo } from './attributionService.ts';
import { detectContentLanguage } from './languageDetector.ts';
import type {
  CaptionPackageSummary,
  MetadataGenerateRequestInput,
  PublishMetadataPackage,
  TitleCandidate,
  YouTubeFormat,
} from './types.ts';

const STOP_WORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'what', 'when', 'where',
  'which', 'while', 'about', 'there', 'their', 'they', 'them', 'then', 'than',
  'your', 'you', 'just', 'like', 'really', 'actually', 'basically', 'today',
  'going', 'into', 'some', 'more', 'very', 'much', 'here', 'because', 'were',
  'been', 'being', 'will', 'would', 'could', 'should', 'make', 'made', 'over',
  'clip', 'video', 'moment', 'highlight', 'watch',
]);

const BANNED_SPAM_TAGS = new Set([
  'fyp', 'foryou', 'foryoupage', 'viral', 'viralvideo', 'trending', 'explore',
  'explorepage', 'sub4sub', 'like4like', 'follow4follow',
]);

const YOUTUBE_CATEGORY_MAP: Array<{ id: string; label: string; keywords: string[] }> = [
  { id: '20', label: 'Gaming', keywords: ['game', 'gaming', 'esports', 'stream', 'boss', 'speedrun', 'fps'] },
  { id: '28', label: 'Science & Technology', keywords: ['ai', 'gpu', 'code', 'software', 'tech', 'benchmark', 'cpu', 'hardware', 'developer', 'api'] },
  { id: '27', label: 'Education', keywords: ['tutorial', 'learn', 'guide', 'explained', 'how', 'course', 'lesson', 'demo'] },
  { id: '17', label: 'Sports', keywords: ['match', 'goal', 'training', 'workout', 'basketball', 'soccer', 'tennis'] },
  { id: '10', label: 'Music', keywords: ['song', 'music', 'track', 'beat', 'guitar', 'vocals', 'mix'] },
];

export function sanitizeTitleText(raw: string, maxLen = 100): string {
  const cleaned = raw
    .replace(/[<>]/g, '')
    .replace(/[\r\n\0\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  const sliced = cleaned.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? sliced.slice(0, lastSpace) : sliced).trimEnd() + '…';
}

export function cleanCaptionLine(line: string): string {
  let out = line.replace(/\s+/g, ' ').trim();
  if (!out) return '';
  out = out.charAt(0).toUpperCase() + out.slice(1);
  out = out.replace(/\s+([,.!?;:])/g, '$1');
  if (!/[.!?…]$/.test(out)) {
    out += '.';
  }
  return out;
}

export function extractPlainTextFromSrt(srt: string): string {
  const lines = srt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^\d+$/.test(l) && !/^\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->\s+/.test(l));
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

export function extractKeywordsFromText(text: string, maxKeywords = 12): string[] {
  const tokens = text
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const counts = new Map<string, { display: string; count: number }>();
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (STOP_WORDS.has(lower) || BANNED_SPAM_TAGS.has(lower) || /^\d+$/.test(lower)) {
      continue;
    }
    const existing = counts.get(lower);
    if (existing) {
      existing.count += 1;
    } else {
      // Preserve intentional acronyms like GPU, AI, FPS, SDK
      const isAcronym = token.length <= 5 && token === token.toUpperCase() && /[A-Z]/.test(token);
      const display = isAcronym ? token : token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
      counts.set(lower, { display, count: 1 });
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1].count - a[1].count || b[0].length - a[0].length)
    .slice(0, maxKeywords)
    .map(([, val]) => val.display);
}

function normalizeTagToken(raw: string): string {
  return raw
    .replace(/^#+/, '')
    .replace(/[<>"'`]/g, '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildHashtagFromKeyword(kw: string): string | null {
  const pascal = kw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 4 && part === part.toUpperCase()) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('')
    .replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '');

  if (!pascal || pascal.length < 2 || BANNED_SPAM_TAGS.has(pascal.toLowerCase())) {
    return null;
  }
  return `#${pascal}`;
}

export function inferYouTubeCategory(text: string): { id: string; label: string } {
  const lower = text.toLowerCase();
  let best = { id: '22', label: 'People & Blogs', hits: 0 };
  for (const cat of YOUTUBE_CATEGORY_MAP) {
    let hits = 0;
    for (const kw of cat.keywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) hits += 1;
    }
    if (hits > best.hits) {
      best = { id: cat.id, label: cat.label, hits };
    }
  }
  return { id: best.id, label: best.label };
}

export function generateTitleCandidates(params: {
  clipTitle: string;
  clipDescription: string;
  transcriptText: string;
  keywords: string[];
  platformFocus?: 'youtube' | 'instagram';
}): TitleCandidate[] {
  const baseTitle = sanitizeTitleText(params.clipTitle.replace(/@\s*\d+:\d+$/, '').trim(), 90);
  const firstSentenceRaw = params.transcriptText
    .split(/(?<=[.!?])\s+/)[0]
    ?.replace(/^Today\s+(?:we're|we are)\s+/i, '')
    ?.trim();

  const subject = params.keywords.slice(0, 2).join(' ') || baseTitle || 'Key Clip';
  const candidates: TitleCandidate[] = [];

  if (firstSentenceRaw && firstSentenceRaw.length >= 12) {
    const leadClause = firstSentenceRaw.replace(/[.!?]+$/, '');
    const questionMatch = /\b(?:testing|compare|benchmark|worth|why|how)\b/i.test(leadClause);
    const formatted = questionMatch
      ? sanitizeTitleText(
          `${leadClause.charAt(0).toUpperCase() + leadClause.slice(1)} — Quick Breakdown`,
          96
        )
      : sanitizeTitleText(`${leadClause.charAt(0).toUpperCase() + leadClause.slice(1)}`, 96);

    candidates.push({
      title: formatted,
      strategy: questionMatch ? 'topic_question' : 'key_takeaway',
      score: formatted.length >= 18 && formatted.length <= 72 ? 92 : 84,
    });
  }

  if (baseTitle && baseTitle.length >= 6 && !/^clip\s*\d*$/i.test(baseTitle)) {
    candidates.push({
      title: sanitizeTitleText(baseTitle, 96),
      strategy: 'direct_statement',
      score: baseTitle.length >= 14 && baseTitle.length <= 72 ? 90 : 80,
    });
  }

  if (params.clipDescription && params.clipDescription.trim().length >= 15) {
    const descLead = params.clipDescription.split(/(?<=[.!?])\s+/)[0] ?? params.clipDescription;
    candidates.push({
      title: sanitizeTitleText(descLead.replace(/[.!?]+$/, ''), 96),
      strategy: 'key_takeaway',
      score: 78,
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      title: sanitizeTitleText(subject, 96),
      strategy: 'direct_statement',
      score: 70,
    });
  }

  // Deduplicate case-insensitively keeping highest score
  const unique = new Map<string, TitleCandidate>();
  for (const cand of candidates.sort((a, b) => b.score - a.score)) {
    const key = cand.title.toLowerCase();
    if (cand.title && !unique.has(key)) {
      unique.set(key, cand);
    }
  }
  return Array.from(unique.values());
}

export function buildYouTubeTags(keywords: string[], title: string, maxTotalChars = 480): string[] {
  const candidates: string[] = [];
  for (const kw of keywords) {
    candidates.push(kw.toLowerCase());
  }
  const cleanTitleWords = extractKeywordsFromText(title, 6).map((w) => w.toLowerCase());
  for (const w of cleanTitleWords) {
    candidates.push(w);
  }
  if (keywords.length >= 2) {
    candidates.push(`${keywords[0].toLowerCase()} ${keywords[1].toLowerCase()}`);
  }

  const seen = new Set<string>();
  const finalTags: string[] = [];
  let charBudget = 0;

  for (const raw of candidates) {
    const norm = normalizeTagToken(raw);
    if (!norm || norm.length < 2 || norm.length > 40) continue;
    const lower = norm.toLowerCase();
    if (seen.has(lower) || BANNED_SPAM_TAGS.has(lower)) continue;
    const additional = norm.length + (finalTags.length > 0 ? 1 : 0);
    if (charBudget + additional > maxTotalChars) break;
    seen.add(lower);
    finalTags.push(norm);
    charBudget += additional;
    if (finalTags.length >= 15) break;
  }

  return finalTags;
}

/**
 * Centralized deterministic metadata synthesizer.
 * Reuses clip transcripts, captions, FFprobe dimensions, and source metadata without paid AI APIs.
 */
export function generatePublishMetadataPackage(
  input: MetadataGenerateRequestInput
): PublishMetadataPackage {
  const { clip, project, transcript, sourceInput } = input;

  // Gather transcript segments falling inside the clip window if available
  const matchingSegments = (transcript?.segments ?? []).filter(
    (seg) => seg.endSec >= clip.startSec && seg.startSec <= clip.endSec
  );
  const rawSrt = (input.srtContent ?? '').trim();
  const srtPlain = rawSrt ? extractPlainTextFromSrt(rawSrt) : '';

  const segmentTexts = matchingSegments.map((s) => cleanCaptionLine(s.text)).filter(Boolean);
  const transcriptText = segmentTexts.length > 0 ? segmentTexts.join(' ') : srtPlain;

  const combinedCorpus = [clip.title, clip.description, transcriptText].filter(Boolean).join(' ');
  const languageInfo = detectContentLanguage({
    text: combinedCorpus,
    transcriptLanguage: transcript?.language ?? null,
    preferredLanguage: input.preferredLanguage ?? project?.config?.captionPresetId ?? 'en',
  });

  const keywords = extractKeywordsFromText(combinedCorpus, 10);
  const titleCandidates = generateTitleCandidates({
    clipTitle: clip.title,
    clipDescription: clip.description,
    transcriptText,
    keywords,
  });
  const chosenTitle = titleCandidates[0]?.title || sanitizeTitleText(clip.title, 96);

  // Deduplicated relevant hashtags
  const topicHashtags: string[] = [];
  const seenTagLower = new Set<string>();
  for (const kw of keywords) {
    const tag = buildHashtagFromKeyword(kw);
    if (tag && !seenTagLower.has(tag.toLowerCase())) {
      seenTagLower.add(tag.toLowerCase());
      topicHashtags.push(tag);
    }
    if (topicHashtags.length >= 5) break;
  }

  const youtubeFormat: YouTubeFormat =
    input.youtubeFormat ??
    (clip.durationSec <= 180 && (clip.aspectRatio === '9:16' || clip.aspectRatio === '1:1')
      ? 'short'
      : 'video');

  const ytHashtags = [...topicHashtags];
  if (youtubeFormat === 'short' && !seenTagLower.has('#shorts')) {
    ytHashtags.unshift('#Shorts');
  }
  const youtubeHashtags = ytHashtags.slice(0, 6);

  const igHashtags = [...topicHashtags];
  if (clip.aspectRatio === '9:16' && !seenTagLower.has('#reels')) {
    igHashtags.push('#Reels');
  }
  const instagramHashtags = igHashtags.slice(0, 10);

  const youtubeTags = buildYouTubeTags(keywords, chosenTitle);
  const category = inferYouTubeCategory(combinedCorpus);

  const attribution = buildAttributionInfo(clip, project, sourceInput);
  const rights = assessRightsReadiness(clip, project, attribution, sourceInput);

  const includeDisclosure = input.includeAiDisclosure !== false;
  const disclosureLine = includeDisclosure
    ? 'Edited and framed using ClipCat; captions reviewed locally before publication.'
    : null;

  const transcriptExcerpt = transcriptText
    ? sanitizeTitleText(transcriptText, 240)
    : sanitizeTitleText(clip.description || clip.title, 200);

  const youtubeDescParts: string[] = [];
  youtubeDescParts.push(chosenTitle);
  if (clip.description && clip.description.trim() && clip.description.trim() !== chosenTitle) {
    youtubeDescParts.push(clip.description.trim());
  } else if (transcriptExcerpt) {
    youtubeDescParts.push(transcriptExcerpt);
  }
  if (segmentTexts.length > 0 && transcriptExcerpt !== clip.description.trim()) {
    youtubeDescParts.push(`Transcript highlight: "${sanitizeTitleText(segmentTexts[0], 180)}"`);
  }
  if (attribution.formattedCreditYouTube) {
    youtubeDescParts.push(attribution.formattedCreditYouTube);
  }
  if (disclosureLine) {
    youtubeDescParts.push(disclosureLine);
  }
  if (youtubeHashtags.length > 0) {
    youtubeDescParts.push(youtubeHashtags.join(' '));
  }
  const youtubeDescription = youtubeDescParts.join('\n\n').slice(0, 4950);

  const igCaptionParts: string[] = [];
  igCaptionParts.push(chosenTitle);
  if (transcriptExcerpt && transcriptExcerpt !== chosenTitle) {
    igCaptionParts.push(transcriptExcerpt);
  }
  if (attribution.formattedCreditInstagram) {
    igCaptionParts.push(attribution.formattedCreditInstagram);
  }
  if (disclosureLine) {
    igCaptionParts.push(disclosureLine);
  }
  if (instagramHashtags.length > 0) {
    igCaptionParts.push(instagramHashtags.join(' '));
  }
  const instagramCaption = igCaptionParts.join('\n\n').slice(0, 2150);

  const captionsAvailable = Boolean(
    clip.captionStatus === 'applied' || rawSrt || input.vttContent?.trim() || segmentTexts.length > 0
  );
  const srtLinesCount = rawSrt
    ? rawSrt.split(/\r?\n\r?\n/).filter((block) => block.trim().length > 0).length
    : segmentTexts.length;

  const captionsSummary: CaptionPackageSummary = {
    available: captionsAvailable,
    embedded: clip.captionStatus === 'applied' || Boolean(clip.captionSettings?.enabled),
    subtitleFormatsSupported: ['srt', 'vtt'],
    youtubeCaptionUploadSupported: Boolean(rawSrt || input.vttContent?.trim()),
    instagramCaptionApiNote:
      'Instagram Reels API does not ingest external SRT/VTT sidecar uploads; burn subtitles into the MP4 render via Clip Editor before publishing.',
    language: languageInfo.code,
    translated: languageInfo.translated,
    translationLabel: languageInfo.translationNote,
    lineCount: srtLinesCount,
    srtContent: rawSrt,
    vttContent: (input.vttContent ?? '').trim(),
    cleanedTranscriptExcerpt: transcriptExcerpt,
  };

  const ytWarnings: string[] = [];
  const ytErrors: string[] = [];
  if (youtubeFormat === 'short' && clip.durationSec > 180) {
    ytWarnings.push('Clip exceeds 180 seconds; YouTube treats longer uploads as standard videos rather than Shorts.');
  }
  if (youtubeFormat === 'short' && clip.aspectRatio === '16:9') {
    ytWarnings.push('Horizontal 16:9 video will not qualify as YouTube Shorts; YouTube requires square or vertical framing.');
  }

  const igWarnings: string[] = [];
  const igErrors: string[] = [];
  if (clip.durationSec > 90) {
    igWarnings.push('Instagram Reels over 90 seconds may face reach or feed compatibility limits depending on account region.');
  }
  if (!captionsSummary.embedded && captionsSummary.available) {
    igWarnings.push('Instagram Reels API does not support separate SRT sidecar uploads; enable burned-in captions in Clip Editor.');
  }

  const youtubePrivacy = input.youtubePrivacy ?? 'private';

  return {
    clipId: clip.id,
    clipTitleSource: clip.title,
    durationSec: clip.durationSec,
    aspectRatio: clip.aspectRatio,
    resolution: clip.resolution,
    language: languageInfo.code,
    languageLabel: languageInfo.label,
    translationNote: languageInfo.translationNote,
    generatedAt: new Date().toISOString(),
    aiAssistedDisclosureIncluded: includeDisclosure,
    content: {
      title: chosenTitle,
      titleCandidates,
      description: youtubeDescription,
      hashtags: youtubeHashtags,
      instagramHashtags,
      tags: youtubeTags,
      captions: captionsSummary,
    },
    attribution,
    rights,
    platforms: {
      youtube: {
        ready: ytErrors.length === 0,
        format: youtubeFormat,
        privacy: youtubePrivacy,
        madeForKids: input.madeForKids === true,
        categoryId: category.id,
        categoryLabel: category.label,
        title: chosenTitle,
        description: youtubeDescription,
        tags: youtubeTags,
        hashtags: youtubeHashtags,
        language: languageInfo.code,
        attributionText: attribution.formattedCreditYouTube,
        sourceUrl: attribution.sourceUrl,
        thumbnailAvailable: Boolean(clip.thumbnailUrl),
        captionTrackUploadSupported: captionsSummary.youtubeCaptionUploadSupported,
        shortsEligibilityNote:
          youtubeFormat === 'short'
            ? 'YouTube classifies Shorts automatically based on vertical/square aspect ratio and duration (<= 3 min); no force-Short API flag exists.'
            : 'Uploading as standard YouTube video via resumable Data API v3.',
        warnings: ytWarnings,
        errors: ytErrors,
      },
      instagram: {
        ready: igErrors.length === 0,
        format: 'reel',
        caption: instagramCaption,
        hashtags: instagramHashtags,
        attributionText: attribution.formattedCreditInstagram,
        coverImageAvailable: Boolean(clip.thumbnailUrl),
        embeddedCaptionsRecommended: true,
        directPublishSupported: false, // Overridden dynamically by backend capabilities when HTTPS relay is active
        mediaTransferNote:
          'Meta Instagram Graph API requires fetching media from a public HTTPS URL; local-only setups use the Export & Manual Share bundle unless an authorized HTTPS transfer relay is configured.',
        manualShareBundleAvailable: true,
        warnings: igWarnings,
        errors: igErrors,
      },
    },
  };
}
