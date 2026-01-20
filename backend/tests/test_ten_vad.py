import unittest
import numpy as np
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.vad import TenVAD

class TestTenVAD(unittest.TestCase):
    def setUp(self):
        try:
            self.vad = TenVAD(threshold=0.5)
        except ImportError as e:
            self.skipTest(f"TenVAD not available (likely missing libc++): {e}")

    def test_initialization(self):
        self.assertIsInstance(self.vad, TenVAD)
        self.assertEqual(self.vad.sample_rate, 16000)

    def test_is_speech_silence(self):
        # 1 second of silence
        audio = np.zeros(16000, dtype=np.int16)
        is_speech = self.vad.is_speech(audio)
        self.assertFalse(is_speech, "Silence should not be detected as speech")

    def test_is_speech_noise(self):
        # 1 second of low noise
        audio = np.random.randint(-100, 100, 16000, dtype=np.int16)
        is_speech = self.vad.is_speech(audio)
        self.assertFalse(is_speech, "Low noise should not be detected as speech")
    
    def test_input_types(self):
        # Test float32 input conversion
        audio_float = np.zeros(16000, dtype=np.float32)
        is_speech = self.vad.is_speech(audio_float)
        self.assertFalse(is_speech)

    def test_get_speech_segments(self):
        # Construct audio with speech in middle
        # Silence 0.5s, "Speech" 1s, Silence 0.5s
        # Note: We can't easily synthesize "speech" that triggers VAD without real audio 
        # or knowing the model's features. High amplitude noise might trigger it or might not depending on model robustness.
        # So we just test structure here.
        
        audio = np.zeros(32000, dtype=np.int16)
        segments = self.vad.get_speech_segments(audio)
        self.assertEqual(len(segments), 0)

if __name__ == '__main__':
    unittest.main()
