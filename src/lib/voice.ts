/** Records microphone audio and encodes it as a complete 16 kHz mono WAV file. */
export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.context = new AudioContext();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.node = this.context.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.node.onaudioprocess = (event) => {
      this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    this.source.connect(this.node);
    this.node.connect(this.context.destination);
  }

  async stop(): Promise<Blob> {
    const rate = this.context?.sampleRate ?? 44_100;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.node?.disconnect();
    this.source?.disconnect();
    const chunks = this.chunks;
    this.chunks = [];
    await this.context?.close();
    this.context = null;
    return encodeWav(chunks, rate);
  }
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const target = 16_000;
  const ratio = sampleRate / target;
  const outLength = Math.floor(merged.length / ratio);
  const samples = new Int16Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const value = merged[Math.floor(i * ratio)] ?? 0;
    samples[i] = Math.max(-1, Math.min(1, value)) * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (position: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(position + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, target, true);
  view.setUint32(28, target * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  new Int16Array(buffer, 44).set(samples);
  return new Blob([buffer], { type: "audio/wav" });
}

/** Sends a recorded clip to the server and returns the transcript. */
export async function transcribe(blob: Blob): Promise<string> {
  if (blob.size < 2048) throw new Error("That recording was empty — please try again.");
  const form = new FormData();
  form.append("audio", blob, "recording.wav");
  const response = await fetch("/api/public/voice-transcribe", { method: "POST", body: form });
  if (!response.ok) throw new Error(await response.text());
  const payload = (await response.json()) as { text: string };
  return payload.text;
}

/** Speaks a reply out loud through the server text-to-speech endpoint. */
export async function speak(text: string): Promise<HTMLAudioElement> {
  const response = await fetch("/api/public/voice-speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error("The concierge could not speak that reply.");
  const audio = new Audio(URL.createObjectURL(await response.blob()));
  await audio.play();
  return audio;
}
