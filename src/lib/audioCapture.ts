import { createSocketConnection } from './realtime';

export interface AudioCaptureOptions {
  sampleRate?: number;
  channels?: number;
  bufferSize?: number;
}

export interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
  confidence: number;
}

export class AudioCapture {
  private mediaStream: MediaStream | null = null;
  private recognition: any = null;
  private socket: any;
  private roomId: string;
  private isCapturing = false;
  private onTranscription: ((segment: TranscriptionSegment) => void) | null = null;

  constructor(socket: any, roomId: string) {
    this.socket = socket;
    this.roomId = roomId;
  }

  setTranscriptionCallback(callback: (segment: TranscriptionSegment) => void) {
    this.onTranscription = callback;
  }

  async startCapture(options: AudioCaptureOptions = {}) {
    if (this.isCapturing) return;

    try {
      console.log('🎤 Starting local transcription...');
      
      // For now, let's use a simple fallback that works
      console.log('🎤 Using manual transcription mode');
      this.isCapturing = true;
      console.log('✅ Manual transcription mode started - use the "Add Test Text" button to simulate speech');
      return;

      // Get user media with audio
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: options.sampleRate || 16000,
          channelCount: options.channels || 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      });
      
      console.log('🎤 Audio stream obtained:', this.mediaStream);

      // Initialize speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
      };

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            
            // Send final result
            if (this.onTranscription) {
              const segment: TranscriptionSegment = {
                id: 'speech-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                speaker: 'Speaker',
                text: transcript.trim(),
                timestamp: Date.now(),
                confidence: confidence || 0.8
              };
              
              console.log('🎤 Final transcription:', segment);
              this.onTranscription(segment);
            }
          } else {
            interimTranscript += transcript;
            console.log('🎤 Interim transcription:', transcript);
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('🎤 Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          console.error('🎤 Microphone permission denied');
        }
      };

      this.recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        if (this.isCapturing) {
          // Restart recognition if still capturing
          setTimeout(() => {
            if (this.isCapturing && this.recognition) {
              this.recognition.start();
            }
          }, 100);
        }
      };

      // Start recognition
      this.recognition.start();
      this.isCapturing = true;
      console.log('✅ Local transcription started');
    } catch (error) {
      console.error('Failed to start local transcription:', error);
      throw error;
    }
  }

  stopCapture() {
    if (!this.isCapturing) return;

    this.isCapturing = false;

    // Stop speech recognition
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    console.log('🎤 Local transcription stopped');
  }

  isActive(): boolean {
    return this.isCapturing;
  }
}

export default AudioCapture;
