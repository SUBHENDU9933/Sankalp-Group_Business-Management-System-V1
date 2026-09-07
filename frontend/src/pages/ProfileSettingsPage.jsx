import { useEffect, useRef, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile, uploadSignature, changeOwnPassword } from "@/services/profileService";
import { exportAllToZip } from "@/services/exportService";
import { Upload, Save, KeyRound, UserCircle2, Download, Archive, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const inputCls = "rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0";

export default function ProfileSettingsPage() {
  const { user, profile, refreshProfile, isAdmin } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const fileRef = useRef(null);

  const handleExportZip = async () => {
    if (!isAdmin) { toast.error("Only admin can export all data"); return; }
    if (!window.confirm("Export ALL data as a ZIP (one CSV per table)? This may take 15-30 seconds.")) return;
    setExporting(true);
    try {
      const res = await exportAllToZip((p) => setExportProgress(p));
      if (res.errors.length) toast.warning(`Downloaded with ${res.errors.length} table error(s) — see _errors.txt inside ZIP`);
      else toast.success(`ZIP downloaded — ${res.tables} tables backed up`);
    } catch (e) { toast.error(e.message); }
    finally { setExporting(false); setExportProgress(null); }
  };

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setDesignation(profile.designation || "");
      setSignatureUrl(profile.signature_url || "");
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(user.id, { full_name: fullName, phone, designation });
      await refreshProfile();
      toast.success("Profile saved");
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleSign = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    setUploading(true);
    try {
      const url = await uploadSignature(user.id, file);
      setSignatureUrl(url);
      await refreshProfile();
      toast.success("Signature updated");
    } catch (err) { toast.error(err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return toast.error("Enter your current password and the new password");
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters");
    if (newPassword !== confirmPassword) return toast.error("New password and confirmation do not match");
    if (newPassword === currentPassword) return toast.error("New password must be different from your current password");
    setChangingPassword(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully");
    } catch (e) { toast.error(e.message); }
    finally { setChangingPassword(false); }
  };

  const passwordType = showPasswords ? "text" : "password";

  return (
    <div data-testid="profile-page">
      <PageHeader subtitle="Account" title="My Profile" />
      <PageBody>
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="bg-white border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-700 text-white grid place-items-center font-bold text-lg">
                {(profile?.full_name || profile?.email || "?").slice(0,1).toUpperCase()}
              </div>
              <div>
                <div className="font-display text-lg tracking-tight text-stone-900">{profile?.email}</div>
                <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-stone-500">
                  {isAdmin ? "Administrator" : String(profile?.role || "user").toLowerCase() === "re" ? "Relationship Executive" : "Relationship Manager"}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="label-uppercase">Full Name</Label>
                <Input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} data-testid="profile-fullname" />
              </div>
              <div>
                <Label className="label-uppercase">Phone</Label>
                <Input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="profile-phone" />
              </div>
              <div className="sm:col-span-2">
                <Label className="label-uppercase">Designation</Label>
                <Input className={inputCls} value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Site Executive, Site Manager, Director" data-testid="profile-designation" />
                <div className="text-[10px] tracking-widest uppercase text-stone-400 mt-1.5">Auto-stamped on every estimate you create.</div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 border-t border-stone-100 pt-5">
              <Button onClick={handleSave} disabled={saving} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="profile-save">
                <Save className="w-4 h-4 mr-1.5" />{saving ? "Saving…" : "Save Profile"}
              </Button>
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-6">
            <div className="label-uppercase mb-3"><UserCircle2 className="w-3 h-3 inline mr-1" />Signature</div>
            <div className="text-xs text-stone-500 mb-3">Upload once. Your signature will be embedded on every estimate you create.</div>
            <div className="border border-dashed border-stone-300 bg-stone-50 h-40 flex items-center justify-center mb-3 overflow-hidden">
              {signatureUrl ? (
                <img src={signatureUrl} alt="Signature" className="max-h-32 max-w-full object-contain" data-testid="profile-signature-img" />
              ) : (
                <div className="text-xs text-stone-400 tracking-widest uppercase font-semibold">No signature uploaded</div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleSign} className="hidden" data-testid="profile-signature-input" />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-none w-full bg-orange-500 hover:bg-orange-600 text-white" data-testid="profile-signature-upload">
              <Upload className="w-4 h-4 mr-1.5" />{uploading ? "Uploading…" : signatureUrl ? "Replace Signature" : "Upload Signature"}
            </Button>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-6 mt-6" data-testid="profile-password-section">
          <div className="flex items-center justify-between gap-4 mb-1">
            <div className="label-uppercase"><KeyRound className="w-3 h-3 inline mr-1" />Change Password</div>
            <button type="button" onClick={() => setShowPasswords((v) => !v)} className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1" data-testid="profile-password-visibility">
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPasswords ? "Hide" : "Show"}
            </button>
          </div>
          <p className="text-xs text-stone-500 mb-4">For your security, enter your current password before setting a new one.</p>
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label className="label-uppercase">Current Password</Label><Input type={passwordType} className={inputCls} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" data-testid="profile-current-password" /></div>
            <div><Label className="label-uppercase">New Password</Label><Input type={passwordType} className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="Minimum 8 characters" data-testid="profile-new-password" /></div>
            <div><Label className="label-uppercase">Confirm New Password</Label><Input type={passwordType} className={inputCls} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" data-testid="profile-confirm-password" /></div>
          </div>
          <div className="mt-5">
            <Button onClick={handleChangePassword} disabled={changingPassword} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="profile-change-password">
              <KeyRound className="w-4 h-4 mr-1.5" />{changingPassword ? "Changing…" : "Change Password"}
            </Button>
          </div>
        </div>

        {isAdmin && (
          <div className="bg-white border border-stone-200 p-6 mt-6" data-testid="data-backup-section">
            <div className="label-uppercase mb-3"><Archive className="w-3 h-3 inline mr-1" />Full Data Backup</div>
            <div className="text-xs text-stone-600 mb-4">
              Downloads a ZIP file containing every table as CSV — Leads, Customers, Projects, Vendors, Estimates, Receipts, Expenses, Payments, Audit Log, and more.
              Save it to your Google Drive / hard drive for permanent safekeeping.
            </div>
            {exporting && exportProgress && (
              <div className="mb-3 text-xs text-stone-600 bg-stone-50 border border-stone-200 p-3">
                Exporting <b>{exportProgress.current}</b> ({exportProgress.done + 1}/{exportProgress.total})…
              </div>
            )}
            <Button onClick={handleExportZip} disabled={exporting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="profile-export-zip">
              <Download className="w-4 h-4 mr-1.5" />{exporting ? "Exporting…" : "Download Full Backup ZIP"}
            </Button>
          </div>
        )}
      </PageBody>
    </div>
  );
}
