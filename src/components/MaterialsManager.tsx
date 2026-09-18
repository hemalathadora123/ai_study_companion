"use client";

import { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  Eye, 
  X, 
  Brain, 
  Layers, 
  Clock
} from "lucide-react";

interface MaterialsManagerProps {
  projectId: string;
  onMaterialsChanged?: () => void;
}

export default function MaterialsManager({
  projectId,
  onMaterialsChanged,
}: MaterialsManagerProps) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadMaterials() {
    fetch(`/api/projects/${projectId}/materials`)
      .then((res) => res.json())
      .then((data) => {
        if (data.materials) {
          setMaterials(data.materials);
        }
      })
      .catch((err) => console.error("Error loading materials:", err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMaterials();
  }, [projectId]);

  // Polling if any material is in QUEUED or PROCESSING state
  useEffect(() => {
    const hasPending = materials.some(
      (m) => m.status === "QUEUED" || m.status === "PROCESSING"
    );

    if (!hasPending) return;

    const interval = setInterval(() => {
      loadMaterials();
      if (onMaterialsChanged) onMaterialsChanged();
    }, 2500);

    return () => clearInterval(interval);
  }, [materials, onMaterialsChanged]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setUploadError("Only PDF documents are supported.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(/\.pdf$/i, ""));

    try {
      const res = await fetch(`/api/projects/${projectId}/materials`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to upload document");
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      loadMaterials();
      if (onMaterialsChanged) onMaterialsChanged();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleReprocess(materialId: string) {
    try {
      await fetch(`/api/materials/${materialId}/reprocess`, { method: "POST" });
      loadMaterials();
    } catch (err) {
      console.error("Failed to trigger reprocess:", err);
    }
  }

  async function handleDelete(materialId: string) {
    if (!confirm("Are you sure you want to delete this document and its extracted chunks?")) return;
    try {
      await fetch(`/api/materials/${materialId}`, { method: "DELETE" });
      loadMaterials();
      if (onMaterialsChanged) onMaterialsChanged();
    } catch (err) {
      console.error("Failed to delete material:", err);
    }
  }

  async function inspectDocument(materialId: string) {
    setInspectLoading(true);
    try {
      const res = await fetch(`/api/materials/${materialId}`);
      const data = await res.json();
      setSelectedMaterial(data.material);
    } catch (err) {
      console.error("Failed to inspect material:", err);
    } finally {
      setInspectLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Upload Zone */}
      <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/50 rounded-2xl p-8 transition-all text-center">
        <input
          type="file"
          accept=".pdf,application/pdf"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          id="pdf-upload"
          disabled={uploading}
        />
        <label
          htmlFor="pdf-upload"
          className="cursor-pointer flex flex-col items-center justify-center space-y-3"
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            {uploading ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <Upload className="w-7 h-7" />
            )}
          </div>
          <div>
            <span className="font-semibold text-sm text-slate-800">
              {uploading ? "Uploading & Enqueuing Pipeline..." : "Click to Upload PDF Learning Material"}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Supports textbooks, papers, research notes, and lecture slides (up to 25 MB).
            </p>
          </div>
        </label>

        {uploadError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 max-w-md mx-auto">
            {uploadError}
          </div>
        )}
      </div>

      {/* Materials List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Uploaded Documents ({materials.length})
            </h3>
            <p className="text-xs text-slate-500">
              Processed documents are indexed into page-referenced chunks for accurate citations.
            </p>
          </div>
          <button
            onClick={loadMaterials}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Refresh document status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            <span className="text-xs">Loading documents...</span>
          </div>
        ) : materials.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No documents uploaded yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Upload a PDF above to let the system automatically process and extract knowledge.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {materials.map((mat) => {
              const isProcessing = mat.status === "QUEUED" || mat.status === "PROCESSING";
              const isFailed = mat.status === "FAILED";
              const isReady = mat.status === "READY";

              return (
                <div
                  key={mat.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isReady ? "bg-emerald-50 text-emerald-600" :
                      isFailed ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">
                        {mat.title}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>{mat.totalPages || 1} {mat.totalPages === 1 ? "page" : "pages"}</span>
                        <span>•</span>
                        <span>{mat._count?.chunks || 0} chunks</span>
                        <span>•</span>
                        <span>{Math.round(mat.fileSize / 1024)} KB</span>
                      </div>

                      {isFailed && mat.errorMessage && (
                        <p className="text-xs text-rose-600 mt-1.5 bg-rose-50 p-2 rounded-lg border border-rose-100">
                          Error: {mat.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center space-x-3 self-end sm:self-center">
                    {/* Status Badge */}
                    <div className="flex items-center space-x-1.5">
                      {isProcessing && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>{mat.status === "QUEUED" ? "Queued" : "Processing"}</span>
                        </span>
                      )}
                      {isReady && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ready</span>
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </span>
                      )}
                    </div>

                    {/* View Chunks */}
                    {isReady && (
                      <button
                        onClick={() => inspectDocument(mat.id)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                        title="Inspect Extracted Chunks & Page References"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Inspect</span>
                      </button>
                    )}

                    {/* Retry / Reprocess */}
                    {(isFailed || isReady) && (
                      <button
                        onClick={() => handleReprocess(mat.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                        title="Reprocess document"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(mat.id)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chunks Inspector Modal / Drawer */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedMaterial.title}
                  </h3>
                  <div className="text-xs text-slate-400">
                    {selectedMaterial.chunks?.length || 0} Indexed Chunks • Page citations ready
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedMaterial(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedMaterial.chunks?.map((chunk: any, index: number) => {
                const chunkConcepts = chunk.concepts ? JSON.parse(chunk.concepts) : [];

                return (
                  <div
                    key={chunk.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-left"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                        Page {chunk.pageNumber} • Chunk #{index + 1}
                      </span>
                      <span className="text-slate-400 font-medium">
                        ~{chunk.tokenCount} tokens
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 font-mono bg-white p-3 rounded-lg border border-slate-200/70 whitespace-pre-wrap leading-relaxed">
                      {chunk.content}
                    </p>

                    {chunkConcepts.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Extracted Concepts:
                        </span>
                        {chunkConcepts.map((c: string, ci: number) => (
                          <span
                            key={ci}
                            className="text-[10px] font-semibold bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-md"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {(!selectedMaterial.chunks || selectedMaterial.chunks.length === 0) && (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No chunks extracted for this document.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMaterial(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
