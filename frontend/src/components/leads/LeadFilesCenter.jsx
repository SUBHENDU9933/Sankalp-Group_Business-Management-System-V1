import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, FileText, Image as ImageIcon, FileSpreadsheet, FileArchive, File as FileIcon,
  Download, Eye, RefreshCw, X, FolderOpen
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  uploadToGoogleDrive,
  downloadGoogleDriveFile,
  fetchGoogleDriveFileBlob,
} from "@/services/googleDriveService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "site_photo", label: "Site Photo" },
  { key: "customer_photo", label: "Customer Photo" },
  { key: "room_photo", label: "Room Photo" },
  { key: "floor_plan", label: "Floor Plan" },
  { key: "drawing", label: "Drawing" },
  { key: "reference_image", label: "Reference Image" },
  { key: "pdf_document", label: "PDF / Document" },
  { key: "other", label: "Other" },
];

const categoryLabel = (key) => CATEGORIES.find((item) => item.key === key)?.label || "Other";
const isImage = (type = "") => /^(image\/jpeg|image\/jpg|image\/png|image\/webp)$/i.test(type);
const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0) + " " + units[index];
};

const iconFor = (file) => {
  if (isImage(file.file_type)) return ImageIcon;
  if (/pdf/i.test(file.file_type || "") || /\.pdf$/i.test(file.file_name || "")) return FileText;
  if (/spreadsheet|excel|csv/i.test(file.file_type || "") || /\.(xlsx?|csv)$/i.test(file.file_name || "")) return FileSpreadsheet;
  if (/zip|archive/i.test(file.file_type || "") || /\.(zip|rar|7z)$/i.test(file.file_name || "")) return FileArchive;
  return FileIcon;
};

export default function LeadFilesCenter({ lead }) {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("other");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [thumbnails, setThumbnails] = useState({});
  const thumbnailsRef = useRef({});
  useEffect(() => { thumbnailsRef.current = thumbnails; }, [thumbnails]);

  const loadFiles = async () => {
    if (!lead?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lead_files")
        .select("*, uploader:profiles!lead_files_uploaded_by_fkey(id,full_name,email)")
        .eq("lead_id", lead.id)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      toast.error(error.message || "Could not load lead files");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [lead?.id]);

  const visibleFiles = useMemo(
    () => category === "all" ? files : files.filter((file) => file.category === category),
    [files, category]
  );

  useEffect(() => {
    let cancelled = false;
    const imageFiles = files.filter((file) => isImage(file.file_type) && !thumbnails[file.id]).slice(0, 8);
    if (!imageFiles.length) return undefined;
    (async () => {
      const next = {};
      for (const file of imageFiles) {
        try {
          const blob = await fetchGoogleDriveFileBlob({
            fileId: file.drive_file_id,
            recordId: file.id,
            leadId: lead.id,
          });
          if (!cancelled) next[file.id] = URL.createObjectURL(blob);
        } catch (_) {
          // Thumbnail failure should not block the file list.
        }
      }
      if (!cancelled && Object.keys(next).length) {
        setThumbnails((current) => ({ ...current, ...next }));
      }
    })();
    return () => { cancelled = true; };
  }, [files, lead?.id]);

  useEffect(() => () => {
    Object.values(thumbnailsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handleUpload = async (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    setUploading(true);
    try {
      for (const file of selected) {
        const result = await uploadToGoogleDrive({
          file,
          module: "lead",
          recordId: lead.id,
          leadId: lead.id,
          source: "lead",
          category: uploadCategory,
        });
        if (!result?.driveFileId) throw new Error("Upload completed without Drive file metadata");
      }
      toast.success(selected.length === 1 ? "File uploaded" : selected.length + " files uploaded");
      await loadFiles();
    } catch (error) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (file) => {
    try {
      if (isImage(file.file_type)) {
        const blob = await fetchGoogleDriveFileBlob({
          fileId: file.drive_file_id,
          recordId: file.id,
          leadId: lead.id,
        });
        const url = URL.createObjectURL(blob);
        setPreview({ file, url });
        return;
      }
      if (/^application\/pdf$/i.test(file.file_type || "") || /\.pdf$/i.test(file.file_name || "")) {
        const blob = await fetchGoogleDriveFileBlob({
          fileId: file.drive_file_id,
          recordId: file.id,
          leadId: lead.id,
          disposition: "inline",
        });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        await downloadGoogleDriveFile({
          fileId: file.drive_file_id,
          recordId: file.id,
          leadId: lead.id,
        });
      }
    } catch (error) {
      toast.error(error.message || "Could not open file");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border border-stone-200 bg-stone-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label-uppercase">Files & Documents</div>
            <div className="text-xs text-stone-500 mt-1">All files for this lead are kept together in the lead's Google Drive folder.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={uploadCategory} onValueChange={setUploadCategory} disabled={uploading}>
              <SelectTrigger className="w-[170px] h-9 bg-white text-xs">
                <SelectValue placeholder="Upload category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.filter((item) => item.key !== "all").map((item) => (
                  <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className={cn(
              "inline-flex items-center gap-2 px-3 h-9 bg-stone-900 hover:bg-stone-800 text-white text-xs tracking-widest uppercase font-semibold cursor-pointer",
              uploading && "opacity-60 pointer-events-none"
            )}>
              {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? "Uploading…" : "Upload File"}
              <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCategory(item.key)}
              className={cn(
                "px-2.5 py-1.5 border text-[10px] tracking-[0.08em] uppercase font-semibold",
                category === item.key
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-600 border-stone-300 hover:bg-stone-100"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="border border-stone-200 p-8 text-center text-sm text-stone-500">Loading files…</div>
      ) : visibleFiles.length === 0 ? (
        <div className="border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
          <FolderOpen className="w-8 h-8 text-stone-400 mx-auto mb-3" />
          <div className="font-display text-lg tracking-tight text-stone-900">No files yet</div>
          <p className="text-sm text-stone-500 mt-1">Upload floor plans, photos, drawings, references or documents for this lead.</p>
        </div>
      ) : (
        <div className="border border-stone-200 bg-white divide-y divide-stone-100">
          {visibleFiles.map((file) => {
            const Icon = iconFor(file);
            const thumbnail = thumbnails[file.id];
            const uploader = file.uploader?.full_name || file.uploader?.email || "Unknown";
            return (
              <div key={file.id} className="p-3 flex items-center gap-3 hover:bg-stone-50/70">
                <button type="button" onClick={() => openFile(file)} className="w-12 h-12 border border-stone-200 bg-stone-50 shrink-0 overflow-hidden flex items-center justify-center">
                  {thumbnail ? <img src={thumbnail} alt="" className="w-full h-full object-cover" /> : <Icon className="w-5 h-5 text-stone-500" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-stone-900 truncate" title={file.file_name}>{file.file_name}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] uppercase tracking-[0.08em] text-stone-500">
                    <span>{categoryLabel(file.category)}</span>
                    <span>·</span>
                    <span>{file.source === "schedule" ? "Schedule" : "Lead"}</span>
                    <span>·</span>
                    <span>{formatBytes(file.file_size)}</span>
                  </div>
                  <div className="text-xs text-stone-400 mt-1">{uploader} · {new Date(file.uploaded_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" title="View" onClick={() => openFile(file)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" title="Download" onClick={() => downloadGoogleDriveFile({ fileId: file.drive_file_id, recordId: file.id, leadId: lead.id }).catch((error) => toast.error(error.message || "Could not download file"))}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-6" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
          <div className="relative max-w-5xl max-h-[90vh] bg-white p-2" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="absolute -right-3 -top-3 w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
              <X className="w-4 h-4" />
            </button>
            <img src={preview.url} alt={preview.file.file_name} className="max-w-[80vw] max-h-[82vh] object-contain" />
            <div className="px-2 py-2 text-xs text-stone-600">{preview.file.file_name}</div>
          </div>
        </div>
      )}
    </div>
  );
}
