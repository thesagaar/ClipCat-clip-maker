# Terms and Conditions — ClipCat

**Product:** ClipCat — AI Video Clipping Studio  
**Parent Brand:** Single Dimension Projects (SDP)  
**Version Covered:** `0.1.0`  

> **DRAFT LEGAL DOCUMENT — COUNSEL REVIEW REQUIRED:** This text is a structured product Terms and Conditions draft aligned to ClipCat's actual technical architecture and capabilities. Do **not** treat this document as finalized legal advice or publish it for paid/commercial public distribution without review and completion of governing-law jurisdiction and legal-entity details by qualified legal counsel.

---

## 1. Acceptance of Terms

By accessing or using the **ClipCat** web application or Windows desktop interface (a product by **Single Dimension Projects**), you agree to be bound by these Terms and Conditions. If you do not agree with these terms, discontinue use of ClipCat.

---

## 2. Description of the Service

ClipCat provides a user interface for creating video-clipping projects, uploading video files or inspecting supported video URLs, tracking AI speech transcription and highlight detection jobs, editing generated clip trim boundaries and captions, and exporting finished video/caption deliverables (`MP4`, `SRT`, `VTT`, etc.) through a user-configured FastAPI backend engine.

---

## 3. User Responsibility for Content, Copyright, and Intellectual Property

You remain solely responsible for all video files, audio tracks, URLs, transcripts, captions, and exported media processed using ClipCat. By submitting or processing content through ClipCat, you represent and warrant that:

1. You own the intellectual property rights to the content or hold all necessary licenses, permissions, and consents (including music, likeness, voice, and third-party footage clearances) required to copy, transcribe, clip, caption, transform, and distribute it.
2. Your use of ClipCat via file upload or direct video URL complies with applicable copyright laws, platform terms of service, privacy laws, and third-party rights.
3. Single Dimension Projects does not claim ownership over your source videos, transcripts, or exported clips.

---

## 4. Acceptable Use & Prohibited Conduct

You agree **not** to use ClipCat to:
- Process, generate, or distribute unlawful, infringing, defamatory, fraudulent, or malicious material.
- Probe, scan, or target private internal networks, cloud metadata endpoints (`169.254.169.254`), loopback addresses, or unauthorized servers via URL import inputs (SSRF abuse).
- Circumvent technical rate limits, upload validation checks, file-size constraints, or automated abuse protections on any hosted or shared ClipCat backend.
- Reverse-engineer, overload, scrape, or disrupt hosted websites, documentation, or telemetry endpoints associated with Single Dimension Projects.

---

## 5. Local Processing & Technical Limitations

- **Client/Backend Split:** ClipCat's frontend relies on your configured local or self-hosted FastAPI backend (`FFmpeg`, `FFprobe`, `Whisper`, `Python`) to execute media decoding, transcription, and rendering. When no backend is running or unreachable, live processing and exports are unavailable.
- **AI Accuracy Limitations:** Automated speech transcription, speaker detection, highlight scoring, and reframing may produce inaccurate wording, timing offsets, or visual crops. You are responsible for reviewing captions, subtitles, and clip trims before publishing exported videos.
- **No Guaranteed Availability:** Features, presets, browser compatibility, and export speeds depend on local hardware (CPU/GPU/RAM/disk space) and browser capabilities. Single Dimension Projects provides no uptime or throughput SLA for the local-first application.

---

## 6. Export Responsibility

Before publishing or distributing exported MP4 clips, thumbnails, or subtitle files (`SRT` / `VTT`), you are responsible for verifying audio sync, burned-in caption legibility, aspect ratio framing, and compliance with destination platform guidelines and legal disclosures.

---

## 7. Third-Party Services & Dependencies

ClipCat interacts with:
- Your own configured FastAPI backend and local dependencies (`FFmpeg`, `FFprobe`, `Whisper`)
- Optional external video URLs supplied by you (subject to external host availability and terms)
- Optional privacy-conscious product analytics or error diagnostics providers, **only** when explicitly configured by the operator and enabled with your consent as described in ClipCat's Privacy Policy (`/privacy`).

Single Dimension Projects is not responsible for third-party websites, media hosts, codecs, or network operators.

---

## 8. Product Usage Analytics & Diagnostics

As detailed in the **Privacy Policy** (`/privacy`), ClipCat may collect privacy-conscious usage events and sanitized technical error diagnostics solely when deployment configuration and user consent permit. Media files, transcripts, project names, filenames, and credentials are never collected through analytics.

---

## 9. Disclaimers & Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
- ClipCat is provided **"AS IS"** and **"AS AVAILABLE"** without warranties of any kind, whether express, implied, or statutory, including fitness for a particular purpose, merchantability, accuracy of AI outputs, or non-infringement.
- Single Dimension Projects shall not be liable for any indirect, incidental, consequential, special, or exemplary damages, loss of data, corruption of local media files, lost profits, or business interruption arising out of your use or inability to use ClipCat. You are encouraged to keep backup copies of important source videos before processing or clearing temporary directories.

*(Legal Counsel Note: Add governing law, dispute resolution venue, statutory consumer-rights carve-outs, and official legal entity name/jurisdiction prior to commercial launch.)*

---

## 10. Changes to Terms

Single Dimension Projects may update these Terms and Conditions as ClipCat evolves (for example, when backend authentication or hosted features are introduced). Updated versions will carry a revised effective/version notice in-app (`/terms`) and in repository documentation.

---

## 11. Contact Information

For questions or notices regarding ClipCat:
- **Parent Brand:** Single Dimension Projects (SDP)
- **Website:** https://single-dimension-projects.vercel.app
- **Support & Contact:** https://single-dimension-projects.vercel.app/contact
- **In-App Route:** `/terms`
