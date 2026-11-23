'use client';

import { useTranslations } from 'next-intl';
import { Mic, Pause, Play, Square, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import {
  MAX_VOICE_AUDIO_BYTES,
  MAX_VOICE_DURATION_MS,
  type VoiceLanguage,
} from '@/lib/validation/voice';

const VOICE_SAMPLE_RATE = 16_000;

function createWav(chunks: Float32Array[], sourceSampleRate: number): { blob: Blob; durationMs: number } | null {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (sampleCount === 0 || sourceSampleRate <= 0) return null;

  const durationMs = (sampleCount / sourceSampleRate) * 1000;
  const outputSampleCount = Math.floor((sampleCount * VOICE_SAMPLE_RATE) / sourceSampleRate);
  const dataSize = outputSampleCount * 2;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, VOICE_SAMPLE_RATE, true);
  view.setUint32(28, VOICE_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataSize, true);

  let chunkIndex = 0;
  let chunkStart = 0;
  const sampleAt = (index: number) => {
    while (chunkIndex < chunks.length - 1 && index >= chunkStart + (chunks[chunkIndex]?.length ?? 0)) {
      chunkStart += chunks[chunkIndex]?.length ?? 0;
      chunkIndex += 1;
    }
    return chunks[chunkIndex]?.[index - chunkStart] ?? 0;
  };

  for (let index = 0; index < outputSampleCount; index += 1) {
    const sourcePosition = (index * sourceSampleRate) / VOICE_SAMPLE_RATE;
    const firstIndex = Math.floor(sourcePosition);
    const fraction = sourcePosition - firstIndex;
    const sample = sampleAt(firstIndex) * (1 - fraction) + sampleAt(Math.min(firstIndex + 1, sampleCount - 1)) * fraction;
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
  }

  return { blob: new Blob([wav], { type: 'audio/wav' }), durationMs };
}

type VoiceTurnResponse = { text: string; audioData: string | null; voiceError: string | null };
type VoiceState =
  | 'idle'
  | 'waiting_for_permission'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'paused'
  | 'error';

export function VoiceConversation({
  locale,
  onClose,
  onInterruptResponse,
  onSend,
  onTurnSettled,
}: {
  locale: 'ar' | 'en';
  onClose: () => void;
  onInterruptResponse: () => void;
  onSend: (
    text: string,
    language: VoiceLanguage,
    onDelta: (text: string) => void,
    onError: (message: string) => void,
  ) => Promise<VoiceTurnResponse | null>;
  onTurnSettled: () => void;
}) {
  const t = useTranslations('companion');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [language, setLanguage] = useState<VoiceLanguage>('auto');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: 13 }, () => 5));

  const mountedRef = useRef(false);
  const continuousRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const waveformTimerRef = useRef<number | null>(null);
  const sampleChunksRef = useRef<Float32Array[]>([]);
  const sampleCountRef = useRef(0);
  const preRollRef = useRef<Float32Array[]>([]);
  const speechFramesRef = useRef(0);
  const silentFramesRef = useRef(0);
  const speechDetectedRef = useRef(false);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const releaseCapture = useCallback(() => {
    if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current);
    if (waveformTimerRef.current !== null) window.clearInterval(waveformTimerRef.current);
    recordingTimerRef.current = null;
    waveformTimerRef.current = null;

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    silentGainRef.current?.disconnect();
    silentGainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch((error: unknown) => {
        console.error('[voice] audio context cleanup failed', error instanceof Error ? error.name : 'unknown');
      });
    }
  }, []);

  const releasePlayback = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }, []);

  const discardRecording = useCallback(() => {
    sampleChunksRef.current = [];
    sampleCountRef.current = 0;
    releaseCapture();
  }, [releaseCapture]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      discardRecording();
      transcriptionAbortRef.current?.abort();
      releasePlayback();
    };
  }, [discardRecording, releasePlayback]);

  function transcriptionError(code: string): string {
    switch (code) {
      case 'not_configured':
        return t('voice.errors.notConfigured');
      case 'rate_limited':
      case 'rate_limit_unavailable':
      case 'provider_rate_limited':
        return t('voice.errors.rateLimited');
      case 'upstream':
        return t('voice.errors.providerUnavailable');
      case 'unsupported_media':
      case 'duration_unverified':
        return t('voice.errors.unsupportedFormat');
      case 'audio_too_large':
        return t('voice.errors.audioTooLarge');
      case 'duration_too_long':
        return t('voice.errors.audioTooLong');
      case 'empty_audio':
      case 'empty_transcript':
        return t('voice.errors.noSpeech');
      case 'transcript_too_long':
        return t('voice.errors.transcriptTooLong');
      case 'unauthorized':
        return t('voice.errors.sessionExpired');
      default:
        return t('voice.errors.transcriptionFailed');
    }
  }

  function speakError(code: string): string {
    if (code === 'not_configured') return t('voice.errors.notConfigured');
    if (code === 'speech_too_long') return t('voice.errors.speechTooLong');
    return t('voice.errors.speechUnavailable');
  }

  async function playResponse(encodedAudio: string) {
    releasePlayback();
    try {
      const binary = window.atob(encodedAudio);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const audioUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
      const audio = new Audio(audioUrl);
      audioUrlRef.current = audioUrl;
      audioRef.current = audio;
      audio.muted = muted;
      audio.onended = () => {
        releasePlayback();
        if (mountedRef.current) {
          setVoiceState('idle');
          onTurnSettled();
          if (continuousRef.current) void startRecording();
        }
      };
      audio.onerror = () => {
        releasePlayback();
        if (mountedRef.current) {
          setVoiceState('error');
          setErrorMessage(t('voice.errors.playbackFailed'));
          onTurnSettled();
        }
      };
      audio.onpause = () => {
        if (mountedRef.current && audioRef.current === audio && !audio.ended) setVoiceState('paused');
      };
      await audio.play();
      if (mountedRef.current) {
        setErrorMessage(null);
        setVoiceState('speaking');
      }
    } catch {
      if (mountedRef.current) {
        setVoiceState('paused');
        setErrorMessage(t('voice.errors.tapToPlay'));
      }
    }
  }

  async function submitTranscript(text: string) {
    setVoiceState('thinking');
    setAssistantReply('');
    setErrorMessage(null);

    let chatError: string | null = null;
    const result = await onSend(
      text,
      language,
      setAssistantReply,
      (message) => {
        chatError = message;
        setErrorMessage(message);
      },
    );

    if (!mountedRef.current) return;
    if (!result) {
      setVoiceState('error');
      setErrorMessage(chatError ?? t('voice.errors.chatFailed'));
      onTurnSettled();
      return;
    }

    if (result.voiceError) setErrorMessage(speakError(result.voiceError));
    if (result.audioData) {
      await playResponse(result.audioData);
    } else {
      setVoiceState(result.voiceError ? 'error' : 'idle');
      onTurnSettled();
      if (continuousRef.current) void startRecording();
    }
  }

  async function transcribe(blob: Blob, durationMs: number) {
    setVoiceState('transcribing');
    setErrorMessage(null);
    const controller = new AbortController();
    transcriptionAbortRef.current = controller;

    try {
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: {
          'content-type': blob.type,
          'x-voice-consent': 'accepted',
          'x-voice-duration-ms': String(Math.round(durationMs)),
          'x-voice-language': language,
        },
        body: blob,
        signal: controller.signal,
      });

      if (!response.ok) {
        let code = '';
        try {
          const body: unknown = await response.json();
          if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
            code = body.error;
          }
        } catch {
          code = '';
        }
        throw new Error(code || 'transcription_failed');
      }

      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('text' in data) || typeof data.text !== 'string') {
        throw new Error('transcription_failed');
      }

      const text = data.text.trim();
      if (!text) throw new Error('empty_transcript');
      if (mountedRef.current) {
        setTranscript(text);
        await submitTranscript(text);
      }
    } catch (error) {
      if (!mountedRef.current || (error instanceof Error && error.name === 'AbortError')) return;
      const code = error instanceof Error ? error.message : 'transcription_failed';
      setVoiceState('error');
      setErrorMessage(transcriptionError(code));
      onTurnSettled();
    } finally {
      if (transcriptionAbortRef.current === controller) transcriptionAbortRef.current = null;
    }
  }

  function stopRecording() {
    const processor = processorRef.current;
    if (!processor) return;
    setVoiceState('transcribing');
    processor.onaudioprocess = null;
    const audio = createWav(sampleChunksRef.current, audioContextRef.current?.sampleRate ?? 0);
    sampleChunksRef.current = [];
    sampleCountRef.current = 0;
    preRollRef.current = [];
    speechFramesRef.current = 0;
    silentFramesRef.current = 0;
    speechDetectedRef.current = false;
    releaseCapture();

    if (!audio) {
      setVoiceState('error');
      setErrorMessage(t('voice.errors.noSpeech'));
      return;
    }
    if (audio.durationMs < 250) {
      setVoiceState('error');
      setErrorMessage(t('voice.errors.noSpeech'));
      return;
    }
    if (audio.durationMs > MAX_VOICE_DURATION_MS || audio.blob.size > MAX_VOICE_AUDIO_BYTES) {
      setVoiceState('error');
      setErrorMessage(t(audio.blob.size > MAX_VOICE_AUDIO_BYTES ? 'voice.errors.audioTooLarge' : 'voice.errors.audioTooLong'));
      return;
    }
    void transcribe(audio.blob, audio.durationMs);
  }

  async function startRecording() {
    if (!consentAccepted) return;
    setErrorMessage(null);
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof window.AudioContext === 'undefined' ||
      typeof window.AudioContext.prototype.createScriptProcessor !== 'function'
    ) {
      setVoiceState('error');
      setErrorMessage(t('voice.errors.unsupported'));
      return;
    }

    setVoiceState('waiting_for_permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      sampleChunksRef.current = [];
      sampleCountRef.current = 0;
      preRollRef.current = [];
      speechFramesRef.current = 0;
      silentFramesRef.current = 0;
      speechDetectedRef.current = false;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      silentGain.gain.value = 0;
      source.connect(analyser);
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);
      sourceNodeRef.current = source;
      processorRef.current = processor;
      silentGainRef.current = silentGain;

      processor.onaudioprocess = (event) => {
        if (event.inputBuffer.numberOfChannels === 0) return;
        const samples = new Float32Array(event.inputBuffer.getChannelData(0));
        const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
        if (continuousRef.current && !speechDetectedRef.current) {
          preRollRef.current.push(samples);
          if (preRollRef.current.length > 4) preRollRef.current.shift();
          speechFramesRef.current = rms >= 0.025 ? speechFramesRef.current + 1 : 0;
          if (speechFramesRef.current < 2) return;
          speechDetectedRef.current = true;
          sampleChunksRef.current = [...preRollRef.current];
          sampleCountRef.current = sampleChunksRef.current.reduce((total, chunk) => total + chunk.length, 0);
          preRollRef.current = [];
          return;
        }

        sampleChunksRef.current.push(samples);
        sampleCountRef.current += samples.length;
        if (continuousRef.current) {
          silentFramesRef.current = rms < 0.012 ? silentFramesRef.current + 1 : 0;
        }
        if (
          sampleCountRef.current > audioContext.sampleRate * (MAX_VOICE_DURATION_MS / 1000) ||
          (continuousRef.current && speechDetectedRef.current && silentFramesRef.current >= 12)
        ) {
          stopRecording();
        }
      };

      const samples = new Uint8Array(analyser.frequencyBinCount);
      waveformTimerRef.current = window.setInterval(() => {
        analyser.getByteFrequencyData(samples);
        const nextWaveform = Array.from({ length: 13 }, (_, index) => {
          const start = Math.floor((index * samples.length) / 13);
          const end = Math.max(start + 1, Math.floor(((index + 1) * samples.length) / 13));
          const average = samples.slice(start, end).reduce((sum, value) => sum + value, 0) / (end - start);
          return Math.max(5, Math.min(38, Math.round(average / 3)));
        });
        setWaveform(nextWaveform);
      }, 120);

      setVoiceState('listening');
      recordingTimerRef.current = window.setTimeout(stopRecording, MAX_VOICE_DURATION_MS - 1000);
    } catch (error) {
      if (!mountedRef.current) return;
      sampleChunksRef.current = [];
      sampleCountRef.current = 0;
      preRollRef.current = [];
      speechFramesRef.current = 0;
      silentFramesRef.current = 0;
      speechDetectedRef.current = false;
      releaseCapture();
      const name = error instanceof DOMException ? error.name : '';
      setVoiceState('error');
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setErrorMessage(t('voice.errors.permissionDenied'));
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setErrorMessage(t('voice.errors.microphoneUnavailable'));
      } else {
        setErrorMessage(t('voice.errors.recordingFailed'));
      }
    }
  }

  function handleMicrophone() {
    if (voiceState === 'listening') {
      stopRecording();
      return;
    }
    if (voiceState === 'speaking' || voiceState === 'paused') releasePlayback();
    if (voiceState === 'speaking' || voiceState === 'paused') {
      setVoiceState('idle');
      setErrorMessage(null);
    }
    void startRecording();
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().then(
        () => {
          setVoiceState('speaking');
          setErrorMessage(null);
        },
        () => {
          setVoiceState('paused');
          setErrorMessage(t('voice.errors.playbackFailed'));
        },
      );
    } else {
      audio.pause();
      setVoiceState('paused');
    }
  }

  function stopSpeaking() {
    releasePlayback();
    setVoiceState('idle');
    setErrorMessage(null);
    onTurnSettled();
    if (continuousRef.current) void startRecording();
  }

  function endSession() {
    discardRecording();
    transcriptionAbortRef.current?.abort();
    transcriptionAbortRef.current = null;
    releasePlayback();
    if (voiceState === 'thinking') onInterruptResponse();
    continuousRef.current = false;
    setContinuous(false);
    setVoiceState('idle');
    setConsentAccepted(false);
    setTranscript('');
    setAssistantReply('');
    setErrorMessage(null);
    setWaveform(Array.from({ length: 13 }, () => 5));
    onTurnSettled();
  }

  const stateLabel = t(`voice.states.${voiceState}`);
  const isBusy = voiceState === 'waiting_for_permission' || voiceState === 'transcribing' || voiceState === 'thinking';
  const canPlay = voiceState === 'speaking' || voiceState === 'paused';
  const micLabel =
    voiceState === 'listening'
      ? t('voice.stopRecording')
      : voiceState === 'speaking' || voiceState === 'paused'
        ? t('voice.interrupt')
        : t('voice.startRecording');

  return (
    <section
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      aria-label={t('voice.title')}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.045] to-transparent p-4 sm:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">{t('voice.title')}</h2>
          <p className="mt-1 text-sm text-muted" role="status" aria-live="polite">
            {stateLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="voice-language">
            {t('voice.language')}
          </label>
          <select
            id="voice-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as VoiceLanguage)}
            disabled={isBusy || voiceState === 'listening' || canPlay}
            className="min-h-10 rounded-full border border-white/15 bg-black/20 px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="auto">{t('voice.languages.auto')}</option>
            <option value="ar">{t('voice.languages.ar')}</option>
            <option value="en">{t('voice.languages.en')}</option>
          </select>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full border border-white/15 px-4 text-sm text-muted transition hover:bg-white/10 hover:text-ink"
          >
            {t('voice.returnToText')}
          </button>
        </div>
      </header>

      {!consentAccepted ? (
        <div className="mx-auto mt-4 mb-2 w-full max-w-xl">
          <div className="glass space-y-3 rounded-2xl p-4 sm:p-5">
            <h3 className="font-semibold">{t('voice.privacyTitle')}</h3>
            <p className="text-sm leading-7 text-muted">{t('voice.privacyBody')}</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setConsentAccepted(true)}>{t('voice.acceptConsent')}</Button>
              <Button variant="outline" onClick={onClose}>
                {t('voice.cancel')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="my-auto flex min-h-64 flex-col items-center justify-center py-8">
            <div className="mb-6 flex h-16 items-center justify-center gap-2" aria-hidden="true">
              {waveform.map((height, index) => (
                <span
                  key={index}
                  className={`w-1.5 rounded-full bg-primary-light/90 transition-[height] duration-100 ${
                    voiceState === 'listening' ? 'animate-pulse' : ''
                  }`}
                  style={{ height: `${height}px`, animationDelay: `${index * 35}ms` }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleMicrophone}
              disabled={isBusy}
              aria-label={micLabel}
              className={`flex h-20 w-20 items-center justify-center rounded-full border text-white shadow-lg transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60 ${
                voiceState === 'listening'
                  ? 'border-red-300/40 bg-red-500/80 shadow-red-950/30'
                  : 'border-primary-light/30 bg-gradient-to-br from-primary to-primary-dark shadow-primary/20'
              }`}
            >
              {isBusy ? (
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-current border-e-transparent" />
              ) : (
                <Mic className="h-8 w-8" aria-hidden="true" />
              )}
            </button>
            <p className="mt-4 max-w-md text-center text-sm text-muted">
              {voiceState === 'listening'
                ? continuous
                  ? t('voice.continuousListeningHint')
                  : t('voice.listeningHint')
                : continuous
                  ? t('voice.continuousStartHint')
                  : t('voice.microphoneHint')}
            </p>
            <p className="mt-2 text-xs text-muted/80">{t('voice.durationLimit')}</p>
            <label className="mt-5 inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={continuous}
                disabled={isBusy || voiceState === 'listening'}
                onChange={(event) => {
                  continuousRef.current = event.target.checked;
                  setContinuous(event.target.checked);
                }}
                className="h-4 w-4 accent-primary"
              />
              {t('voice.continuous')}
            </label>
            <p className="mt-1 max-w-md text-center text-xs text-muted/80">
              {continuous ? t('voice.continuousHint') : t('voice.pushToTalkHint')}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {canPlay && (
                <>
                  <Button variant="outline" size="sm" onClick={togglePlayback}>
                    {voiceState === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {voiceState === 'paused' ? t('voice.resume') : t('voice.pause')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={stopSpeaking}>
                    <Square className="h-4 w-4" />
                    {t('voice.stopSpeaking')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={muted ? t('voice.unmute') : t('voice.mute')}
                    onClick={() => {
                      const nextMuted = !muted;
                      setMuted(nextMuted);
                      if (audioRef.current) audioRef.current.muted = nextMuted;
                    }}
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    {muted ? t('voice.unmute') : t('voice.mute')}
                  </Button>
                </>
              )}
              {voiceState === 'thinking' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setErrorMessage(t('voice.errors.cancelled'));
                    onInterruptResponse();
                  }}
                >
                  <Square className="h-4 w-4" />
                  {t('voice.interruptResponse')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={endSession}>
                {t('voice.endSession')}
              </Button>
            </div>
          </div>

          {(transcript || assistantReply) && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2" aria-live="polite">
              {transcript && (
                <div className="glass min-w-0 rounded-2xl p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('voice.youSaid')}
                  </h3>
                  <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-7">
                    {transcript}
                  </p>
                </div>
              )}
              {assistantReply && (
                <div className="glass min-w-0 rounded-2xl p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('voice.companionSaid')}
                  </h3>
                  <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-7">
                    {assistantReply}
                  </p>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <Alert className="mb-3">
              <span>{errorMessage}</span>
              {voiceState === 'paused' && (
                <button type="button" onClick={togglePlayback} className="ms-2 underline">
                  {t('voice.playResponse')}
                </button>
              )}
            </Alert>
          )}
        </>
      )}
    </section>
  );
}
