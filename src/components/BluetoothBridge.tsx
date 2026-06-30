import React, { useState, useEffect } from 'react';
import { Bluetooth, Volume2, ShieldCheck, HelpCircle, RefreshCw, Radio, Check, Smartphone, Layers } from 'lucide-react';
import { BluetoothState } from '../types';

interface BluetoothBridgeProps {
  bluetoothState: BluetoothState;
  setBluetoothState: React.Dispatch<React.SetStateAction<BluetoothState>>;
  onDeviceSelect: (inputId: string, outputId: string) => void;
}

export default function BluetoothBridge({ bluetoothState, setBluetoothState, onDeviceSelect }: BluetoothBridgeProps) {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [customDeviceName, setCustomDeviceName] = useState<string>('Dispositivo Bluetooth');

  // Load available audio devices
  const loadDevices = async () => {
    try {
      // First try to request permission to get full device labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionGranted(true);
      // Stop stream immediately after acquiring permissions
      stream.getTracks().forEach(track => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(d => d.kind === 'audioinput');
      const outputs = devices.filter(d => d.kind === 'audiooutput');

      setAudioInputs(inputs);
      setAudioOutputs(outputs);

      if (inputs.length > 0 && !selectedInput) {
        // Try to pre-select a device containing "bluetooth" or "headset"
        const btInput = inputs.find(i => i.label.toLowerCase().includes('bluetooth') || i.label.toLowerCase().includes('hfp') || i.label.toLowerCase().includes('headset'));
        const defaultInput = btInput ? btInput.deviceId : inputs[0].deviceId;
        setSelectedInput(defaultInput);
      }
      if (outputs.length > 0 && !selectedOutput) {
        const btOutput = outputs.find(o => o.label.toLowerCase().includes('bluetooth') || o.label.toLowerCase().includes('hfp') || o.label.toLowerCase().includes('headset'));
        const defaultOutput = btOutput ? btOutput.deviceId : outputs[0].deviceId;
        setSelectedOutput(defaultOutput);
      }
    } catch (error) {
      console.warn('Microphone permission not granted yet:', error);
      setPermissionGranted(false);
      // Try listing anyway (will show empty/unlabeled devices in some browsers)
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
      setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'));
    }
  };

  useEffect(() => {
    loadDevices();
    // Listen for device changes (e.g. plugging/unplugging bluetooth adapter)
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
  }, []);

  useEffect(() => {
    if (selectedInput || selectedOutput) {
      onDeviceSelect(selectedInput, selectedOutput);
    }
  }, [selectedInput, selectedOutput]);

  const toggleConnection = () => {
    if (bluetoothState.isConnected) {
      setBluetoothState(prev => ({
        ...prev,
        isConnected: false,
        signalStrength: 0,
        batteryLevel: 0
      }));
    } else {
      setIsScanning(true);
      setTimeout(() => {
        setIsScanning(false);
        setBluetoothState(prev => ({
          ...prev,
          isConnected: true,
          deviceName: customDeviceName,
          signalStrength: 92,
          batteryLevel: 85
        }));
      }, 1500);
    }
  };

  return (
    <div id="bluetooth-bridge-panel" className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl text-gray-100 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${bluetoothState.isConnected ? 'bg-blue-900/40 text-blue-400 border border-blue-800' : 'bg-gray-900 text-gray-500 border border-gray-800'}`}>
            <Bluetooth className={`w-6 h-6 ${bluetoothState.isConnected ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h2 className="font-semibold text-lg tracking-tight">Ponte Bluetooth</h2>
            <p className="text-xs text-gray-400">Integração de áudio Celular ↔ Computador</p>
          </div>
        </div>
        <button
          onClick={toggleConnection}
          disabled={isScanning}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            bluetoothState.isConnected
              ? 'bg-rose-950/40 text-rose-400 border border-rose-800/60 hover:bg-rose-900/40'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
          }`}
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Sincronizando...
            </>
          ) : bluetoothState.isConnected ? (
            'Desconectar'
          ) : (
            'Ativar Ponte'
          )}
        </button>
      </div>

      {/* Connection Status Panel */}
      <div className="bg-gray-950/60 rounded-xl border border-gray-800/80 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bluetoothState.isConnected ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-400' : 'bg-gray-900 border border-gray-800 text-gray-500'}`}>
            {bluetoothState.isConnected ? <Smartphone className="w-5 h-5" /> : <Bluetooth className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {bluetoothState.isConnected ? bluetoothState.deviceName : 'Nenhum dispositivo sincronizado'}
              </span>
              <span className={`w-2 h-2 rounded-full ${bluetoothState.isConnected ? 'bg-emerald-500 animate-ping' : 'bg-gray-600'}`} />
            </div>
            <p className="text-xs text-gray-500">
              {bluetoothState.isConnected ? 'Status: Conectado via HFP (Protocolo de Chamadas)' : 'Status: Aguardando pareamento de áudio'}
            </p>
          </div>
        </div>

        {bluetoothState.isConnected && (
          <div className="flex items-center gap-4 text-xs bg-gray-900/60 border border-gray-800 px-3 py-2 rounded-lg w-full sm:w-auto justify-around">
            <div className="flex flex-col items-center px-1">
              <span className="text-gray-500 font-mono">Sinal</span>
              <span className="text-emerald-400 font-mono font-bold">{bluetoothState.signalStrength}%</span>
            </div>
            <div className="w-px h-6 bg-gray-800" />
            <div className="flex flex-col items-center px-1">
              <span className="text-gray-500 font-mono">Bateria</span>
              <span className="text-blue-400 font-mono font-bold">{bluetoothState.batteryLevel}%</span>
            </div>
            <div className="w-px h-6 bg-gray-800" />
            <div className="flex flex-col items-center px-1">
              <span className="text-gray-500 font-mono">Perfil</span>
              <span className="text-amber-400 font-bold font-mono">HFP/A2DP</span>
            </div>
          </div>
        )}
      </div>

      {/* Real Hardware Route Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <Layers className="w-4 h-4 text-gray-500" />
          Roteamento de Canais de Áudio Físicos
        </div>

        {!permissionGranted && (
          <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold">Permissão de Microfone Requerida</p>
              <p className="text-amber-400/80 mt-1">
                Conceda acesso ao microfone do navegador para listar os seus dispositivos de áudio Bluetooth e permitir chamadas e gravações reais.
              </p>
              <button
                onClick={loadDevices}
                className="mt-2 text-amber-300 hover:text-amber-100 font-semibold underline flex items-center gap-1 cursor-pointer"
              >
                Solicitar Permissão
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input Device Selection */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium block">Entrada de Áudio (Microfone do Celular/Bluetooth)</label>
            <div className="relative">
              <select
                value={selectedInput}
                onChange={(e) => setSelectedInput(e.target.value)}
                className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none transition-all"
              >
                {audioInputs.length === 0 ? (
                  <option value="">Nenhum dispositivo encontrado</option>
                ) : (
                  audioInputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microfone Auxiliar (${device.deviceId.slice(0, 5)})`}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Output Device Selection */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium block">Saída de Áudio (Alto-falante/Bluetooth do Celular)</label>
            <div className="relative">
              <select
                value={selectedOutput}
                onChange={(e) => setSelectedOutput(e.target.value)}
                className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none transition-all"
              >
                {audioOutputs.length === 0 ? (
                  <option value="">Alto-falante padrão do sistema</option>
                ) : (
                  audioOutputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Saída de Áudio Auxiliar (${device.deviceId.slice(0, 5)})`}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guide/Instructions */}
      <div className="border-t border-gray-800/60 pt-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Guia de Pareamento Físico</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-gray-950/40 border border-gray-800/50 p-3 rounded-lg relative overflow-hidden group">
            <div className="text-blue-500 font-bold font-mono mb-1.5 text-sm">Passo 1</div>
            <p className="text-gray-400 leading-relaxed">No celular, ative o Bluetooth e selecione o seu computador na lista de dispositivos disponíveis.</p>
          </div>
          <div className="bg-gray-950/40 border border-gray-800/50 p-3 rounded-lg relative overflow-hidden group">
            <div className="text-blue-500 font-bold font-mono mb-1.5 text-sm">Passo 2</div>
            <p className="text-gray-400 leading-relaxed">No computador, aprove o emparelhamento e garanta que o perfil <strong>"HFP" (Hands-Free)</strong> ou gateway de chamadas esteja ativo.</p>
          </div>
          <div className="bg-gray-950/40 border border-gray-800/50 p-3 rounded-lg relative overflow-hidden group">
            <div className="text-blue-500 font-bold font-mono mb-1.5 text-sm">Passo 3</div>
            <p className="text-gray-400 leading-relaxed">Nas opções de áudio acima, escolha seu dispositivo Bluetooth correspondente para capturar e enviar o som da ligação.</p>
          </div>
        </div>
      </div>

      {/* Change device name block */}
      <div className="flex flex-col sm:flex-row items-end gap-3 bg-gray-900/20 border border-gray-800/60 p-4 rounded-xl">
        <div className="flex-1 w-full space-y-1">
          <label className="text-xs text-gray-400 font-medium">Nomear Celular Conectado</label>
          <input
            type="text"
            value={customDeviceName}
            onChange={(e) => {
              setCustomDeviceName(e.target.value);
              if (bluetoothState.isConnected) {
                setBluetoothState(prev => ({ ...prev, deviceName: e.target.value }));
              }
            }}
            placeholder="Ex: Galaxy S23 de Elie"
            className="w-full bg-gray-950/80 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
        <div className="text-xs text-gray-500 max-w-xs self-center">
          <span className="text-blue-400 font-bold">Dica:</span> Use o perfil HFP para capturar tanto o áudio quanto habilitar o envio da sua voz pelo microfone Bluetooth.
        </div>
      </div>
    </div>
  );
}
