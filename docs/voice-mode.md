# Companion voice mode

Voice mode uses the existing Companion conversation. Transcribed user speech is sent through `/api/chat`, so the current authentication, crisis checks, history, credits, and message persistence remain in effect. Voice replies are returned in that same stream.

## Configuration

Voice mode uses the existing server-only `LLM_API_KEY` Gemini key; it does not require another credential. The default models are configured in `.env.example`:

- `VOICE_STT_MODEL=gemini-4-hydrogen` for audio transcription.
- `VOICE_TTS_MODEL=gemini-3.8-flash-tts` for spoken replies.

Set either variable to a model available to the Google AI project associated with `LLM_API_KEY`. Voice mode requires access to Gemini's Interactions API and the selected audio models. If they are unavailable, text chat remains usable and a localized voice error is shown.

## Privacy and limits

Before recording, the user must accept an in-product notice explaining that audio is sent to Google Gemini. Recordings are captured as 16 kHz mono WAV, limited to 60 seconds and 5 MB, and checked for their actual WAV duration on the server. Audio is held in memory only for transcription and is not written to Dreamora storage. Only the transcript and companion reply are saved in the existing conversation. Users can choose Arabic, English, or automatic language detection without changing the app language.

Browser push-to-talk and opt-in hands-free voice activity detection use Web Audio. Hands-free listening starts only after consent and an explicit microphone action; detected pauses end turns, and listening resumes after a spoken reply until the user ends the session. Push-to-talk remains available, and browsers without microphone or script-processor support receive a text-chat fallback.

Transcription also uses a per-process attempt throttle and the existing per-user completed-chat rate limit. Deployments with multiple server instances should retain the completed-chat limiter as the durable limit.
