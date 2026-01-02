/**
 * WebSocket client for streaming audio to backend
 */

import { WebSocketMessage } from './types';

export type TranscriptCallback = (text: string, timestamp: string) => void;
export type ErrorCallback = (error: string) => void;
export type StatusCallback = (status: ConnectionStatus) => void;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export class AudioWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private sessionId: string | null = null;

  // Callbacks
  private transcriptCallback: TranscriptCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private statusCallback: StatusCallback | null = null;

  // Stats
  private chunksSent: number = 0;
  private bytesSent: number = 0;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[AudioWebSocket] Connecting to:', this.url);
      this.statusCallback?.('connecting');

      this.ws = new WebSocket(this.url);

      // Set binary type for audio blobs
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[AudioWebSocket] Connection opened');
        this.statusCallback?.('connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[AudioWebSocket] Connection error:', error);
        this.statusCallback?.('error');
        this.errorCallback?.('WebSocket connection error');
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[AudioWebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[AudioWebSocket] Connection closed:', event.code, event.reason);
        this.statusCallback?.('disconnected');
        this.ws = null;
        this.sessionId = null;
      };
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocketMessage): void {
    console.log('[AudioWebSocket] Received message:', data.type);

    switch (data.type) {
      case 'connected':
        this.sessionId = data.session_id || null;
        console.log(`[AudioWebSocket] Session ID: ${this.sessionId}`);
        break;

      case 'ack':
        console.log(
          `[AudioWebSocket] Chunk ${data.chunk_number} acknowledged ` +
          `(${data.size} bytes)`
        );
        break;

      case 'transcript':
        if (data.text && this.transcriptCallback) {
          console.log('[AudioWebSocket] Transcript received:', data.text);
          this.transcriptCallback(data.text, data.timestamp || new Date().toISOString());
        }
        break;

      case 'error':
        console.error('[AudioWebSocket] Server error:', data.message);
        this.errorCallback?.(data.message || 'Unknown server error');
        break;

      default:
        console.warn('[AudioWebSocket] Unknown message type:', data.type);
    }
  }

  /**
   * Send audio blob to server
   */
  async sendAudio(blob: Blob): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[AudioWebSocket] Cannot send: WebSocket not connected');
      return;
    }

    try {
      // Convert blob to ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();

      // Send binary data
      this.ws.send(arrayBuffer);

      this.chunksSent++;
      this.bytesSent += arrayBuffer.byteLength;

      console.log(
        `[AudioWebSocket] Sent chunk ${this.chunksSent}: ` +
        `${arrayBuffer.byteLength} bytes (total: ${this.bytesSent} bytes)`
      );
    } catch (error) {
      console.error('[AudioWebSocket] Failed to send audio:', error);
      this.errorCallback?.(`Failed to send audio: ${error}`);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'disconnected';
    }
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get stats
   */
  getStats(): { chunksSent: number; bytesSent: number } {
    return {
      chunksSent: this.chunksSent,
      bytesSent: this.bytesSent,
    };
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.ws) {
      console.log('[AudioWebSocket] Disconnecting...');
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
      this.sessionId = null;
      this.chunksSent = 0;
      this.bytesSent = 0;
    }
  }

  // Callback setters
  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallback = callback;
  }

  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  onStatus(callback: StatusCallback): void {
    this.statusCallback = callback;
  }
}
