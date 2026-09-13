import type { DictationRequest, DictationResult } from "../../shared/contracts";

const ENDPOINT = "https://dictation.assemblyai.com/v1/transcribe/live";

type DictationResponse = {
  text?: string;
  llm_response?: string | null;
  detail?: string;
  error?: string;
};

export async function transcribeDictation(
  request: DictationRequest,
  apiKey: string | undefined,
): Promise<DictationResult> {
  if (!apiKey) throw new Error("Add ASSEMBLYAI_API_KEY to use dictation");
  if (!request.audio?.byteLength) throw new Error("No audio was captured");

  const startedAt = Date.now();
  const config = {
    language_codes: request.languageCodes.length ? request.languageCodes : ["en"],
    stt_prompt: "A person dictating text or a work request to a desktop assistant.",
    keyterms_prompt: request.keyterms?.slice(0, 100),
    llm_instruction:
      "Remove filler words, resolve self-corrections to the speaker's final intent, and add natural punctuation. Preserve names, technical terms, URLs, code, and the speaker's tone. Return only the cleaned text.",
  };

  const form = new FormData();
  form.append("config", new Blob([JSON.stringify(config)], { type: "application/json" }));
  const audioBuffer = request.audio.buffer.slice(
    request.audio.byteOffset,
    request.audio.byteOffset + request.audio.byteLength,
  ) as ArrayBuffer;
  form.append("audio", new Blob([audioBuffer], { type: "audio/wav" }), "twin-dictation.wav");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: apiKey },
    body: form,
    signal: AbortSignal.timeout(90_000),
  });

  const data = (await response.json().catch(() => ({}))) as DictationResponse;
  if (!response.ok) throw new Error(data.error || data.detail || `Dictation failed (${response.status})`);

  const transcript = data.text?.trim() ?? "";
  if (!transcript) throw new Error("No speech was detected");

  return {
    transcript,
    cleanText: data.llm_response?.trim() || transcript,
    durationMs: Date.now() - startedAt,
  };
}
