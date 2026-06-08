'use strict';
const logger = require('../utils/logger');

/**
 * Voice Service — Architecture Placeholder
 *
 * Future voice pipeline:
 *   Microphone (browser)
 *     → MediaRecorder API (PCM/WebM)
 *     → Upload via Socket.IO binary or REST
 *     → transcribe() [Google Speech-to-Text or Gemini Live Audio]
 *     → Gemini text response
 *     → synthesize() [Google Text-to-Speech or ElevenLabs]
 *     → Stream audio back to browser
 *
 * When implementing:
 *   1. Install: @google-cloud/speech, @google-cloud/text-to-speech
 *   2. Replace stubs below with real API calls
 *   3. Add audio streaming via Socket.IO binary frames
 */

/**
 * Transcribe audio buffer to text.
 * @param {Buffer} audioBuffer  Raw audio data from the browser
 * @param {string} [mimeType]   Audio MIME type (e.g. 'audio/webm;codecs=opus')
 * @returns {Promise<string>}   Transcribed text
 */
async function transcribe(audioBuffer, mimeType = 'audio/webm') {
  logger.warn('VoiceService.transcribe() called but voice support is not yet implemented');
  // TODO: Integrate Google Speech-to-Text API
  // const client = new SpeechClient();
  // const [response] = await client.recognize({ audio: { content: audioBuffer }, config: { ... } });
  // return response.results.map(r => r.alternatives[0].transcript).join(' ');
  throw new Error('Voice transcription not yet implemented');
}

/**
 * Synthesize text to audio.
 * @param {string} text   Text to convert to speech
 * @param {string} [languageCode]  BCP-47 language code, default 'en-US'
 * @returns {Promise<Buffer>}  Audio buffer (MP3)
 */
async function synthesize(text, languageCode = 'en-US') {
  logger.warn('VoiceService.synthesize() called but voice support is not yet implemented');
  // TODO: Integrate Google Text-to-Speech API
  // const client = new TextToSpeechClient();
  // const [response] = await client.synthesizeSpeech({ input: { text }, voice: { languageCode }, audioConfig: { audioEncoding: 'MP3' } });
  // return response.audioContent;
  throw new Error('Voice synthesis not yet implemented');
}

/**
 * Check whether voice features are available.
 * @returns {boolean}
 */
function isVoiceAvailable() {
  return false; // Set to true once implemented
}

module.exports = { transcribe, synthesize, isVoiceAvailable };
