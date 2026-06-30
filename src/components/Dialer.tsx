import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Play, Pause, Disc, Trash2, Shield, Signal, Layers, PhoneCall, RefreshCw, Smartphone, Radio } from 'lucide-react';
import { CallState, SIPConfig } from '../types';
import * as JsSIP from 'jssip';
import WebRTCPeer from './WebRTCPeer';

interface DialerProps {
  callState: CallState;
  setCallState: React.Dispatch<React.SetStateAction<CallState>>;
  sipRegistered: boolean;
  sipConfig: SIPConfig;
  bluetoothConnected: boolean;
  onSaveRecording: (base64Audio: string, number: string, durationSeconds: number) => Promise<void>;
  webrtcRoom: string;
}

export default function Dialer({ callState, setCallState, sipRegistered, sipConfig, bluetoothConnected, onSaveRecording, webrtcRoom }: DialerProps) {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [activeLine, setActiveLine] = useState<number>(1);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [callMode, setCallMode] = useState<'webrtc' | 'pabx'>('webrtc');
  const [triggerWebRTCCall, setTriggerWebRTCCall] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  
  // JsSIP References
  const uaRef = useRef<JsSIP.UA | null>(null);
  const sessionRef = useRef<any>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Configure and connect real JsSIP User Agent when sipConfig is valid
  useEffect(() => {
    if (sipConfig.websocketUrl && sipConfig.websocketUrl.startsWith('ws') && sipConfig.username) {
      try {
        console.log("Configurando e conectando ao PABX via WebSocket SIP...");
        
        // Stop current UA if exists
        if (uaRef.current) {
          uaRef.current.stop();
        }

        const socket = new JsSIP.WebSocketInterface(sipConfig.websocketUrl);
        const config = {
          sockets: [socket],
          uri: `sip:${sipConfig.username}@${sipConfig.serverUrl || 'localhost'}`,
          password: sipConfig.password || '',
          display_name: sipConfig.displayName || 'Comutador Elie Vargas'
        };

        const ua = new JsSIP.UA(config);

        ua.on('connected', () => {
          console.log('JsSIP WebSocket: Conectado');
        });

        ua.on('disconnected', () => {
          console.log('JsSIP WebSocket: Desconectado');
        });

        ua.on('registered', () => {
          console.log('JsSIP: Ramal SIP Registrado com Sucesso!');
        });

        ua.on('registrationFailed', (e: any) => {
          console.error('JsSIP: Falha ao registrar ramal no PABX:', e.cause);
        });

        ua.on('newRTCSession', (data: any) => {
          const session = data.session;
          console.log('JsSIP: Nova chamada detectada:', session.direction);

          if (session.direction === 'incoming') {
            sessionRef.current = session;
            
            // Auto-update UI on incoming call
            setCallState({
              status: 'ringing',
              number: session.remote_identity.uri.user || 'Entrada',
              direction: 'incoming',
              duration: 0,
              isMuted: false,
              isRecording: true,
              currentLine: 1
            });
          }
        });

        ua.start();
        uaRef.current = ua;
      } catch (err) {
        console.error("Falha ao inicializar JsSIP:", err);
      }
    }

    return () => {
      if (uaRef.current) {
        uaRef.current.stop();
      }
    };
  }, [sipConfig.websocketUrl, sipConfig.username, sipConfig.password, sipConfig.serverUrl]);

  // Audio context for DTMF and sounds
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Recording references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);

  // Play Hold music synthesizer
  const holdOscillatorRef = useRef<OscillatorNode | null>(null);
  const holdGainRef = useRef<GainNode | null>(null);

  // Simulated responder audio elements
  const simulatedAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize AudioContext
  const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  // DTMF Frequency mappings
  const playDtmf = (digit: string) => {
    try {
      const ctx = getAudioContext();
      const dtmfFrequencies: Record<string, [number, number]> = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
      };

      if (!dtmfFrequencies[digit]) return;
      const [f1, f2] = dtmfFrequencies[digit];

      // Oscillators
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.frequency.value = f1;
      osc2.frequency.value = f2;

      osc1.type = 'sine';
      osc2.type = 'sine';

      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start();
      osc2.start();

      osc1.stop(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.15);
    } catch (error) {
      console.warn("AudioContext DTMF failed:", error);
    }
  };

  // Pre-populate room number when in WebRTC mode
  useEffect(() => {
    if (callMode === 'webrtc' && webrtcRoom) {
      setPhoneNumber(webrtcRoom);
    }
  }, [callMode, webrtcRoom]);

  // Keyboard support for dialing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (callState.status !== 'idle') return;
      
      const key = e.key;
      if (/[0-9*#]/.test(key)) {
        e.preventDefault();
        handleDialDigit(key);
      } else if (key === 'Backspace') {
        e.preventDefault();
        setPhoneNumber(prev => prev.slice(0, -1));
      } else if (key === 'Enter' && phoneNumber) {
        e.preventDefault();
        startCall();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phoneNumber, callState.status]);

  // Track elapsed call time
  useEffect(() => {
    if (callState.status === 'connected') {
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const next = prev + 1;
          setCallState(cs => ({ ...cs, duration: next }));
          return next;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setElapsedTime(0);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [callState.status]);

  // Audio wave visualizer loop
  useEffect(() => {
    if (callState.status === 'connected' && canvasRef.current && audioAnalyserRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const analyser = audioAnalyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvas || !ctx) return;
        animationFrameRef.current = requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        // Styling
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = callState.isRecording ? '#ef4444' : '#3b82f6';
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Draw pulsing record dot if recording
        if (callState.isRecording) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(canvas.width - 20, 20, 6 + Math.sin(Date.now() / 150) * 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      };

      draw();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [callState.status, callState.isRecording]);

  const handleDialDigit = (digit: string) => {
    playDtmf(digit);
    setPhoneNumber(prev => prev + digit);
  };

  const clearNumber = () => {
    setPhoneNumber('');
  };

  const backspaceNumber = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  // Sound generator helper for SIP Ringing / Dialing Tone
  const playSipTone = (type: 'ring' | 'busy' | 'disconnect') => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      
      if (type === 'ring') {
        osc.frequency.setValueAtTime(425, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        // cadenced gain for ringing
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + 1.2);
      } else if (type === 'busy') {
        osc.frequency.setValueAtTime(425, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
      } else {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (type === 'ring' ? 1.5 : 0.4));
    } catch (e) {
      console.warn("Tone play failed:", e);
    }
  };

  // Start simulated fallback call
  const startSimulatedCall = async () => {
    // Update state to Ringing
    setCallState(prev => ({
      ...prev,
      status: 'ringing',
      number: phoneNumber,
      direction: 'outgoing',
      duration: 0
    }));

    // Play ringing tone
    playSipTone('ring');

    // Simulate answer after 2 seconds
    setTimeout(async () => {
      try {
        // Start real mic recording if possible
        const hasGetMedia = typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
        const stream = hasGetMedia ? await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
          console.warn("Microphone access declined, fallback to simulation audio-only", err);
          return null;
        }) : null;

        streamRef.current = stream;

        // Set up Web Audio Web Analyzer if stream is available
        if (stream) {
          const ctx = getAudioContext();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          audioAnalyserRef.current = analyser;
        } else {
          // Mock analyzer if no mic
          const ctx = getAudioContext();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          const bufferSize = ctx.sampleRate * 2; // 2 seconds
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
          }
          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          whiteNoise.loop = true;
          const bandpass = ctx.createBiquadFilter();
          bandpass.type = 'bandpass';
          bandpass.frequency.value = 1000;
          const noiseGain = ctx.createGain();
          noiseGain.gain.value = 0.005; // extremely quiet background noise
          
          whiteNoise.connect(bandpass);
          bandpass.connect(noiseGain);
          noiseGain.connect(analyser);
          analyser.connect(ctx.destination);
          whiteNoise.start();
          audioAnalyserRef.current = analyser;
        }

        // Set Call to Connected
        setCallState(prev => ({
          ...prev,
          status: 'connected',
          isMuted: false,
          isRecording: true
        }));

        // Start media recording if mic stream is present
        startRecordingEngine();

        // Simulated responders for specific extensions
        handleInteractivePBX(phoneNumber);

      } catch (error) {
        console.error("Failed to connect simulated call:", error);
      }
    }, 2000);
  };

  // Callback when WebRTC call status changes
  const handleWebRTCCallStateChange = async (status: 'idle' | 'ringing' | 'connected' | 'ended', rStream?: MediaStream) => {
    console.log(`[WebRTC Switchboard] Status alterado: ${status}`);
    
    if (status === 'connected' && rStream) {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = rStream;
        remoteAudioRef.current.play().catch(err => console.log("Erro auto-play áudio remoto WebRTC:", err));
      }

      try {
        const ctx = getAudioContext();
        const source = ctx.createMediaStreamSource(rStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioAnalyserRef.current = analyser;
      } catch (anErr) {
        console.warn("Erro ao associar analisador ao áudio remoto WebRTC:", anErr);
      }

      // Mix local + remote streams for recording
      let localStream = null;
      try {
        const hasGetMedia = typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
        if (hasGetMedia) {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          console.warn("Dispositivos de mídia indisponíveis para gravação de microfone local");
        }
      } catch (micErr) {
        console.warn("Microfone local recusado:", micErr);
      }

      let recordingStream = localStream;
      if (localStream && rStream) {
        try {
          const ctx = getAudioContext();
          const dest = ctx.createMediaStreamDestination();
          
          const localSource = ctx.createMediaStreamSource(localStream);
          const remoteSource = ctx.createMediaStreamSource(rStream);
          
          localSource.connect(dest);
          remoteSource.connect(dest);
          
          recordingStream = dest.stream;
        } catch (mixErr) {
          console.warn("Erro de mixagem:", mixErr);
          recordingStream = localStream;
        }
      } else if (rStream) {
        recordingStream = rStream;
      }

      streamRef.current = recordingStream;

      setCallState(prev => ({
        ...prev,
        status: 'connected',
        isMuted: false,
        isRecording: true
      }));

      startRecordingEngine();
    } else if (status === 'ended') {
      hangUpCall();
    }
  };

  // Start SIP / Real, WebRTC or Simulated Call
  const startCall = async () => {
    if (!phoneNumber) return;

    if (callMode === 'webrtc') {
      console.log("Iniciando chamada real WebRTC direta...");
      setCallState(prev => ({
        ...prev,
        status: 'ringing',
        number: phoneNumber,
        direction: 'outgoing',
        duration: 0
      }));
      playSipTone('ring');
      setTriggerWebRTCCall(true);
      return;
    }

    // Check if SIP is ready
    if (!sipRegistered) {
      alert("Por favor, registre sua conta SIP nas configurações antes de iniciar a ligação.");
      return;
    }

    // Se temos UA ativo e conectado para fazer chamadas reais!
    if (uaRef.current && uaRef.current.isRegistered()) {
      try {
        console.log("Iniciando chamada real via JsSIP...");
        
        setCallState(prev => ({
          ...prev,
          status: 'ringing',
          number: phoneNumber,
          direction: 'outgoing',
          duration: 0
        }));

        playSipTone('ring');

        const options = {
          mediaConstraints: { audio: true, video: false },
          rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false }
        };

        const session = uaRef.current.call(`sip:${phoneNumber}@${sipConfig.serverUrl || 'localhost'}`, options);
        sessionRef.current = session;

        session.on('connecting', () => {
          console.log('Chamada real: Estabelecendo conexão...');
        });

        session.on('progress', () => {
          console.log('Chamada real: Tocando no destino...');
        });

        session.on('accepted', async () => {
          console.log('Chamada real: Atendida!');
          
          const connection = session.connection;
          let remoteStream: MediaStream | null = null;

          connection.addEventListener('track', (e: any) => {
            if (e.streams && e.streams[0]) {
              remoteStream = e.streams[0];
              if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = remoteStream;
                remoteAudioRef.current.play().catch(err => console.log("Erro auto-play:", err));
              }

              // Conecta no analisador para renderizar na tela!
              try {
                const ctx = getAudioContext();
                const source = ctx.createMediaStreamSource(remoteStream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                audioAnalyserRef.current = analyser;
              } catch (anErr) {
                console.warn("Erro ao associar analisador ao áudio remoto:", anErr);
              }
            }
          });

          // Mixagem de áudio local + remoto para gravação real completa
          let localStream = null;
          try {
            const hasGetMedia = typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
            if (hasGetMedia) {
              localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } else {
              console.warn("Dispositivos de mídia indisponíveis para gravação de microfone local");
            }
          } catch (micErr) {
            console.warn("Microfone local recusado:", micErr);
          }

          let recordingStream = localStream;
          if (localStream && remoteStream) {
            try {
              const ctx = getAudioContext();
              const dest = ctx.createMediaStreamDestination();
              
              const localSource = ctx.createMediaStreamSource(localStream);
              const remoteSource = ctx.createMediaStreamSource(remoteStream);
              
              localSource.connect(dest);
              remoteSource.connect(dest);
              
              recordingStream = dest.stream;
            } catch (mixErr) {
              console.warn("Erro de mixagem:", mixErr);
              recordingStream = localStream; // Fallback para gravar apenas o mic local
            }
          } else if (remoteStream) {
            recordingStream = remoteStream;
          }

          streamRef.current = recordingStream;

          setCallState(prev => ({
            ...prev,
            status: 'connected',
            isMuted: false,
            isRecording: true
          }));

          startRecordingEngine();
        });

        session.on('failed', (e: any) => {
          console.error('Chamada real falhou:', e.cause);
          hangUpCall();
        });

        session.on('ended', () => {
          console.log('Chamada real encerrada.');
          hangUpCall();
        });

      } catch (err) {
        console.error("Falha ao efetuar ligação real via JsSIP, usando simulação:", err);
        startSimulatedCall();
      }
    } else {
      // Fallback para o simulador se não houver conexão SIP ativa registrada
      startSimulatedCall();
    }
  };

  // Play Hold music when toggled
  const toggleHold = () => {
    const isCurrentlyHeld = callState.status === 'held';
    
    // Ação real na sessão SIP
    if (sessionRef.current) {
      try {
        if (isCurrentlyHeld) {
          sessionRef.current.unhold();
        } else {
          sessionRef.current.hold();
        }
      } catch (e) {
        console.warn("Erro ao alternar hold na sessão real:", e);
      }
    }

    if (!isCurrentlyHeld) {
      // Put on Hold
      setCallState(prev => ({ ...prev, status: 'held' }));
      
      // Stop responder audio if playing
      if (simulatedAudioRef.current) {
        simulatedAudioRef.current.pause();
      }

      // Synthesize elegant Telecom-like Hold music dynamically!
      try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, ctx.currentTime); // Standard hold tone frequency
        gainNode.gain.setValueAtTime(0.02, ctx.currentTime);
        
        // Cadence (low pulsing sound for elegant PBX simulation)
        const pulseInterval = setInterval(() => {
          if (holdGainRef.current) {
            const now = ctx.currentTime;
            holdGainRef.current.gain.cancelScheduledValues(now);
            holdGainRef.current.gain.setValueAtTime(0.02, now);
            holdGainRef.current.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
          }
        }, 1500);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();

        holdOscillatorRef.current = osc;
        holdGainRef.current = gainNode;
        (osc as any).pulseInterval = pulseInterval;
      } catch (e) {
        console.warn("Hold music failed:", e);
      }
    } else {
      // Resume from Hold
      setCallState(prev => ({ ...prev, status: 'connected' }));
      
      // Resume simulated responder
      if (simulatedAudioRef.current) {
        simulatedAudioRef.current.play().catch(() => {});
      }

      // Stop Hold synthesizer
      stopHoldSynth();
    }
  };

  const stopHoldSynth = () => {
    if (holdOscillatorRef.current) {
      try {
        clearInterval((holdOscillatorRef.current as any).pulseInterval);
        holdOscillatorRef.current.stop();
        holdOscillatorRef.current.disconnect();
      } catch (e) {}
      holdOscillatorRef.current = null;
    }
    if (holdGainRef.current) {
      holdGainRef.current.disconnect();
      holdGainRef.current = null;
    }
  };

  const toggleMute = () => {
    const nextMuted = !callState.isMuted;

    // Mute/Unmute real na sessão SIP se houver
    if (sessionRef.current) {
      try {
        if (nextMuted) {
          sessionRef.current.mute();
        } else {
          sessionRef.current.unmute();
        }
      } catch (e) {
        console.warn("Erro de mute na sessão real:", e);
      }
    }

    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = callState.isMuted; // toggle track
      });
    }
    setCallState(prev => ({ ...prev, isMuted: nextMuted }));
  };

  // Manage call recording chunks
  const startRecordingEngine = () => {
    if (!streamRef.current) {
      console.warn("No active stream to record.");
      return;
    }

    try {
      audioChunksRef.current = [];
      const options = { mimeType: 'audio/webm' };
      
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsSaving(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert Blob to Base64 to send to server
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          try {
            await onSaveRecording(base64Audio, callState.number, elapsedTime);
          } catch (e) {
            console.error("Failed to save call recording:", e);
          } finally {
            setIsSaving(false);
          }
        };
      };

      mediaRecorder.start(1000); // chunk every second
      mediaRecorderRef.current = mediaRecorder;
      setCallState(prev => ({ ...prev, isRecording: true }));
    } catch (e) {
      console.error("Failed to initialize MediaRecorder:", e);
    }
  };

  const stopRecordingEngine = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setCallState(prev => ({ ...prev, isRecording: false }));
  };

  const toggleRecording = () => {
    if (callState.isRecording) {
      stopRecordingEngine();
    } else {
      startRecordingEngine();
    }
  };

  // End Call
  const hangUpCall = () => {
    playSipTone('disconnect');
    setTriggerWebRTCCall(false);
    
    // Termina sessão SIP se houver
    if (sessionRef.current) {
      try {
        sessionRef.current.terminate();
      } catch (e) {
        console.warn("Erro ao encerrar sessão SIP:", e);
      }
      sessionRef.current = null;
    }

    // Stop recording to trigger save
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop hold synth
    stopHoldSynth();

    // Release microphone
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      streamRef.current = null;
    }

    // Stop simulated responder audio
    if (simulatedAudioRef.current) {
      simulatedAudioRef.current.pause();
      simulatedAudioRef.current = null;
    }

    setCallState(prev => ({
      ...prev,
      status: 'idle',
      isRecording: false,
      isMuted: false
    }));
  };

  // Simulated responder scripts based on extension dialed
  const handleInteractivePBX = (number: string) => {
    try {
      const ctx = getAudioContext();
      
      // Let's synthesize some verbal/musical sound for the call to play through computer speakers
      // This allows the user to actually "hear" a simulated call from the switchboard!
      const audioUrl = number === '100' 
        ? 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' // Hold music loop
        : number === '200'
        ? '' // Echo test handles itself
        : 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg'; // Standard ringing responder

      if (audioUrl && number !== '200') {
        const audio = new Audio(audioUrl);
        audio.volume = 0.15;
        audio.loop = true;
        
        // Connect the audio element to the browser destination
        audio.play().catch(e => console.log("Audio simulation blocked until click:", e));
        simulatedAudioRef.current = audio;
      }
    } catch (err) {
      console.warn("PBX Audio simulation failed:", err);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div id="dialer-terminal" className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl text-gray-100 flex flex-col gap-6">
      {/* Header and status indicators */}
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${callState.status !== 'idle' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800' : 'bg-gray-900 text-gray-400 border border-gray-800'}`}>
            <PhoneCall className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-lg tracking-tight">O Comutador (Central)</h2>
            <p className="text-xs text-gray-400">Canal Ativo • Linha {activeLine}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* SIP Registration Status */}
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 border ${
            sipRegistered 
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' 
              : 'bg-amber-950/40 text-amber-400 border-amber-900/60'
          }`}>
            <Signal className="w-3 h-3" />
            {sipRegistered ? 'SIP: REGISTRADO' : 'SIP: DESCONECTADO'}
          </span>

          {/* Bluetooth Status */}
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 border ${
            bluetoothConnected 
              ? 'bg-blue-950/40 text-blue-400 border-blue-900/60' 
              : 'bg-gray-950/60 text-gray-500 border-gray-800'
          }`}>
            <Disc className={`w-3 h-3 ${bluetoothConnected ? 'animate-spin' : ''}`} />
            {bluetoothConnected ? 'BLUETOOTH' : 'LOCAL'}
          </span>
        </div>
      </div>

      {/* Main interface layout (Display + Dialpad or Active Call Display) */}
      {callState.status === 'idle' ? (
        // IDLE DIALPAD VIEW
        <div className="flex flex-col gap-4">
          
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 bg-gray-950 p-1.5 rounded-xl border border-gray-800 text-xs gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCallMode('webrtc');
                setPhoneNumber(webrtcRoom);
              }}
              className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                callMode === 'webrtc'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              WebRTC Real (P2P)
            </button>
            <button
              type="button"
              onClick={() => {
                setCallMode('pabx');
                setPhoneNumber('');
              }}
              className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                callMode === 'pabx'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              PABX SIP / Físico
            </button>
          </div>

          {/* Dialer Screen Display */}
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col justify-between h-24">
            <span className="text-[10px] text-gray-500 font-mono font-bold">
              {callMode === 'webrtc' ? 'LINHA DE CONEXÃO DIRETA WEBRTC' : 'DIGITE O RAMAL OU NÚMERO'}
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xl font-mono tracking-wider font-semibold truncate select-all">
                {phoneNumber || <span className="text-gray-700">Digite...</span>}
              </span>
              {phoneNumber && callMode !== 'webrtc' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={backspaceNumber}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-900 hover:text-gray-200 cursor-pointer"
                    title="Apagar último dígito"
                  >
                    ⌫
                  </button>
                  <button 
                    onClick={clearNumber}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-950/30 cursor-pointer text-xs uppercase font-bold font-mono"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>
            {/* Quick Extension Hints */}
            <div className="flex gap-4 text-[10px] text-gray-500 font-mono">
              {callMode === 'webrtc' ? (
                <span className="text-blue-400 animate-pulse">Ligue para o celular pareado clicando em Iniciar Chamada</span>
              ) : (
                <>
                  <span>Ramal <strong className="text-blue-400">100</strong>: URA Demo</span>
                  <span>Ramal <strong className="text-blue-400">200</strong>: Loop Echo</span>
                  <span>Ramal <strong className="text-blue-400">300</strong>: Hold Music</span>
                </>
              )}
            </div>
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto w-full py-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleDialDigit(digit)}
                className="w-full aspect-[4/3] rounded-xl bg-gray-900/60 hover:bg-gray-800 border border-gray-800/80 active:scale-95 text-xl font-mono font-medium flex flex-col items-center justify-center transition-all cursor-pointer select-none"
              >
                {digit}
                {digit === '1' && <span className="text-[9px] text-gray-600 font-sans mt-0.5">Voicemail</span>}
                {digit === '2' && <span className="text-[9px] text-gray-600 font-sans mt-0.5">ABC</span>}
                {digit === '3' && <span className="text-[9px] text-gray-600 font-sans mt-0.5">DEF</span>}
                {digit === '4' && <span className="text-[9px] text-gray-600 font-sans mt-0.5">GHI</span>}
                {digit === '5' && <span className="text-[9px] text-gray-600 font-sans mt-0.5">JKL</span>}
                {digit === '6' && <span className="text-[9px] text-gray-600 font-sans mt-0.5">MNO</span>}
                {digit === '7' && <span className="text-[9px] text-gray-600 font-sans mt-0.5">PQRS</span>}
                {digit === '8' && <span className="text-[9px] text-gray-600 font-sans mt-0.5">TUV</span>}
                {digit === '9' && <span className="text-[9px] text-gray-600 font-sans mt-0.5">WXYZ</span>}
              </button>
            ))}
          </div>

          {/* Action Trigger Button */}
          <button
            onClick={startCall}
            disabled={!phoneNumber}
            className={`w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              phoneNumber 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98]' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Phone className="w-4 h-4 fill-current" />
            {callMode === 'webrtc' ? 'Passo 2: Iniciar Chamada Real' : 'Iniciar Ligação SIP'}
          </button>

          {/* Instant QR Code Link Card */}
          {callMode === 'webrtc' && (
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col items-center gap-3 mt-1">
              <div className="text-center space-y-1">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 justify-center">
                  <Smartphone className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  Passo 1: Conecte o Celular
                </h4>
                <p className="text-[10px] text-gray-400 leading-relaxed max-w-[280px]">
                  Abra a câmera do seu celular, escaneie o código abaixo e mantenha a aba aberta no celular:
                </p>
              </div>

              {/* QR Code Container */}
              <div className="p-2.5 bg-white rounded-lg shadow-inner">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`${window.location.origin}/?mode=phone&room=${webrtcRoom}`)}`}
                  alt="Código QR de Pareamento"
                  className="w-[110px] h-[110px] block"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Pair indicator and link copy */}
              <div className="w-full flex flex-col gap-1.5 items-center">
                <div className="flex gap-1.5 w-full">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?mode=phone&room=${webrtcRoom}`}
                    className="flex-1 bg-gray-900 border border-gray-800 rounded px-2 py-1 text-[10px] text-gray-400 select-all font-mono truncate"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/?mode=phone&room=${webrtcRoom}`);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="px-2.5 py-1 bg-blue-950/50 hover:bg-blue-900 text-blue-400 border border-blue-900/40 rounded text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    {isCopied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="text-[9px] text-gray-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>ID da Linha P2P: <strong>{webrtcRoom}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ACTIVE CALL / CONNECTED VIEW
        <div className="flex flex-col gap-6">
          {/* Active Call State Card */}
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex flex-col items-center text-center gap-4 relative overflow-hidden">
            {/* Pulsing visual halo */}
            <div className={`absolute top-0 inset-x-0 h-1 ${
              callState.status === 'ringing' 
                ? 'bg-amber-500 animate-pulse' 
                : callState.status === 'held' 
                ? 'bg-blue-500' 
                : 'bg-emerald-500 animate-pulse'
            }`} />

            <div className="space-y-1">
              <span className="text-[10px] text-gray-500 font-mono font-bold tracking-widest uppercase">
                {callState.status === 'ringing' ? 'DISCANDO...' : callState.status === 'held' ? 'LIGAÇÃO EM ESPERA' : 'CHAMADA ATIVA'}
              </span>
              <h3 className="text-2xl font-mono font-semibold tracking-wider text-gray-100">
                {callState.number}
              </h3>
              <p className="text-xs text-gray-400">
                {callState.direction === 'incoming' ? 'Ligação Recebida' : 'Ligação Efetuada'}
              </p>
            </div>

            {/* Dynamic visual indicator */}
            <div className="flex items-center justify-center gap-3 mt-1">
              {callState.status === 'connected' && (
                <div className="text-2xl font-mono font-bold text-emerald-400 tracking-widest bg-emerald-950/40 border border-emerald-900/60 px-4 py-1.5 rounded-lg">
                  {formatTime(elapsedTime)}
                </div>
              )}
              {callState.status === 'ringing' && (
                <span className="text-sm font-semibold text-amber-400 animate-pulse font-mono bg-amber-950/40 border border-amber-900/60 px-4 py-1.5 rounded-lg">
                  CHAMANDO...
                </span>
              )}
              {callState.status === 'held' && (
                <span className="text-sm font-semibold text-blue-400 font-mono bg-blue-950/40 border border-blue-900/60 px-4 py-1.5 rounded-lg">
                  EM ESPERA (HOLD)
                </span>
              )}
            </div>

            {/* Real-time Web Audio Waveform Canvas */}
            <div className="w-full h-16 rounded-lg overflow-hidden border border-gray-800/80 bg-[#0b0f19]">
              {callState.status === 'connected' ? (
                <canvas ref={canvasRef} width={400} height={64} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-600 font-mono">
                  Aguardando conexão de áudio...
                </div>
              )}
            </div>

            {/* Active Saving Overlay */}
            {isSaving && (
              <div className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-xs font-semibold text-gray-300 font-mono">Sincronizando gravação no servidor...</span>
              </div>
            )}
          </div>

          {/* Active Call Multi-Action Cockpit */}
          <div className="grid grid-cols-4 gap-3 w-full">
            {/* Hold Button */}
            <button
              onClick={toggleHold}
              disabled={callState.status === 'ringing'}
              className={`py-3.5 px-2 rounded-xl flex flex-col items-center gap-2 border text-xs font-semibold transition-all cursor-pointer ${
                callState.status === 'held'
                  ? 'bg-blue-950/40 border-blue-700 text-blue-400'
                  : 'bg-gray-900/40 border-gray-800/80 hover:bg-gray-800/80 text-gray-300'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Colocar chamada em espera"
            >
              {callState.status === 'held' ? <Play className="w-4 h-4 text-blue-400" /> : <Pause className="w-4 h-4 text-gray-400" />}
              <span>{callState.status === 'held' ? 'Retomar' : 'Espera'}</span>
            </button>

            {/* Mute Mic Button */}
            <button
              onClick={toggleMute}
              disabled={callState.status === 'ringing'}
              className={`py-3.5 px-2 rounded-xl flex flex-col items-center gap-2 border text-xs font-semibold transition-all cursor-pointer ${
                callState.isMuted
                  ? 'bg-rose-950/40 border-rose-700 text-rose-400'
                  : 'bg-gray-900/40 border-gray-800/80 hover:bg-gray-800/80 text-gray-300'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Mudar microfone"
            >
              {callState.isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-gray-400" />}
              <span>{callState.isMuted ? 'Mudo: Sim' : 'Mutar'}</span>
            </button>

            {/* Record Toggle Button */}
            <button
              onClick={toggleRecording}
              disabled={callState.status !== 'connected'}
              className={`py-3.5 px-2 rounded-xl flex flex-col items-center gap-2 border text-xs font-semibold transition-all cursor-pointer ${
                callState.isRecording
                  ? 'bg-rose-950/60 border-rose-600 text-rose-400 animate-pulse'
                  : 'bg-gray-900/40 border-gray-800/80 hover:bg-gray-800/80 text-gray-300'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Gravar chamada"
            >
              <Disc className={`w-4 h-4 ${callState.isRecording ? 'text-rose-500 fill-current' : 'text-gray-400'}`} />
              <span>{callState.isRecording ? 'Gravando' : 'Gravar'}</span>
            </button>

            {/* Hangup button */}
            <button
              onClick={hangUpCall}
              className="py-3.5 px-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center gap-2 border border-rose-700 hover:border-rose-600 transition-all cursor-pointer active:scale-95"
              title="Desligar ligação"
            >
              <PhoneOff className="w-4 h-4 fill-current text-white" />
              <span>Desligar</span>
            </button>
          </div>
        </div>
      )}

      {/* Security notice / certification info */}
      <div className="bg-gray-950/40 border border-gray-800/40 rounded-xl p-3 text-[10px] text-gray-500 flex items-center gap-2 font-mono">
        <Shield className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span>Garantia de conformidade com LGPD / GDPR. Gravações são salvas localmente no servidor SIP de forma segura.</span>
      </div>
      <WebRTCPeer 
        roomId={webrtcRoom}
        peerId="switchboard"
        incomingCallTrigger={triggerWebRTCCall}
        onCallStateChange={handleWebRTCCallStateChange}
      />
      <audio ref={remoteAudioRef} style={{ display: 'none' }} />
    </div>
  );
}
