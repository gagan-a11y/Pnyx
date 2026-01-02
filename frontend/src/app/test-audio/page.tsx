'use client';

import { useState, useEffect, useRef } from 'react';
import { WebAudioCapture, AudioWebSocketClient, ConnectionStatus } from '@/lib/audio-web';
import { CHUNK_INTERVAL_MS, OVERLAP_MS } from '@/lib/audio-web/types';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export default function TestAudioPage() {
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [transcripts, setTranscripts] = useState<string[]>([]);

  // WebSocket state
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Refs
  const captureRef = useRef<WebAudioCapture | null>(null);
  const wsRef = useRef<AudioWebSocketClient | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Add log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`].slice(-50)); // Keep last 50, add to end
  };

  // Auto-scroll logs to bottom when new log arrives
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Check browser support on mount
  useEffect(() => {
    const supported = WebAudioCapture.isSupported();
    setIsSupported(supported);
    if (!supported) {
      setError('Your browser does not support the required audio APIs');
    }
  }, []);

  // Load available devices
  const loadDevices = async () => {
    try {
      const deviceList = await WebAudioCapture.getDevices();
      const formattedDevices = deviceList.map((d) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
      }));
      setDevices(formattedDevices);
      addLog(`Found ${formattedDevices.length} audio input devices`);

      // Select first device if none selected
      if (formattedDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(formattedDevices[0].deviceId);
      }
    } catch (err) {
      addLog(`Failed to enumerate devices: ${err}`);
    }
  };

  // Load devices on mount (after permission granted)
  useEffect(() => {
    // Request permission first to get device labels
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        loadDevices();
      })
      .catch(() => {
        addLog('Microphone permission denied or not available');
      });
  }, []);

  // Start recording
  const handleStart = async () => {
    setError(null);
    addLog('Starting browser audio capture + WebSocket...');

    try {
      // Step 1: Connect to WebSocket server
      const websocket = new AudioWebSocketClient('ws://localhost:5167/ws/audio');

      // Set up WebSocket callbacks
      websocket.onStatus((status) => {
        setWsStatus(status);
        addLog(`WebSocket status: ${status}`);
      });

      websocket.onError((error) => {
        addLog(`WebSocket error: ${error}`);
        setError(error);
      });

      websocket.onTranscript((text, timestamp) => {
        addLog(`📝 Transcript received: "${text}"`);
        setTranscripts((prev) => [...prev, text]);
      });

      // Connect to backend
      await websocket.connect();
      const sid = websocket.getSessionId();
      setSessionId(sid);
      addLog(`WebSocket connected (Session: ${sid})`);

      // Step 2: Start browser audio capture
      const capture = new WebAudioCapture();

      // Set up audio callbacks
      capture.onLevel((level) => {
        setAudioLevel(level);
      });

      capture.onData((blob, chunkNum) => {
        setChunkCount(chunkNum);
        setTotalBytes((prev) => prev + blob.size);

        // Send to backend via WebSocket
        websocket.sendAudio(blob);

        addLog(`Chunk ${chunkNum}: ${blob.size} bytes → sent to backend`);
      });

      capture.onError((err) => {
        setError(err.message);
        addLog(`Audio error: ${err.message}`);
      });

      // Initialize with selected device
      await capture.initialize(selectedDevice || undefined);
      addLog('Microphone access granted');

      // Start recording with overlap
      capture.startRecording(CHUNK_INTERVAL_MS, OVERLAP_MS);
      addLog(`Recording started (${CHUNK_INTERVAL_MS}ms chunks with ${OVERLAP_MS}ms overlap)`);

      captureRef.current = capture;
      wsRef.current = websocket;
      setIsRecording(true);
      setIsPaused(false);
      setChunkCount(0);
      setTotalBytes(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      addLog(`Failed to start: ${message}`);
    }
  };

  // Pause recording
  const handlePause = () => {
    if (captureRef.current) {
      captureRef.current.pauseRecording();
      setIsPaused(true);
      addLog('Recording paused');
    }
  };

  // Resume recording
  const handleResume = () => {
    if (captureRef.current) {
      captureRef.current.resumeRecording();
      setIsPaused(false);
      addLog('Recording resumed');
    }
  };

  // Stop recording
  const handleStop = () => {
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
      addLog('Recording stopped');
    }

    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
      addLog('WebSocket disconnected');
    }

    setIsRecording(false);
    setIsPaused(false);
    setAudioLevel(0);
    setWsStatus('disconnected');
    setSessionId(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (captureRef.current) {
        captureRef.current.stop();
      }
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Browser Audio Test
          </h1>

        {/* Browser Support Check */}
        {!isSupported && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Not Supported:</strong> Your browser does not support the
            required audio APIs (getUserMedia, MediaRecorder, AudioContext).
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Device Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Audio Input Device</h2>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            disabled={isRecording}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            {devices.length === 0 ? (
              <option value="">No devices found</option>
            ) : (
              devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))
            )}
          </select>
          <button
            onClick={loadDevices}
            disabled={isRecording}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            Refresh devices
          </button>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Recording Controls</h2>
          <div className="flex gap-4">
            {!isRecording ? (
              <button
                onClick={handleStart}
                disabled={!isSupported}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
              >
                Start Recording
              </button>
            ) : (
              <>
                {!isPaused ? (
                  <button
                    onClick={handlePause}
                    className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={handleStop}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* Audio Level */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Audio Level</h2>
          <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-100"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Level: {audioLevel.toFixed(1)}%
            {isRecording && !isPaused && (
              <span className="ml-2 text-green-600">Recording</span>
            )}
            {isPaused && (
              <span className="ml-2 text-yellow-600">Paused</span>
            )}
          </p>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Recording Stats</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Chunks Captured</p>
              <p className="text-2xl font-bold text-gray-900">{chunkCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Data</p>
              <p className="text-2xl font-bold text-gray-900">
                {(totalBytes / 1024).toFixed(1)} KB
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">WebSocket Status</p>
              <p className="text-2xl font-bold text-gray-900">
                <span
                  className={
                    wsStatus === 'connected'
                      ? 'text-green-600'
                      : wsStatus === 'connecting'
                      ? 'text-yellow-600'
                      : wsStatus === 'error'
                      ? 'text-red-600'
                      : 'text-gray-400'
                  }
                >
                  {wsStatus}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Session ID</p>
              <p className="text-xs font-mono text-gray-700">
                {sessionId ? sessionId.slice(0, 8) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Transcripts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">🎤 Live Transcript</h2>
          <div className="min-h-32 max-h-64 overflow-y-auto bg-blue-50 rounded p-4 border border-blue-200">
            {transcripts.length === 0 ? (
              <p className="text-gray-500 italic">Speak into your microphone to see transcripts appear here...</p>
            ) : (
              <div className="space-y-2">
                {transcripts.map((text, i) => (
                  <div key={i} className="bg-white rounded p-3 border border-blue-300 shadow-sm">
                    <p className="text-gray-800">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Event Log</h2>
          <div
            ref={logContainerRef}
            className="h-64 overflow-y-auto bg-gray-900 rounded p-4 font-mono text-sm text-green-400"
          >
            {logs.length === 0 ? (
              <p className="text-gray-500">No events yet...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1 whitespace-pre-wrap break-words">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

       
        </div>
      </div>
    </div>
  );
}
