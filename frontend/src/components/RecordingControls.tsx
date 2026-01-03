'use client';

import { useCallback, useState, useEffect } from 'react';
import { Square, Mic, AlertCircle, X } from 'lucide-react';
import { SummaryResponse } from '@/types/summary';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Analytics from '@/lib/analytics';
import { WebAudioCapture } from '@/lib/audio-web/capture';
import { AudioWebSocketClient } from '@/lib/audio-web/websocket-client';

interface RecordingControlsProps {
  isRecording: boolean;
  barHeights: string[];
  onRecordingStop: (callApi?: boolean) => void;
  onRecordingStart: () => void;
  onTranscriptReceived: (summary: SummaryResponse) => void;
  onTranscriptionError?: (message: string) => void;
  onStopInitiated?: () => void;
  isRecordingDisabled: boolean;
  isParentProcessing: boolean;
  selectedDevices?: {
    micDevice: string | null;
    systemDevice: string | null;
  };
  meetingName?: string;
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  barHeights,
  onRecordingStop,
  onRecordingStart,
  onTranscriptReceived,
  onTranscriptionError,
  onStopInitiated,
  isRecordingDisabled,
  isParentProcessing,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [deviceError, setDeviceError] = useState<{ title: string, message: string } | null>(null);

  // Web audio state
  const [audioCapture, setAudioCapture] = useState<WebAudioCapture | null>(null);
  const [ws, setWs] = useState<AudioWebSocketClient | null>(null);

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('✅ [RecordingControlsWeb] Component mounted');
    console.log('📋 [RecordingControlsWeb] Props:', {
      isRecording,
      isRecordingDisabled,
      isParentProcessing
    });
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (isStarting) {
      console.log('⚠️ Already starting, ignoring duplicate click');
      return;
    }

    console.log('🎙️ [RecordingControlsWeb] Starting web audio recording...');
    console.log('🎙️ [RecordingControlsWeb] Button click detected');
    setIsStarting(true);
    setDeviceError(null);

    try {
      // Initialize browser audio capture
      const capture = new WebAudioCapture();
      await capture.initialize();
      console.log('✅ Browser audio capture initialized');

      // Connect to backend WebSocket
      const websocket = new AudioWebSocketClient('ws://localhost:5167/ws/audio');
      await websocket.connect();
      console.log('✅ WebSocket connected');

      // Set up audio data callback to stream chunks to backend
      capture.onData((blob: Blob) => {
        console.log('🎵 Audio chunk received:', blob.size, 'bytes');
        websocket.sendAudio(blob);
      });

      // Handle errors
      capture.onError((error: Error) => {
        console.error('❌ Audio capture error:', error);
        onTranscriptionError?.(error.message);
      });

      // Handle transcripts from backend
      websocket.onTranscript((text: string) => {
        console.log('📝 [RecordingControlsWeb] Transcript received from backend:', text.substring(0, 50) + '...');
        console.log('📝 [RecordingControlsWeb] Full text length:', text.length);

        // Pass transcript to parent component for display
        const transcriptUpdate = {
          text: text,
          timestamp: new Date().toISOString(),
          sequence_id: Date.now(),
          is_partial: false,
        };

        console.log('📝 [RecordingControlsWeb] Calling onTranscriptReceived with:', transcriptUpdate);
        console.log('📝 [RecordingControlsWeb] onTranscriptReceived is defined?', !!onTranscriptReceived);

        if (onTranscriptReceived) {
          onTranscriptReceived(transcriptUpdate as any);
          console.log('✅ [RecordingControlsWeb] onTranscriptReceived called successfully');
        } else {
          console.error('❌ [RecordingControlsWeb] onTranscriptReceived is undefined!');
        }
      });

      // Start recording with 10-second chunks
      capture.startRecording(10000);
      console.log('✅ Recording started with 10s chunks');

      setAudioCapture(capture);
      setWs(websocket);

      // Notify parent component
      onRecordingStart();

      Analytics.trackButtonClick('start_recording_web', 'recording_controls');
    } catch (error) {
      console.error('❌ Failed to start web audio recording:', error);

      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes('denied') || errorMsg.includes('permission')) {
        setDeviceError({
          title: 'Microphone Permission Required',
          message: 'Please grant microphone access in your browser and try again.'
        });
      } else if (errorMsg.includes('NotFoundError') || errorMsg.includes('no microphone')) {
        setDeviceError({
          title: 'Microphone Not Found',
          message: 'No microphone detected. Please connect a microphone and try again.'
        });
      } else if (errorMsg.includes('WebSocket') || errorMsg.includes('connect')) {
        setDeviceError({
          title: 'Connection Failed',
          message: 'Unable to connect to transcription service. Please check that the backend is running.'
        });
      } else {
        setDeviceError({
          title: 'Recording Failed',
          message: `Failed to start recording: ${errorMsg}`
        });
      }

      onTranscriptionError?.(errorMsg);
    } finally {
      setIsStarting(false);
    }
  }, [onRecordingStart, onTranscriptionError, isStarting]);

  const handleStopRecording = useCallback(async () => {
    if (!isRecording || isStarting || isStopping) {
      console.log('⚠️ Cannot stop recording (invalid state)');
      return;
    }

    console.log('🛑 Stopping recording...');

    onStopInitiated?.();
    setIsStopping(true);

    try {
      audioCapture?.stop();
      console.log('✅ Audio capture stopped');

      ws?.disconnect();
      console.log('✅ WebSocket disconnected');

      setIsProcessing(false);
      onRecordingStop(true);

      Analytics.trackButtonClick('stop_recording_web', 'recording_controls');
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      onRecordingStop(false);
    } finally {
      setIsStopping(false);
    }
  }, [isRecording, isStarting, isStopping, audioCapture, ws, onStopInitiated, onRecordingStop]);

  return (
    <TooltipProvider>
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2 bg-white rounded-full shadow-lg px-4 py-2">
          {isProcessing && !isParentProcessing ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
              <span className="text-sm text-gray-600">Processing recording...</span>
            </div>
          ) : (
            <>
              {!isRecording ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        Analytics.trackButtonClick('start_recording', 'recording_controls');
                        handleStartRecording();
                      }}
                      disabled={isStarting || isProcessing || isRecordingDisabled}
                      className={`w-12 h-12 flex items-center justify-center ${isStarting || isProcessing ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'
                        } rounded-full text-white transition-colors relative`}
                    >
                      {isStarting ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <Mic size={20} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start recording</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        Analytics.trackButtonClick('stop_recording', 'recording_controls');
                        handleStopRecording();
                      }}
                      disabled={isStopping}
                      className={`w-10 h-10 flex items-center justify-center ${isStopping ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'
                        } rounded-full text-white transition-colors relative`}
                    >
                      <Square size={16} />
                      {isStopping && (
                        <div className="absolute -top-8 text-gray-600 font-medium text-xs">
                          Stopping...
                        </div>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop recording</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <div className="flex items-center space-x-1 mx-4">
                {barHeights.map((height, index) => (
                  <div
                    key={index}
                    className="w-1 rounded-full transition-all duration-200 bg-red-500"
                    style={{
                      height: isRecording ? height : '4px',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {deviceError && (
          <Alert variant="destructive" className="mt-4 border-red-300 bg-red-50">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <button
              onClick={() => setDeviceError(null)}
              className="absolute right-3 top-3 text-red-600 hover:text-red-800 transition-colors"
              aria-label="Close alert"
            >
              <X className="h-4 w-4" />
            </button>
            <AlertTitle className="text-red-800 font-semibold mb-2">
              {deviceError.title}
            </AlertTitle>
            <AlertDescription className="text-red-700">
              {deviceError.message.split('\n').map((line, i) => (
                <div key={i} className={i > 0 ? 'ml-2' : ''}>
                  {line}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </TooltipProvider>
  );
};
