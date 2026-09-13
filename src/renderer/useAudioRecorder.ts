import { useCallback, useRef, useState } from "react";

function encodeWav(chunks: Float32Array[], sampleRate: number): Uint8Array {
  const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, totalSamples * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (const sample of chunk) {
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
}

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const silent = context.createGain();
    silent.gain.value = 0;
    chunksRef.current = [];

    processor.onaudioprocess = (event) => {
      const samples = event.inputBuffer.getChannelData(0);
      chunksRef.current.push(new Float32Array(samples));
      const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
      setLevel(Math.min(1, peak * 2.8));
    };

    source.connect(processor);
    processor.connect(silent);
    silent.connect(context.destination);
    contextRef.current = context;
    streamRef.current = stream;
    processorRef.current = processor;
    setRecording(true);
  }, []);

  const stop = useCallback(async () => {
    const context = contextRef.current;
    if (!context) throw new Error("Recording has not started");
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const audio = encodeWav(chunksRef.current, context.sampleRate);
    await context.close();
    contextRef.current = null;
    streamRef.current = null;
    processorRef.current = null;
    setLevel(0);
    setRecording(false);
    return audio;
  }, []);

  return { recording, level, start, stop };
}
