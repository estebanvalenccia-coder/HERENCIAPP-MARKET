import express from "express";

const DEFAULT_TTS_CONFIG = {
  languageCode: "es-ES",
  voiceName: "es-ES-Neural2-H",
  speakingRate: 1.08,
  pitch: 2.0,
  audioEncoding: "MP3",
};

function getTtsConfig() {
  return {
    languageCode:
      process.env.GOOGLE_TTS_LANGUAGE_CODE || DEFAULT_TTS_CONFIG.languageCode,
    voiceName: process.env.GOOGLE_TTS_VOICE_NAME || DEFAULT_TTS_CONFIG.voiceName,
    speakingRate: Number(
      process.env.GOOGLE_TTS_SPEAKING_RATE || DEFAULT_TTS_CONFIG.speakingRate
    ),
    pitch: Number(process.env.GOOGLE_TTS_PITCH || DEFAULT_TTS_CONFIG.pitch),
    audioEncoding:
      process.env.GOOGLE_TTS_AUDIO_ENCODING || DEFAULT_TTS_CONFIG.audioEncoding,
  };
}

function getGoogleTtsApiKey() {
  return process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function googleTtsHandler(req, res) {
  try {
    const apiKey = getGoogleTtsApiKey();

    if (!apiKey) {
      return res.status(503).json({
        error:
          "Google TTS no está configurado. Falta GOOGLE_TTS_API_KEY en Render.",
      });
    }

    const text = normalizeText(req.body?.text || req.body?.message);

    if (!text) {
      return res.status(400).json({ error: "Falta el texto para convertir a voz" });
    }

    if (text.length > 4500) {
      return res.status(400).json({
        error: "El texto es demasiado largo. Máximo 4500 caracteres.",
      });
    }

    const config = getTtsConfig();
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(Number(process.env.GOOGLE_TTS_TIMEOUT_MS || 20000)),
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: config.languageCode,
            name: config.voiceName,
            ssmlGender: "FEMALE",
          },
          audioConfig: {
            audioEncoding: config.audioEncoding,
            speakingRate: config.speakingRate,
            pitch: config.pitch,
          },
        }),
      }
    );

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Google TTS respondió con error",
        detail: data?.error?.message || raw,
      });
    }

    return res.json({
      audioContent: data.audioContent,
      mimeType: config.audioEncoding === "MP3" ? "audio/mpeg" : "audio/wav",
      voice: {
        languageCode: config.languageCode,
        name: config.voiceName,
        speakingRate: config.speakingRate,
        pitch: config.pitch,
      },
    });
  } catch (error) {
    console.error("[Google TTS] Error generando voz:", error?.message || error);
    return res.status(500).json({
      error: "Error generando voz con Google TTS",
      detail: error?.message || String(error),
    });
  }
}

const originalListen = express.application.listen;

express.application.listen = function patchedListen(...args) {
  if (!this.__herenciaGoogleTtsRouteInstalled) {
    this.__herenciaGoogleTtsRouteInstalled = true;
    this.post("/api/tts", googleTtsHandler);
  }

  return originalListen.call(this, ...args);
};

console.log(
  "Ruta /api/tts preparada con voz femenina joven: es-ES-Neural2-H. Configurable con GOOGLE_TTS_VOICE_NAME en Render."
);
