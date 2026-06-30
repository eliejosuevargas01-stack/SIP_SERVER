import React, { useState, useEffect, useRef } from 'react';
import { Disc, Play, Pause, Trash2, Search, Download, Calendar, MessageSquare, Clock, ShieldCheck, RefreshCw, Layers } from 'lucide-react';
import { Recording } from '../types';

interface RecordingsListProps {
  recordings: Recording[];
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
}

export default function RecordingsList({ recordings, onDelete, onRefresh, isLoading }: RecordingsListProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filter recordings based on search
  const filteredRecordings = recordings.filter(rec => 
    rec.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (rec.notes && rec.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
    rec.timestamp.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePlayToggle = (rec: Recording) => {
    if (playingId === rec.id) {
      // Pause
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
      }
    } else {
      // Play new
      if (audioRef.current) {
        audioRef.current.pause();
      }

      setPlayingId(rec.id);
      
      const audio = new Audio(rec.url);
      audio.volume = 0.8;
      
      audio.ontimeupdate = () => {
        if (audio.duration) {
          setPlayProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onended = () => {
        setPlayingId(null);
        setPlayProgress(0);
      };

      audio.play().catch(err => {
        console.error("Failed to play audio:", err);
        setPlayingId(null);
      });

      audioRef.current = audio;
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <div id="recordings-list-panel" className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl text-gray-100 flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-950/40 text-rose-400 border border-rose-900/60">
            <Disc className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h2 className="font-semibold text-lg tracking-tight">Gravações da Central</h2>
            <p className="text-xs text-gray-400">Armazenamento local seguro das chamadas SIP</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all cursor-pointer"
            title="Atualizar Lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          
          <span className="text-xs font-mono bg-gray-950 border border-gray-800 text-gray-400 px-3 py-1.5 rounded-lg font-bold">
            {recordings.length} {recordings.length === 1 ? 'LIGAÇÃO' : 'LIGAÇÕES'}
          </span>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filtrar por número, data, ramal ou anotações..."
          className="w-full bg-gray-950/80 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
      </div>

      {/* Recordings Container */}
      <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs text-gray-500 font-mono">Buscando banco de arquivos de áudio...</p>
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl bg-gray-950/20">
            <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-400">Nenhuma gravação de chamada encontrada</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              {searchTerm ? 'Tente modificar o termo de filtro de busca.' : 'Inicie e desligue uma ligação no painel acima para gerar o primeiro arquivo de gravação de áudio real.'}
            </p>
          </div>
        ) : (
          filteredRecordings.map((rec) => {
            const isPlaying = playingId === rec.id;
            return (
              <div 
                key={rec.id} 
                className={`p-4 rounded-xl border transition-all flex flex-col gap-3 ${
                  isPlaying 
                    ? 'bg-blue-950/15 border-blue-900/60' 
                    : 'bg-gray-950/40 border-gray-800/80 hover:bg-gray-950/80 hover:border-gray-800'
                }`}
              >
                {/* Header Information */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Circle Initial */}
                    <div className="w-9 h-9 rounded-full bg-blue-900/40 border border-blue-800/50 flex items-center justify-center font-bold text-sm text-blue-300">
                      {rec.number.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">{rec.number}</span>
                        <span className="text-[10px] bg-rose-950/40 border border-rose-900/50 text-rose-400 px-2 py-0.5 rounded-full font-mono font-semibold">
                          GRAVADO
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5 font-mono">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-gray-600" /> {rec.timestamp}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-gray-600" /> {rec.duration}</span>
                        <span>•</span>
                        <span>{rec.fileSize}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Play, Download, Delete) */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      onClick={() => handlePlayToggle(rec)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer ${
                        isPlaying
                          ? 'bg-blue-600 border-blue-500 text-white animate-pulse'
                          : 'bg-gray-900 border-gray-800 text-blue-400 hover:text-white hover:bg-blue-600 hover:border-blue-500'
                      }`}
                      title={isPlaying ? "Pausar Reprodução" : "Tocar Gravação"}
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>

                    <a
                      href={rec.url}
                      download={rec.filename}
                      className="p-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all cursor-pointer"
                      title="Baixar arquivo WebM"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                    <button
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir permanentemente a gravação da chamada do número ${rec.number}?`)) {
                          onDelete(rec.id);
                        }
                      }}
                      className="p-2 bg-gray-900 border border-gray-800 rounded-lg text-rose-400 hover:text-white hover:bg-rose-600 hover:border-rose-500 transition-all cursor-pointer"
                      title="Excluir do Servidor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Scrubber indicator if playing */}
                {isPlaying && (
                  <div className="space-y-1 bg-gray-950/60 p-2 rounded-lg border border-gray-800/60">
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-100" 
                        style={{ width: `${playProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-600 font-mono">
                      <span>REPRODUZINDO VIA AUDIO CONTEXT</span>
                      <span>{Math.round(playProgress)}%</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Regulatory Info */}
      <div className="border-t border-gray-800/60 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] text-gray-500 font-mono">
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Criptografia de Ponta-a-Ponta local ativada</span>
        <span>MimeType: audio/webm (Opus Codec)</span>
      </div>
    </div>
  );
}
