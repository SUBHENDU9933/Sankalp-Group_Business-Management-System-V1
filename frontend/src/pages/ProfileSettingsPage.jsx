import { useEffect, useRef, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile, uploadSignature, sendPasswordReset } from "@/services/profileService";
import { Upload, Save, KeyRound, UserCircle2 } from "lucide-react";
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
  const [resetting, setResetting] = useState(false);
  const fileRef = useRef(null);

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

  const handleReset = async () => {
    if (!user?.email) return;
    if (!window.confirm(`Send a password reset email to ${user.email}?`)) return;
    setResetting(true);
    try {
      await sendPasswordReset(user.email);
      toast.success("Password reset email sent");
    } catch (e) { toast.error(e.message); }
    finally { setResetting(false); }
  };

  return (
    <div data-testid="profile-page">
      <PageHeader
        subtitle="Account"
        title="My Profile"
      />
      <PageBody>
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          {/* Form */}
          <div className="bg-white border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-700 text-white grid place-items-center font-bold text-lg">
                {(profile?.full_name || profile?.email || "?").slice(0,1).toUpperCase()}
              </div>
              <div>
                <div className="font-display text-lg tracking-tight text-stone-900">{profile?.email}</div>
                <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-stone-500">{isAdmin ? "Administrator" : "Relationship Manager"}</div>
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
              <Button onClick={handleReset} disabled={resetting} variant="outline" className="rounded-none border-stone-300" data-testid="profile-reset-pwd">
                <KeyRound className="w-4 h-4 mr-1.5" />{resetting ? "Sending…" : "Send Password Reset Email"}
              </Button>
            </div>
          </div>

          {/* Signature */}
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
      </PageBody>
    </div>
  );
}
