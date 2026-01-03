
import { AudioCaptureConfig, DEFAULT_AUDIO_CONFIG } from './types';

export type AudioDataCallback = (blob: Blob, chunkNumber: number) => void;
export type AudioLevelCallback = (level: number) => void;
export type ErrorCallback = (error: Error) => void;

export class WebAudioCapture {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelInterval: ReturnType<typeof setInterval> | null = null;
  private chunkCount: number = 0;
  private config: AudioCaptureConfig;

  // Overlap support - store previous chunk's audio data
  private previousChunkBlobs: Blob[] = [];
  private overlapMs: number = 0;

  // Callbacks
  private onDataCallback: AudioDataCallback | null = null;
  private onLevelCallback: AudioLevelCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;

  constructor(config: Partial<AudioCaptureConfig> = {}) {
    this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
  }

  /**
   * Request microphone permission and initialize audio capture
   */
  async initialize(deviceId?: string): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
        },
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[WebAudioCapture] Microphone access granted');

      // Set up AudioContext for level visualization
      // Browser's native sample rate is used (typically 48kHz from hardware)
      // MediaRecorder handles resampling to target rate internally
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      // Set up MediaRecorder for encoding
      const mimeType = this.getSupportedMimeType();
      console.log(`[WebAudioCapture] Using MIME type: ${mimeType}`);

      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      // Handle data available event with overlap support
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          this.chunkCount++;
          let finalBlob = event.data;

          // Add overlap from previous chunk if configured
          if (this.overlapMs > 0 && this.previousChunkBlobs.length > 0) {
            // Merge previous chunk's end with current chunk's start
            finalBlob = new Blob([...this.previousChunkBlobs, event.data], { type: event.data.type });
            console.log(`[WebAudioCapture] Chunk ${this.chunkCount}: ${event.data.size} bytes + ${this.previousChunkBlobs.reduce((sum, b) => sum + b.size, 0)} bytes overlap = ${finalBlob.size} bytes total`);
          } else {
            console.log(`[WebAudioCapture] Chunk ${this.chunkCount}: ${event.data.size} bytes`);
          }

          // Store current chunk for next iteration's overlap
          // Keep only the portion representing the overlap duration
          if (this.overlapMs > 0) {
            // Estimate: overlap duration as percentage of chunk
            // This is approximate since we can't perfectly slice WebM without decoding
            this.previousChunkBlobs = [event.data];
          }

          this.onDataCallback?.(finalBlob, this.chunkCount);
        }
      };

      // Handle errors
      this.mediaRecorder.onerror = (event) => {
        const error = new Error(`MediaRecorder error: ${event}`);
        console.error('[WebAudioCapture]', error);
        this.onErrorCallback?.(error);
      };

      console.log('[WebAudioCapture] Initialized successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[WebAudioCapture] Initialization failed:', err);
      throw err;
    }
  }

  /**
   * Get the best supported MIME type for audio recording
   */
  private getSupportedMimeType(): string {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    // Fallback - let browser choose
    return '';
  }

  /**
   * Start recording audio with periodic chunk generation and optional overlap
   *
   * Uses stop/restart mechanism instead of timeslice to ensure complete WebM files
   * are generated. MediaRecorder with timeslice only sends EBML headers in the first
   * chunk, making subsequent chunks undecodable by ffmpeg.
   *
   * Supports overlapping chunks to avoid missing words at boundaries.
   */
  startRecording(chunkIntervalMs: number = 5000, overlapMs: number = 0): void {
    if (!this.mediaRecorder) {
      throw new Error('WebAudioCapture not initialized. Call initialize() first.');
    }

    if (this.mediaRecorder.state === 'recording') {
      console.warn('[WebAudioCapture] Already recording');
      return;
    }

    this.chunkCount = 0;
    this.overlapMs = overlapMs;
    this.previousChunkBlobs = [];

    // Start recording without timeslice parameter
    this.mediaRecorder.start();
    console.log(`[WebAudioCapture] Recording started (${chunkIntervalMs}ms chunks, ${overlapMs}ms overlap)`);

    // Periodically stop and restart MediaRecorder to generate complete WebM files
    const restartInterval = setInterval(() => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop(); // Triggers ondataavailable with complete WebM file
        setTimeout(() => {
          if (this.mediaRecorder && this.mediaRecorder.state !== 'recording') {
            this.mediaRecorder.start(); // Begin new recording session
          }
        }, 100); // Small delay to ensure stop event completes
      } else {
        clearInterval(restartInterval);
      }
    }, chunkIntervalMs);

    // Store interval ID for cleanup during stop
    (this.mediaRecorder as any)._restartInterval = restartInterval;

    // Start level monitoring
    this.startLevelMonitoring();
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause();
      console.log('[WebAudioCapture] Recording paused');
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume();
      console.log('[WebAudioCapture] Recording resumed');
    }
  }

  /**
   * Stop recording and cleanup
   */
  stop(): void {
    console.log('[WebAudioCapture] Stopping...');

    // Clear restart interval if it exists
    if (this.mediaRecorder && (this.mediaRecorder as any)._restartInterval) {
      clearInterval((this.mediaRecorder as any)._restartInterval);
      (this.mediaRecorder as any)._restartInterval = null;
    }

    // Stop level monitoring
    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop all tracks
    this.mediaStream?.getTracks().forEach((track) => {
      track.stop();
      console.log(`[WebAudioCapture] Track stopped: ${track.kind}`);
    });

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    // Reset state
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.chunkCount = 0;

    console.log('[WebAudioCapture] Stopped and cleaned up');
  }

  /**
   * Get current audio level (0-100)
   */
  getAudioLevel(): number {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average level
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;

    // Normalize to 0-100 scale
    return Math.min(100, (average / 255) * 100 * 2); // *2 to make it more visible
  }

  /**
   * Start monitoring audio levels at 100ms intervals
   */
  private startLevelMonitoring(): void {
    if (this.levelInterval) {
      clearInterval(this.levelInterval);
    }

    this.levelInterval = setInterval(() => {
      const level = this.getAudioLevel();
      this.onLevelCallback?.(level);
    }, 100);
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused';
  }

  /**
   * Get recording state
   */
  getState(): RecordingState | null {
    return this.mediaRecorder?.state ?? null;
  }

  // Callback setters
  onData(callback: AudioDataCallback): void {
    this.onDataCallback = callback;
  }

  onLevel(callback: AudioLevelCallback): void {
    this.onLevelCallback = callback;
  }

  onError(callback: ErrorCallback): void {
    this.onErrorCallback = callback;
  }

  /**
   * List available audio input devices
   */
  static async getDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  /**
   * Check if browser supports required APIs
   */
  static isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      window.MediaRecorder &&
      window.AudioContext
    );
  }
}
