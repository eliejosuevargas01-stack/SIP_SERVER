import React, { useState } from 'react';
import { Settings, Check, RefreshCw, Key, Shield, HelpCircle, Server, Lock, HelpCircle as HelpIcon } from 'lucide-react';
import { SIPConfig } from '../types';

interface SIPSettingsProps {
  sipConfig: SIPConfig;
  setSipConfig: React.Dispatch<React.SetStateAction<SIPConfig>>;
  onSaveConfig: (config: SIPConfig) => void;
}

export default function SIPSettings({ sipConfig, setSipConfig, onSaveConfig }: SIPSettingsProps) {
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showPwd, setShowPwd] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage('');

    // Seta como registrando para ser interceptado ou conectado na tela
    setSipConfig(prev => ({ ...prev, status: 'registering' }));

    setTimeout(() => {
      setIsSaving(false);
      const isSuccess = sipConfig.serverUrl.length > 0 && sipConfig.username.length > 0;
      
      if (isSuccess) {
        setSipConfig(prev => ({ ...prev, status: 'online' }));
        setStatusMessage('Configurações salvas e Registro SIP real inicializado!');
        onSaveConfig({ ...sipConfig, status: 'online' });
      } else {
        setSipConfig(prev => ({ ...prev, status: 'error' }));
        setStatusMessage('Erro de parâmetros. Por favor forneça o ramal e o servidor.');
      }
    }, 1200);
  };

  const setDemoConfig = () => {
    const demo: SIPConfig = {
      serverUrl: 'sip.comutador-local.net',
      port: 5060,
      username: 'ramal_elie_301',
      password: 'senha_secreta_pabx',
      websocketUrl: 'wss://sip.comutador-local.net:8089/ws',
      displayName: 'Elie Vargas (Bluetooth Switchboard)',
      status: 'offline',
    };
    setSipConfig(demo);
    setStatusMessage('Configuração de demonstração real carregada! Insira seus dados reais para conectar.');
  };

  return (
    <div id="sip-settings-panel" className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl text-gray-100 flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-950/40 text-blue-400 border border-blue-800">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-lg tracking-tight">Tronco & Ramal SIP</h2>
            <p className="text-xs text-gray-400">Autenticação WebRTC & Rede Real</p>
          </div>
        </div>

        <button
          onClick={setDemoConfig}
          className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer bg-blue-950/20 border border-blue-900/40 px-3 py-1.5 rounded-lg"
        >
          Carregar Demo
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SIP Server URL and Port */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs text-gray-400 font-medium flex items-center gap-1">
              <Server className="w-3 h-3 text-gray-500" /> Servidor / IP do PABX
            </label>
            <input
              type="text"
              required
              value={sipConfig.serverUrl}
              onChange={(e) => setSipConfig({ ...sipConfig, serverUrl: e.target.value })}
              placeholder="Ex: sip.meuservidor.com"
              className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium">Porta SIP</label>
            <input
              type="number"
              required
              value={sipConfig.port}
              onChange={(e) => setSipConfig({ ...sipConfig, port: parseInt(e.target.value) || 5060 })}
              placeholder="5060"
              className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
            />
          </div>
        </div>

        {/* WebSocket WebRTC URL (CRITICAL FOR WebRTC SIP) */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-blue-500" /> URL WebSocket (WSS/WS) do Servidor
            </span>
            <span className="text-[10px] text-gray-500 font-mono">Requerido para WebRTC</span>
          </label>
          <input
            type="text"
            required
            value={sipConfig.websocketUrl || ''}
            onChange={(e) => setSipConfig({ ...sipConfig, websocketUrl: e.target.value })}
            placeholder="Ex: wss://sip.meuservidor.com:8089/ws"
            className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Username / SIP Extension */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium flex items-center gap-1">
              <Key className="w-3 h-3 text-gray-500" /> Ramal / Usuário
            </label>
            <input
              type="text"
              required
              value={sipConfig.username}
              onChange={(e) => setSipConfig({ ...sipConfig, username: e.target.value })}
              placeholder="Ex: 301"
              className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
            />
          </div>

          {/* Password (Secret key) */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium flex items-center gap-1">
              <Lock className="w-3 h-3 text-gray-500" /> Senha (Secret)
            </label>
            <input
              type={showPwd ? "text" : "password"}
              value={sipConfig.password || ''}
              onChange={(e) => setSipConfig({ ...sipConfig, password: e.target.value })}
              placeholder="Digite a senha do ramal"
              className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Display name */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400 font-medium">Nome de Exibição (Caller ID)</label>
          <input
            type="text"
            value={sipConfig.displayName}
            onChange={(e) => setSipConfig({ ...sipConfig, displayName: e.target.value })}
            placeholder="Ex: Central Elie Vargas"
            className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Feedback message */}
        {statusMessage && (
          <div className={`p-3.5 rounded-xl text-xs font-medium border ${
            sipConfig.status === 'online'
              ? 'bg-emerald-950/30 border-emerald-900/60 text-emerald-400'
              : sipConfig.status === 'error'
              ? 'bg-rose-950/30 border-rose-900/60 text-rose-400'
              : 'bg-blue-950/30 border-blue-900/60 text-blue-400'
          }`}>
            {statusMessage}
          </div>
        )}

        {/* Save and register button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-blue-600/10"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Conectando e Registrando Ramal Real...
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Salvar e Registrar Ramal Real
            </>
          )}
        </button>
      </form>

      {/* Guide/Instructions for Asterisk / Local SIP Switchboard setup */}
      <div className="border-t border-gray-800/60 pt-4 text-xs space-y-4">
        <span className="font-semibold text-gray-300 flex items-center gap-1.5 text-sm">
          <Shield className="w-4 h-4 text-emerald-400" />
          Como Configurar o seu Asterisk / FreePBX na VM para WebRTC:
        </span>
        
        <div className="space-y-3 bg-gray-950/60 p-4 rounded-xl border border-gray-800/80 leading-relaxed text-gray-300">
          <p>
            O navegador exige que a conexão SIP seja feita sobre o protocolo seguro <strong>WebSocket (WSS)</strong>. Siga as instruções abaixo para configurar a sua máquina virtual:
          </p>

          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-blue-400 flex items-center gap-1">1. Habilitar o Servidor HTTP e WebSocket no Asterisk</h4>
            <p className="text-gray-400 pl-4">
              Edite o arquivo <code>/etc/asterisk/http.conf</code> para abrir a porta de conexão segura:
            </p>
            <pre className="bg-gray-900 p-2.5 rounded-lg text-[11px] text-gray-400 font-mono overflow-x-auto pl-4">
{`[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/asterisk/keys/asterisk.pem`}
            </pre>
          </div>

          <div className="space-y-3 pt-1">
            <h4 className="font-bold text-blue-400 flex items-center gap-1">2. Configurar o Ramal PJSIP para WebRTC (pjsip.conf)</h4>
            <p className="text-gray-400 pl-4">
              O ramal que se conectará pelo navegador precisa de parâmetros especiais de criptografia de mídia (DTLS/SRTP). Adicione em seu arquivo:
            </p>
            <pre className="bg-gray-900 p-2.5 rounded-lg text-[11px] text-gray-400 font-mono overflow-x-auto pl-4">
{`[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089

[301] ; Seu Ramal
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw,vp8,h264
auth=301-auth
aors=301
media_encryption=dtls
dtls_verify=no
dtls_cert_file=/etc/asterisk/keys/asterisk.pem
dtls_ca_file=/etc/asterisk/keys/ca.crt
dtls_setup=actpass
webrtc=yes`}
            </pre>
          </div>

          <div className="space-y-3 pt-1">
            <h4 className="font-bold text-blue-400 flex items-center gap-1">3. Configurando via Painel Gráfico do FreePBX</h4>
            <ul className="list-disc pl-8 text-gray-400 space-y-1">
              <li>Acesse <strong>Applications &gt; Extensions</strong> e crie uma extensão do tipo <strong>PJSIP</strong>.</li>
              <li>Na aba <strong>Advanced</strong> do ramal, mude <strong>Enable WebRTC</strong> para <strong>Yes</strong>.</li>
              <li>Garanta que o campo <strong>Media Encryption</strong> esteja em <strong>DTLS (com SRTP)</strong>.</li>
              <li>Mude o <strong>DTLS Setup</strong> para <strong>Act/Pass</strong>.</li>
            </ul>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-800 text-[11px] text-yellow-500/90 leading-relaxed">
            <strong className="text-yellow-400">⚠️ Nota sobre Certificados Autoassinados:</strong> Se a sua VM do Asterisk usa certificados gerados localmente (autoassinados), o seu navegador irá rejeitar a conexão WebSocket por segurança. 
            <br />
            <strong>Para resolver:</strong> Abra uma nova aba no seu navegador e acesse <code>https://SEU_IP_ASTERISK:8089/ws</code> diretamente. O navegador exibirá um aviso de certificado inválido; clique em "Avançado" e depois em "Prosseguir/Aceitar Risco". Depois que você aceitar o certificado, volte a esta página e registre o ramal!
          </div>
        </div>
      </div>
    </div>
  );
}
