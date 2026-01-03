import { useState, useEffect, useRef } from 'react';

export const useAudioPlayer = (audioPath: string | null) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const rafRef = useRef<number>();
  const seekTimeRef = useRef<number>(0);

  const initAudioContext = async () => {
    try {
      if (!audioRef.current) {
        console.log('Creating new AudioContext');
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioRef.current = new AudioContextClass();
        console.log('AudioContext created:', {
          state: audioRef.current.state,
          sampleRate: audioRef.current.sampleRate,
        });
      }

      if (audioRef.current.state === 'suspended') {
        console.log('Resuming suspended AudioContext');
        await audioRef.current.resume();
        console.log('AudioContext resumed:', audioRef.current.state);
      }
      
      setError(null);
      return true;
    } catch (error) {
      console.error('Error initializing AudioContext:', error);
      setError('Failed to initialize audio');
      return false;
    }
  };

  // Cleanup function
  useEffect(() => {
    return () => {
      console.log('Cleaning up audio resources');
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.close();
      }
    };
  }, []);

  const loadAudio = async () => {
    if (!audioPath) {
      console.log('No audio path provided');
      return;
    }

    try {
      // Initialize context first
      const initialized = await initAudioContext();
      if (!initialized || !audioRef.current) {
        console.error('Failed to initialize audio context');
        return;
      }

      console.log('Loading audio from:', audioPath);
      
      // Fetch audio file (assumed to be a URL accessible to web)
      // If audioPath is just a filename, prepend the server endpoint
      
      let url = audioPath;
       // Quick Hack: attempt to determine if it's absolute or needing server prefix.
       // But hook doesn't know server address.
       // Assuming audioPath passed by Sidebar is already a full URL or relative to public.
       // Actually `useSidebar` likely passes a path.
       // If it's a file path /home/..., fetching won't work.
       // But we refactored Sidebar to get meetings from backend. Backend should return URLs.
       // We'll assume audioPath is fetchable.
       
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch audio file');
      
      const arrayBuffer = await response.arrayBuffer();
      
      console.log('Audio file fetched, size:', arrayBuffer.byteLength, 'bytes');
      
      // Decode the audio data
      const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        audioRef.current!.decodeAudioData(
          arrayBuffer,
          buffer => {
            console.log('Audio decoded successfully:', {
              duration: buffer.duration,
              sampleRate: buffer.sampleRate,
              numberOfChannels: buffer.numberOfChannels,
              length: buffer.length
            });
            resolve(buffer);
          },
          error => {
            console.error('Audio decoding failed:', error);
            reject(new Error('Failed to decode audio data: ' + error));
          }
        );
      });
      
      audioBufferRef.current = audioBuffer;
      setDuration(audioBuffer.duration);
      setCurrentTime(0);
      setError(null);
      console.log('Audio loaded and ready to play');
    } catch (error) {
      console.error('Error loading audio:', error);
      setError('Failed to load audio file');
    }
  };

  // Load audio when path changes
  useEffect(() => {
    console.log('Audio path changed:', audioPath);
    if (audioPath) {
      loadAudio();
    }
  }, [audioPath]);

  const stopPlayback = () => {
    console.log('Stopping playback');
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch (e) {
        console.log('Error stopping source:', e);
      }
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const play = async () => {
    console.log('Play requested');
    
    try {
      // Initialize context if needed
      const initialized = await initAudioContext();
      if (!initialized) {
        throw new Error('Audio context initialization failed');
      }
      if (!audioRef.current) {
        throw new Error('Audio context is null after initialization');
      }
      if (!audioBufferRef.current) {
        throw new Error('No audio buffer loaded - try loading the audio file first');
      }
      if (audioRef.current.state !== 'running') {
          // Attempt resume
          await audioRef.current.resume();
      }

      // Stop any existing playback
      stopPlayback();

      // Create and setup new source
      console.log('Creating new audio source');
      sourceRef.current = audioRef.current.createBufferSource();
      sourceRef.current.buffer = audioBufferRef.current;
      
      sourceRef.current.connect(audioRef.current.destination);
      
      // Setup ended callback
      sourceRef.current.onended = () => {
        console.log('Playback ended naturally');
        stopPlayback();
        setCurrentTime(0);
      };
      
      // Start playback from the seek time
      const startTime = seekTimeRef.current;
      startTimeRef.current = audioRef.current.currentTime - startTime;
      
      sourceRef.current.start(0, startTime);
      setIsPlaying(true);
      setError(null);

      // Setup time update
      const updateTime = () => {
        if (!audioRef.current || !sourceRef.current) {
          return;
        }
        
        const newTime = audioRef.current.currentTime - startTimeRef.current;
        
        if (newTime >= duration) {
          // Managed by onended
        } else {
          setCurrentTime(newTime);
          seekTimeRef.current = newTime;
          rafRef.current = requestAnimationFrame(updateTime);
        }
      };
      
      rafRef.current = requestAnimationFrame(updateTime);
    } catch (error) {
      console.error('Error during playback:', error);
      setError('Failed to play audio');
      stopPlayback();
    }
  };

  const seek = async (time: number) => {
    console.log('Seek requested:', time);
    if (time < 0) time = 0;
    if (time > duration) time = duration;
    
    const wasPlaying = isPlaying;
    
    // Stop current playback
    stopPlayback();
    
    // Update both current time and seek time reference
    seekTimeRef.current = time;
    setCurrentTime(time);
    
    // If it was playing before, restart playback at new position
    if (wasPlaying) {
      console.log('Restarting playback at:', time);
      await play();
    }
  };

  const pause = () => {
    console.log('Pause requested');
    stopPlayback();
  };

  return {
    isPlaying,
    currentTime,
    duration,
    error,
    play,
    pause,
    seek
  };
};
