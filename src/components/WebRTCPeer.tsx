import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, User, RefreshCw, Smartphone, Radio, Activity } from 'lucide-react';

interface WebRTCPeerProps {
  roomId: string;
  peerId: 'switchboard' | 'phone';
  onCallStateChange?: (status: 'idle' | 'ringing' | 'connected' | 'ended', remoteStream?: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onCallEnded?: () => void;
  incomingCallTrigger?: boolean; // Used by switchboard to initiate
  phoneNumberToCall?: string;
}

export default function WebRTCPeer({
  roomId,
  peerId,
  onCallStateChange,
  onRemoteStream,
  onCallEnded,
  incomingCallTrigger,
  phoneNumberToCall
}: WebRTCPeerProps) {
  const [status, setStatus] = useState<'idle' | 'ringing_in' | 'ringing_out' | 'connected'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollIntervalRef = useRef<any>(null);

  // Configuration for ICE Servers (Standard public stun servers)
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Join the Signaling Room on mount
  useEffect(() => {
    const joinRoom = async () => {
      try {
        await fetch('/api/webrtc/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, peerId })
        });
        console.log(`[WebRTC] Registrado no canal: Room=${roomId} Peer=${peerId}`);
        startPolling();
      } catch (err) {
        console.error("Falha ao registrar canal de sinalização:", err);
        setError("Erro ao conectar ao servidor de sinalização.");
      }
    };

    joinRoom();

    return () => {
      stopPolling();
      cleanupCall();
    };
  }, [roomId, peerId]);

  // Handle outgoing call request (if we are the switchboard and trigger changes)
  useEffect(() => {
    if (incomingCallTrigger && peerId === 'switchboard' && status === 'idle') {
      startOutgoingCall();
    }
  }, [incomingCallTrigger]);

  const startPolling = () => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/webrtc/poll/${roomId}/${peerId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.signals && data.signals.length > 0) {
          for (const signal of data.signals) {
            await handleSignal(signal);
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar sinais de sinalização:", err);
      }
    }, 1200); // Poll every 1.2s for responsive connection
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Send a signal via the HTTP Broker
  const sendSignal = async (type: 'offer' | 'answer' | 'candidate', payload: any) => {
    try {
      await fetch('/api/webrtc/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, peerId, type, payload })
      });
    } catch (err) {
      console.error("Erro ao enviar sinal WebRTC:", err);
    }
  };

  // Initialize WebRTC Peer Connection
  const initPeerConnection = async () => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;

    // Grab mic stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } catch (err) {
      console.warn("Erro ao obter microfone. Iniciando sem áudio de saída:", err);
    }

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('candidate', event.candidate);
      }
    };

    // Handle remote track/stream
    pc.ontrack = (event) => {
      console.log("[WebRTC] Fluxo de áudio remoto recebido!");
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        if (onRemoteStream) onRemoteStream(remoteStream);
        if (onCallStateChange) onCallStateChange('connected', remoteStream);
        setStatus('connected');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Estado da conexão: ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanupCall();
      }
    };

    return pc;
  };

  // Initiate an outgoing call from Switchboard console
  const startOutgoingCall = async () => {
    try {
      setStatus('ringing_out');
      if (onCallStateChange) onCallStateChange('ringing');

      const pc = await initPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal('offer', offer);
      console.log("[WebRTC] Chamada iniciada. Oferta enviada.");
    } catch (err) {
      console.error("Falha ao efetuar ligação:", err);
      setError("Não foi possível iniciar a chamada.");
      cleanupCall();
    }
  };

  // Answer call (from mobile phone side)
  const answerCall = async (offer: RTCSessionDescriptionInit) => {
    try {
      setStatus('connected');
      const pc = await initPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal('answer', answer);
      console.log("[WebRTC] Chamada atendida. Resposta enviada.");
      if (onCallStateChange) onCallStateChange('connected');
    } catch (err) {
      console.error("Falha ao atender chamada:", err);
      cleanupCall();
    }
  };

  // Receive and parse WebRTC signal messages from Express
  const handleSignal = async (signal: any) => {
    const { type, payload } = signal;

    try {
      if (type === 'offer') {
        console.log("[WebRTC] Oferta de chamada recebida!");
        if (peerId === 'phone') {
          setStatus('ringing_in');
          if (onCallStateChange) onCallStateChange('ringing');
          // Store offer to answer when the user clicks 'Atender'
          (window as any)._pendingOffer = payload;
        }
      } else if (type === 'answer') {
        console.log("[WebRTC] Resposta de chamada recebida!");
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
          setStatus('connected');
          if (onCallStateChange) onCallStateChange('connected');
        }
      } else if (type === 'candidate') {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload));
        }
      }
    } catch (err) {
      console.warn("Erro ao processar sinal WebRTC:", err);
    }
  };

  const cleanupCall = () => {
    setStatus('idle');
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (onCallEnded) onCallEnded();
    if (onCallStateChange) onCallStateChange('idle');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Custom UI for Phone Mode
  if (peerId === 'phone') {
    return (
      <div className="w-full max-w-sm mx-auto bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl flex flex-col space-y-8 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl" />

        <div className="text-center space-y-2 relative z-10 mt-4">
          <div className="inline-flex p-4 bg-gray-950/80 border border-gray-800 rounded-full shadow-lg text-blue-400">
            <Smartphone className="w-10 h-10 animate-bounce" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Terminal Móvel</h2>
          <p className="text-xs text-gray-400">ID da Linha: <span className="font-mono text-blue-400 font-bold">{roomId}</span></p>
        </div>

        {/* Status Area */}
        <div className="flex-1 flex flex-col items-center justify-center py-6 min-h-[140px] relative z-10">
          {status === 'idle' && (
            <div className="text-center space-y-1.5">
              <span className="w-2.5 h-2.5 inline-block rounded-full bg-emerald-500 animate-pulse mr-2" />
              <p className="text-xs text-gray-300 font-mono">Pronto para receber chamadas...</p>
              <p className="text-[10px] text-gray-500 max-w-[240px]">Deixe esta aba aberta. Quando o comutador ligar do computador, o telefone tocará aqui.</p>
            </div>
          )}

          {status === 'ringing_in' && (
            <div className="text-center space-y-4 animate-pulse">
              <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-2">
                <Radio className="w-4 h-4 animate-ping text-emerald-500" />
                Recebendo Chamada...
              </p>
              <p className="text-xs text-white">Comutador Principal deseja falar com você</p>
            </div>
          )}

          {status === 'connected' && (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className="w-1 bg-blue-500 rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 20 + 8}px`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
              <p className="text-xs font-semibold text-blue-400 font-mono tracking-wider">LIGAÇÃO ATIVA</p>
              <p className="text-[11px] text-gray-400">Áudio bidirecional em tempo real estabelecido</p>
            </div>
          )}
        </div>

        {/* Call Actions */}
        <div className="relative z-10 flex items-center justify-center gap-6 pb-4">
          {status === 'ringing_in' && (
            <>
              <button
                onClick={() => {
                  const offer = (window as any)._pendingOffer;
                  if (offer) answerCall(offer);
                }}
                className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Phone className="w-6 h-6" />
              </button>
              <button
                onClick={cleanupCall}
                className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}

          {status === 'connected' && (
            <>
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                  isMuted 
                    ? 'bg-red-500/20 border-red-500 text-red-500' 
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={cleanupCall}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Switchboard status display inline (no custom render, is managed by Dialer UI)
  return null;
}
