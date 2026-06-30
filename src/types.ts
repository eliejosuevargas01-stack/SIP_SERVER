export interface SIPConfig {
  serverUrl: string;
  port: number;
  username: string;
  password?: string;
  websocketUrl?: string;
  displayName: string;
  status: 'offline' | 'registering' | 'online' | 'error';
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  avatarColor: string;
  type: 'internal' | 'external' | 'speed';
}

export interface Recording {
  id: string;
  filename: string;
  number: string;
  duration: string; // duration in mm:ss
  timestamp: string;
  fileSize: string;
  notes?: string;
  url: string;
}

export interface BluetoothState {
  isConnected: boolean;
  deviceName: string;
  signalStrength: number; // 0 to 100
  batteryLevel: number; // 0 to 100
  audioRoute: 'computer' | 'bluetooth';
}

export interface CallState {
  status: 'idle' | 'ringing' | 'connected' | 'held';
  number: string;
  direction: 'incoming' | 'outgoing';
  duration: number; // in seconds
  isMuted: boolean;
  isRecording: boolean;
  currentLine: number;
}
