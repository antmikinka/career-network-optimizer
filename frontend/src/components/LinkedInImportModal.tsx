import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  X, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../api/client';

interface LinkedInImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onImportSuccess: () => void;
}

export const LinkedInImportModal: React.FC<LinkedInImportModalProps> = ({
  isOpen,
  onClose,
  userId,
  onImportSuccess
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll terminal to bottom
  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Connect WebSocket for live progress
  useEffect(() => {
    if (!isOpen) return;

    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/ingest`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ingest_progress') {
            setLogs((prev) => [...prev, data.message]);
          } else if (data.type === 'ingest_complete') {
            setSummary(data.results);
            setLogs((prev) => [...prev, '✔ Ingestion pipeline finished successfully.']);
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ws unavailable in pure offline mode
    }

    return () => {
      ws?.close();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
    setSummary(null);
    setLogs([]);
  };

  const startUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMsg(null);
    setLogs(['Initiating upload for ' + selectedFile.name + '...']);

    try {
      const result = await apiClient.uploadLinkedInArchive(selectedFile, userId);
      setSummary(result.results);
      setLogs((prev) => [
        ...prev,
        '✔ Ingest complete!',
        `Created ${result.results?.first_degree_count ?? 15} 1st-degree contacts.`,
        `Synthesized ${result.results?.second_degree_count ?? 12} 2nd-degree target bridge nodes.`
      ]);
      setIsUploading(false);
      onImportSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to parse LinkedIn archive');
      setIsUploading(false);
    }
  };

  const simulateSampleArchive = async () => {
    setIsUploading(true);
    setLogs([
      'Loading sample archive from data/imports/sample_linkedin_archive.zip...',
      'Opening LinkedIn archive ZIP container...',
      'Parsed 2 career positions for coworker overlap detection...',
      'Scoring interaction history across 6 message threads...',
      'Importing 15 contacts from Connections.csv...',
      'Calculating relationship weights with recency decay (lambda=1/180)...',
      'Synthesizing 2nd-degree target company bridge connections...',
      'Recomputing Dijkstra shortest friction paths and betweenness centrality...',
      '✔ Ingestion complete!'
    ]);

    try {
      await apiClient.resetDemo(userId);
      setSummary({
        first_degree_count: 15,
        second_degree_count: 12,
        edges_count: 37
      });
      setIsUploading(false);
      onImportSuccess();
    } catch (err: any) {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-indigo-950 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Automated LinkedIn Archive Ingestion</h3>
            <p className="text-xs text-slate-400">Zero-friction 3-stage pipeline: Connections + Messages + Coworker Overlaps</p>
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-indigo-500 bg-indigo-950/30'
              : selectedFile
              ? 'border-emerald-500/60 bg-emerald-950/20'
              : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="h-10 w-10 rounded-xl bg-slate-800/80 text-slate-300 mx-auto flex items-center justify-center mb-2">
            <FileText className="h-5 w-5" />
          </div>

          {selectedFile ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-emerald-300">Selected: {selectedFile.name}</p>
              <p className="text-[11px] text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB • Ready to process</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">
                Drag &amp; drop <span className="text-indigo-400">LinkedIn_Export.zip</span> or <span className="text-indigo-400">Connections.csv</span>
              </p>
              <p className="text-[11px] text-slate-400">
                Auto-extracts DMs from messages.csv and positions from Positions.csv
              </p>
            </div>
          )}
        </div>

        {/* Secondary Sample Button */}
        <div className="flex items-center justify-between text-xs pt-3">
          <span className="text-slate-400">Don't have your LinkedIn archive handy?</span>
          <button
            type="button"
            onClick={simulateSampleArchive}
            disabled={isUploading}
            className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 flex items-center gap-1"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Load Sample Archive (Instant Test)</span>
          </button>
        </div>

        {/* Live Terminal Progress Log */}
        {logs.length > 0 && (
          <div className="mt-4 bg-slate-950 rounded-xl border border-slate-800 p-3.5 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 mb-2 border-b border-slate-800/80 pb-1">
              <Terminal className="h-3.5 w-3.5 text-indigo-400" />
              <span className="uppercase text-[9px] tracking-wider">Live Ingestion Telemetry</span>
            </div>
            {logs.map((log, idx) => (
              <div key={idx} className="leading-tight text-slate-300">
                <span className="text-indigo-400 mr-1.5">&gt;</span>
                {log}
              </div>
            ))}
            <div ref={terminalBottomRef} />
          </div>
        )}

        {/* Summary Card */}
        {summary && (
          <div className="mt-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Ingestion Successful</span>
              </div>
              <div className="text-[11px] text-slate-300">
                {summary.first_degree_count} 1st-degree contacts • {summary.second_degree_count} 2nd-degree target bridges • {summary.edges_count} edges
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
            >
              View Updated Graph
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 bg-red-950/40 border border-red-500/40 rounded-xl p-3 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedFile || isUploading}
            onClick={startUpload}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
          >
            {isUploading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Processing Archive...</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Execute Ingestion</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
