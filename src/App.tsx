import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  Smartphone, 
  Disc, 
  Volume2, 
  Bluetooth, 
  Signal, 
  ShieldCheck, 
  Menu, 
  Activity, 
  Layers, 
  Info, 
  Sparkles,
  HelpCircle,
  PhoneCall,
  User,
  ExternalLink,
  ChevronRight,
  Headphones
} from 'lucide-react';
import { SIPConfig, BluetoothState, CallState, Recording, Contact } from './types';
import BluetoothBridge from './components/BluetoothBridge';
import Dialer from './components/Dialer';
import SIPSettings from './components/SIPSettings';
import RecordingsList from './components/RecordingsList';
import WebRTCPeer from './components/WebRTCPeer';

export default function App() {
  // WebRTC Room management for zero-download real calls
  const [urlParams, setUrlParams] = useState<{ mode?: string; room?: string }>({});
  const [webrtcRoom, setWebrtcRoom] = useState<string>('');
  const [webrtcCallTrigger, setWebrtcCallTrigger] = useState<boolean>(false);
  const [webrtcStatus, setWebrtcStatus] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || undefined;
    const room = params.get('room') || undefined;
    setUrlParams({ mode, room });

    if (room) {
      setWebrtcRoom(room);
    } else {
      // Generate unique 4 digit code for fast pairing
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setWebrtcRoom(code);
    }
  }, []);

  // 1. Core State Managers
  const [sipConfig, setSipConfig] = useState<SIPConfig>({
    serverUrl: 'sip.comutador-local.net',
    port: 5060,
    username: 'ramal_elie_301',
    displayName: 'Elie Vargas (Bluetooth Switchboard)',
    status: 'online', // Starts online demo by default to guide usability!
  });

  const [bluetoothState, setBluetoothState] = useState<BluetoothState>({
    isConnected: true,
    deviceName: 'Celular de Elie Vargas',
    signalStrength: 94,
    batteryLevel: 88,
    audioRoute: 'bluetooth'
  });

  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    number: '',
    direction: 'outgoing',
    duration: 0,
    isMuted: false,
    isRecording: false,
    currentLine: 1
  });

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'switchboard' | 'recordings' | 'sip_config'>('switchboard');

  // 2. Load and Sync Recordings from Express server
  const fetchRecordings = async () => {
    setIsLoadingRecordings(true);
    try {
      const response = await fetch('/api/recordings');
      if (response.ok) {
        const data = await response.json();
        // Map raw API metadata into Recording types
        const mapped: Recording[] = data.map((item: any) => ({
          id: item.id,
          filename: item.filename,
          number: item.number,
          duration: item.duration,
          timestamp: item.timestamp,
          fileSize: item.fileSize,
          notes: item.notes,
          url: `/api/recordings/audio/${item.id}`
        }));
        setRecordings(mapped);
      } else {
        console.error("Failed to load recordings list");
      }
    } catch (error) {
      console.error("Error fetching recordings:", error);
    } finally {
      setIsLoadingRecordings(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  // 3. Save a recording chunk/file to Express API
  const handleSaveRecording = async (base64Audio: string, number: string, durationSeconds: number) => {
    try {
      // Convert seconds to mm:ss format
      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      const durationStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      const response = await fetch('/api/recordings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioData: base64Audio,
          number: number || "Desconhecido",
          duration: durationStr,
          notes: `Ligação comutada via Bluetooth profile Hands-Free.`
        })
      });

      if (response.ok) {
        // Refresh the archive
        await fetchRecordings();
      } else {
        console.error("Error storing audio to server.ts database");
      }
    } catch (err) {
      console.error("Failed to post recording chunk:", err);
    }
  };

  // 4. Delete recording from Express API
  const handleDeleteRecording = async (id: string) => {
    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        // Refresh list
        await fetchRecordings();
      } else {
        console.error("Error deleting recording file");
      }
    } catch (err) {
      console.error("Failed to request record deletion:", err);
    }
  };

  // Hardware Audio devices hook state (can be updated by BluetoothBridge)
  const handleHardwareAudioSelect = (inputDevice: string, outputDevice: string) => {
    console.log(`Audio Route hardware targets updated: Input=[${inputDevice}] Output=[${outputDevice}]`);
  };

  // Render direct mobile WebRTC companion phone view if requested
  if (urlParams.mode === 'phone') {
    return (
      <div className="min-h-screen bg-[#070b12] text-gray-100 flex flex-col justify-center items-center p-4">
        <WebRTCPeer 
          roomId={webrtcRoom}
          peerId="phone"
        />
        <div className="mt-8 text-center space-y-2">
          <p className="text-[10px] text-gray-500 font-mono">Linha Comutadora Segura P2P</p>
          <a href="/" className="text-xs text-blue-500 hover:underline">Voltar para o Console de Comutação</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* 1. Global Navigation Bar */}
      <header className="border-b border-gray-800/80 bg-[#0d121f]/90 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Description */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Comutador SIP Bluetooth</h1>
                <span className="text-[10px] bg-blue-950/60 border border-blue-900/60 text-blue-400 font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                  Central V4.0
                </span>
              </div>
              <p className="text-xs text-gray-400">Ponte de canais de áudio físicos e gravação de chamadas</p>
            </div>
          </div>

          {/* Quick Hardware Indicators */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 bg-gray-950/50 border border-gray-800/80 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-gray-400">Celular:</span>
              <span className="text-white font-bold">{bluetoothState.isConnected ? 'EMPARELHADO' : 'DESCONECTADO'}</span>
            </div>

            <div className="flex items-center gap-2 bg-gray-950/50 border border-gray-800/80 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-gray-400">Linha SIP:</span>
              <span className="text-white font-bold uppercase">{sipConfig.status === 'online' ? 'REGISTRADO' : 'DESCONECTADO'}</span>
            </div>
          </div>

        </div>
      </header>

      {/* 2. Main Dashboard Panel */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Controls & Switchboard (8 cols on big screens) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Audio Bridge Explanation & Guide */}
          <div className="bg-[#111827] border border-gray-800/80 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            {/* Visual background gradient blur */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-950/50 border border-blue-900/40 text-blue-400 rounded-xl shrink-0">
                <Volume2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-white">Como Funciona a Ponte de Áudio Bluetooth?</h2>
                <p className="text-xs text-gray-400 leading-relaxed text-justify">
                  Ao emparelhar seu celular com o computador, o sistema operacional estabelece canais bidirecionais de áudio de viva-voz (perfil <strong>HFP / Hands-Free Profile</strong>). Este painel comutador captura o fluxo de áudio da chamada do seu celular através da entrada de áudio configurada, roteia para o dialer do computador, permitindo que você fale pelos periféricos do seu computador e **grave a chamada em tempo real** direto no servidor local.
                </p>
                
                {/* Visual Connection flow */}
                <div className="flex items-center gap-3 bg-gray-950/80 border border-gray-800/80 p-3 rounded-xl mt-3 text-xs max-w-xl font-mono">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                    <Smartphone className="w-4 h-4" /> Celular
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-700" />
                  <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                    <Bluetooth className="w-4 h-4 animate-pulse" /> Bluetooth (HFP)
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-700" />
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Headphones className="w-4 h-4" /> PC / Comutador
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-700" />
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                    <Disc className="w-4 h-4 animate-spin-slow" /> Gravação
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Switchboard Dialer Panel */}
          <Dialer 
            callState={callState}
            setCallState={setCallState}
            sipRegistered={sipConfig.status === 'online'}
            sipConfig={sipConfig}
            bluetoothConnected={bluetoothState.isConnected}
            onSaveRecording={handleSaveRecording}
            webrtcRoom={webrtcRoom}
          />

          {/* Hardware Device routing selection block */}
          <BluetoothBridge 
            bluetoothState={bluetoothState}
            setBluetoothState={setBluetoothState}
            onDeviceSelect={handleHardwareAudioSelect}
          />

        </div>

        {/* RIGHT COLUMN: SIP Trunk Settings & Saved Recordings (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Navigation tabs for the right sidebar to optimize space */}
          <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setActiveTab('switchboard')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'switchboard' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Gravações
            </button>
            <button
              onClick={() => setActiveTab('sip_config')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'sip_config' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Parâmetros SIP
            </button>
          </div>

          {/* Active Tab rendering */}
          {activeTab === 'switchboard' ? (
            <RecordingsList 
              recordings={recordings}
              onDelete={handleDeleteRecording}
              onRefresh={fetchRecordings}
              isLoading={isLoadingRecordings}
            />
          ) : (
            <SIPSettings 
              sipConfig={sipConfig}
              setSipConfig={setSipConfig}
              onSaveConfig={(cfg) => {
                setSipConfig(cfg);
                setActiveTab('switchboard'); // return to recordings on save
              }}
            />
          )}

          {/* Demo Speed Dial Panel */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-xl text-gray-100 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Testes Rápidos de Rota</h3>
            </div>
            
            <div className="space-y-2">
              <div className="p-3 bg-gray-950/40 border border-gray-800 rounded-xl flex items-center justify-between text-xs hover:bg-gray-950/80 transition-all">
                <div>
                  <span className="font-semibold block text-white">Canal 100 - URA Central</span>
                  <span className="text-[10px] text-gray-500">Música de espera e menu de voz interativo</span>
                </div>
                <span className="text-[10px] bg-blue-950/50 border border-blue-900/40 text-blue-400 px-2 py-1 rounded font-mono">
                  Ramal 100
                </span>
              </div>

              <div className="p-3 bg-gray-950/40 border border-gray-800 rounded-xl flex items-center justify-between text-xs hover:bg-gray-950/80 transition-all">
                <div>
                  <span className="font-semibold block text-white">Canal 200 - Echo Loopback</span>
                  <span className="text-[10px] text-gray-500">Testar latência e retorno da gravação</span>
                </div>
                <span className="text-[10px] bg-emerald-950/50 border border-emerald-900/40 text-emerald-400 px-2 py-1 rounded font-mono">
                  Ramal 200
                </span>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* 3. Global Footer */}
      <footer className="border-t border-gray-900 bg-[#090d16] py-6 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>SIP Bluetooth Comutador — Elie Vargas © 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 font-mono">Status do Servidor: Operando em Porta 3000</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

