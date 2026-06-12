'use strict';
const { GoogleGenAI } = require('@google/genai');
const config = require('../config');
const logger = require('../utils/logger');

// Initialize the new Google GenAI SDK client
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

/**
 * Transcribe audio buffer to text.
 * @param {Buffer|string} audioBuffer  Raw audio data from the browser (Buffer or base64 string)
 * @param {string} [mimeType]   Audio MIME type (e.g. 'audio/webm;codecs=opus')
 * @returns {Promise<string>}   Transcribed text
 */
async function transcribe(audioBuffer, mimeType = 'audio/webm') {
  try {
    logger.info('VoiceService: Transcribing audio...', { mimeType });
    const base64Data = Buffer.isBuffer(audioBuffer)
      ? audioBuffer.toString('base64')
      : audioBuffer;

    const response = await ai.models.generateContent({
      model: config.geminiChatModel || 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        'Transcribe the spoken audio into text. Return ONLY the transcription, nothing else. If it is in Arabic, transcribe it in Arabic. If English, transcribe in English.'
      ]
    });

    const transcript = response.text ? response.text.trim() : '';
    logger.info('VoiceService: Transcribed successfully', { transcriptLength: transcript.length });
    return transcript;
  } catch (err) {
    logger.error('VoiceService: Transcription failed', { error: err.message });
    throw err;
  }
}

/**
 * Clean markdown, HTML and format text for speech.
 */
function cleanTextForSpeech(text) {
  if (!text) return '';
  
  // Remove markdown characters, links, and formatting
  let cleaned = text
    .replace(/[#*`~_]/g, '') // remove headers, bold, code, strikethrough, italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // replace links with their text
    .replace(/^\s*[-*+]\s+/gm, '') // remove bullet points
    .replace(/\s+/g, ' ') // collapse multiple spaces/newlines
    .trim();
  
  return cleaned;
}

/**
 * Synthesize text to audio.
 * @param {string} text   Text to convert to speech
 * @param {string} [languageCode]  BCP-47 language code, default 'en-US'
 * @returns {Promise<string>}  Base64 encoded audio data (raw PCM L16 24kHz Mono)
 */
async function synthesize(text, languageCode = 'en-US') {
  try {
    const cleanedText = cleanTextForSpeech(text);
    logger.info('VoiceService: Synthesizing text to speech...', { 
      originalLength: text.length, 
      textLength: cleanedText.length, 
      languageCode, 
      message: cleanedText 
    });

    // Choose voice depending on language (optional, Aoede is generic and good)
    const voiceName = 'Aoede';

    const response = await ai.models.generateContent({
      model: config.geminiLiveModelTTS,
      contents: `Read the following text out loud in ${languageCode === 'ar' ? 'Arabic' : 'English'}: "${cleanedText.replace(/"/g, '\\"')}"`,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName
            }
          }
        }
      }
    });

    const candidates = response.candidates;
    if (candidates?.[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          logger.info('VoiceService: Synthesized audio successfully', {
            mimeType: part.inlineData.mimeType,
            dataLength: part.inlineData.data?.length
          });
          return part.inlineData.data; // Return base64 string
        }
      }
    }

    throw new Error('No audio returned in response parts from Gemini TTS model');
  } catch (err) {
    logger.error('VoiceService: Synthesis failed', { error: err.message });
    throw err;
  }
}

/**
 * Check whether voice features are available.
 * @returns {boolean}
 */
function isVoiceAvailable() {
  return !!config.geminiApiKey;
}

module.exports = { transcribe, synthesize, isVoiceAvailable };

