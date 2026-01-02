
export interface AudioChunk {
  blob: Blob;
  timestamp: number;
  size: number;
  chunkNumber: number;
}

export interface TranscriptSegment {
  text: string;
  timestamp: string;
  confidence?: number;
  speaker?: string;
}

export interface AudioCaptureConfig {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface WebSocketMessage {
  type: 'ack' | 'transcript' | 'error' | 'connected';
  session_id?: string;
  chunk_number?: number;
  size?: number;
  timestamp?: string;
  text?: string;
  message?: string;
}

export const DEFAULT_AUDIO_CONFIG: AudioCaptureConfig = {
  sampleRate: 16000,      // Whisper prefers 16kHz
  channelCount: 1,        // Mono audio
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export const CHUNK_INTERVAL_MS = 10000; // 10-second chunks (better for Hindi/English mixed speech - more context)
export const OVERLAP_MS = 0; // Overlap disabled - concatenating WebM files creates invalid audio
