import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Phone, MessageCircle, Mail, Pencil, ArrowRightCircle, MapPin, IndianRupee,
  CalendarClock, Clock, NotebookPen, FileText, AlertTriangle, History, Calculator,
  CalendarDays, RefreshCw, MessageSquareText, Paperclip, UserRound, CheckCircle2, XCircle, Upload, Image, Home, Map, Ruler, FileType, Quote, FolderOpen, FileSpreadsheet, X,
} from "lucide-react";
import { LEAD_PRIORITIES, LEAD_STATUSES, formatDate, formatDateTime, formatINR, isOverdue, isToday } from "@/utils/format";
import { fetchLeadActivities, addLeadActivity, logLeadCallOutcome } from "@/services/leadActivityService";
import { buildEstimatorUrl } from "@/services/estimateService";
import { updateLead, updateLeadStatus } from "@/services/leadService";
import AssigneeManager from "@/components/leads/AssigneeManager";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchLeadFiles, uploadLeadFile, downloadLeadFile, deleteLeadFile } from "@/services/googleDriveService";
import { cn } from "@/lib/utils";

export default function LeadDetailsSheet({ open, onOpenChange, lead, onEdit, onConvert, profiles = [], onAssigneesChanged, onCallOutcome, onLeadUpdated }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [quickStatusOpen, setQuickStatusOpen] = useState(false);
  const [quickFollowupOpen, setQuickFollowupOpen] = useState(false);
  const [followupDate, setFollowupDate] = useState(lead?.next_followup_date || "");
  const [followupNote, setFollowupNote] = useState(lead?.reminder_note || "");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completionOutcome, setCompletionOutcome] = useState("");
  const [customerResponse, setCustomerResponse] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextFollowupDate, setNextFollowupDate] = useState("");
  const [noFurtherFollowup, setNoFurtherFollowup] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeFileCategory, setActiveFileCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("site_photo");
  const [selectedFile, setSelectedFile] = useState(null);
  const [leadFiles, setLeadFiles] = useState([]);
  const [loadingLeadFiles, setLoadingLeadFiles] = useState(false);
  const [uploadingLeadFile, setUploadingLeadFile] = useState(false);

  useEffect(() => {
    if (!open || !lead?.id) return;
    setTab("overview");
    setLoading(true);
    fetchLeadActivities(lead.id)
      .then(setActivities)
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [open, lead?.id]);

  const isAdmin = user?.role === "admin" || profiles.some((p) => p.id === user?.id && p.role === "admin");

  const loadLeadFiles = async () => {
    if (!lead?.id) return;
    setLoadingLeadFiles(true);
    try {
      setLeadFiles(await fetchLeadFiles(lead.id));
    } catch (e) {
      toast.error(e.message || "Could not load lead files");
      setLeadFiles([]);
    } finally {
      setLoadingLeadFiles(false);
    }
  };

  useEffect(() => {
    if (!open || !lead?.id || tab !== "files") return;
    loadLeadFiles();
  }, [open, lead?.id, tab]);

  const handleLeadFileUpload = async () => {
    if (!selectedFile) {
      toast.error("Select a file first");
      return;
    }
    setUploadingLeadFile(true);
    try {
      await uploadLeadFile({
        file: selectedFile,
        leadId: lead.id,
        category: uploadCategory,
        onProgress: () => {},
      });
      toast.success("File uploaded and registered successfully");
      setSelectedFile(null);
      setUploadOpen(false);
      await loadLeadFiles();
    } catch (e) {
      toast.error(e.message || "File upload failed");
    } finally {
      setUploadingLeadFile(false);
    }
  };

  const handleLeadFileDelete = async (fileId) => {
    if (!isAdmin) return;
    try {
      await deleteLeadFile(fileId);
      toast.success("File deleted");
      await loadLeadFiles();
    } catch (e) {
      toast.error(e.message || "Could not delete file");
    }
  };

  if (!lead) return null;
  const priority = LEAD_PRIORITIES.find((p) => p.key === lead.priority);
  const phoneClean = (lead.phone || "").replace(/\D/g, "");
  const overdue = isOverdue(lead.next_followup_date) && !["converted","lost"].includes(lead.status);
  const today = isToday(lead.next_followup_date);

  const reload = async () => {
    try { setActivities(await fetchLeadActivities(lead.id)); } catch (_) { /* ignore */ }
  };

  const postNote = async (type = "note") => {
    if (!note.trim()) return;
    setPosting(true);
    try {
      await addLeadActivity({ leadId: lead.id, type, content: note.trim(), userId: user.id });
      setNote("");
      await reload();
      toast.success(type === "call" ? "Call logged" : "Note added");
    } catch (e) {
      toast.error(e.message || "Failed to add");
    } finally {
      setPosting(false);
    }
  };

  const followups = activities.filter((a) => a.type === "followup");

  const quickUpdate = async (payload, message) => {
    setPosting(true);
    try {
      const updated = await updateLead(lead.id, payload);
      onLeadUpdated?.(updated);
      toast.success(message);
      setQuickStatusOpen(false); setQuickFollowupOpen(false);
      await reload();
    } catch (e) { toast.error(e.message || "Update failed"); }
    finally { setPosting(false); }
  };

  const handleQuickStatus = async (status) => {
    if (status === lead.status) return setQuickStatusOpen(false);
    setPosting(true);
    try {
      const updated = await updateLeadStatus(lead.id, status, user.id);
      onLeadUpdated?.(updated);
      toast.success("Lead status updated");
      setQuickStatusOpen(false);
      await reload();
    } catch (e) { toast.error(e.message || "Status update failed"); }
    finally { setPosting(false); }
  };

  const openSchedule = () => {
    window.location.href = "/schedule?lead_id=" + encodeURIComponent(lead.id);
  };

  const openCompletion = () => {
    setCompletionOutcome("");
    setCustomerResponse("");
    setNextAction("");
    setNextFollowupDate(lead.next_followup_date || "");
    setNoFurtherFollowup(false);
    setCompleteOpen(true);
  };

  const completeFollowup = async () => {
    if (!completionOutcome) {
      toast.error("Select what happened during the follow-up");
      return;
    }
    if (!noFurtherFollowup && !nextFollowupDate) {
      toast.error("Set the next follow-up date, or choose No further follow-up");
      return;
    }
    setPosting(true);
    try {
      const date = noFurtherFollowup ? null : nextFollowupDate;
      const content = [
        `Outcome: ${completionOutcome}`,
        customerResponse.trim() ? `Customer response: ${customerResponse.trim()}` : "",
        nextAction.trim() ? `Next action: ${nextAction.trim()}` : "",
        date ? `Next follow-up: ${date}` : "No further follow-up scheduled",
      ].filter(Boolean).join("\n");

      await addLeadActivity({
        leadId: lead.id,
        type: "followup",
        content,
        meta: {
          outcome: completionOutcome,
          customer_response: customerResponse.trim() || null,
          next_action: nextAction.trim() || null,
          next_followup_date: date,
          completed_at: new Date().toISOString(),
        },
        userId: user.id,
      });

      const updated = await updateLead(lead.id, {
        next_followup_date: date,
        reminder_note: nextAction.trim() || null,
        last_contact_date: new Date().toISOString().slice(0, 10),
      });
      onLeadUpdated?.(updated);
      setCompleteOpen(false);
      await reload();
      toast.success("Follow-up completed and next action saved");
    } catch (e) {
      toast.error(e.message || "Failed to complete follow-up");
    } finally {
      setPosting(false);
    }
  };

  const handleCallOutcome = async (outcome) => {
    setPosting(true);
    try {
      await logLeadCallOutcome({ leadId: lead.id, outcome, userId: user.id });
      await reload();
      onCallOutcome?.(lead, outcome);
      toast.success(outcome === "connected" ? "Call connected — contact history updated" : "Call not connected — attempt recorded; lead status preserved");
    } catch (e) { toast.error(e.message || "Failed to update call outcome"); }
    finally { setPosting(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 rounded-none border-l-stone-300 overflow-y-auto"
        data-testid="lead-details-sheet"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-stone-200 space-y-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="label-uppercase">Lead Details</div>
              <SheetTitle className="font-display text-2xl tracking-tight truncate">{lead.name}</SheetTitle>
              <SheetDescription className="sr-only">Lead details, timeline, and follow-ups</SheetDescription>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <StatusBadge status={lead.status} />
                {priority && (
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase font-semibold border", priority.color)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", priority.dot)} /> {priority.label}
                  </span>
                )}
                {lead.tag && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase font-semibold border",
                      /repeat/i.test(lead.tag)
                        ? "bg-rose-50 text-rose-800 border-rose-300"
                        : "bg-orange-50 text-orange-800 border-orange-300"
                    )}
                    title={lead.tag}
                    data-testid="lead-detail-tag-badge"
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", /repeat/i.test(lead.tag) ? "bg-rose-500" : "bg-orange-500")} />
                    {/repeat/i.test(lead.tag) ? "Website · Repeat" : "Website"}
                  </span>
                )}
                {lead.estimate_status && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase font-semibold border bg-blue-50 text-blue-800 border-blue-300">
                    <Calculator className="w-3 h-3" />
                    Est · {lead.estimate_status}{lead.estimate_count > 1 ? ` (${lead.estimate_count})` : ""}
                  </span>
                )}
                {lead.is_locked && (
                  <span className="inline-block px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase font-semibold border bg-emerald-50 text-emerald-800 border-emerald-300">
                    Locked
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Button onClick={() => { setQuickStatusOpen(v => !v); setQuickFollowupOpen(false); }} variant="outline" className="rounded-none border-blue-300 text-blue-700 hover:bg-blue-50 h-9 text-xs tracking-widest uppercase font-semibold"><History className="w-3.5 h-3.5 mr-1.5" />Status</Button>
              {quickStatusOpen && (
                <div className="absolute z-50 top-10 left-0 w-64 bg-white border border-stone-200 shadow-xl p-2">
                  <div className="label-uppercase px-2 py-1.5">Move lead stage</div>
                  {LEAD_STATUSES.filter(s => s.key !== "lost").map(s => (
                    <button key={s.key} disabled={posting} onClick={() => handleQuickStatus(s.key)} className={cn("w-full text-left px-2.5 py-2 text-xs font-semibold hover:bg-stone-50 flex items-center justify-between", lead.status === s.key && "bg-blue-50 text-blue-700")}>
                      <span>{s.label}</span>{lead.status === s.key && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                  <button disabled={posting} onClick={() => handleQuickStatus("lost")} className="w-full text-left px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Mark Lost</button>
                </div>
              )}
            </div>
            <div className="relative">
              <Button onClick={openCompletion} variant="outline" className="rounded-none border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-9 text-xs tracking-widest uppercase font-semibold" data-testid="details-complete-followup"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Complete Follow-up</Button>
              {completeOpen && (
                <div className="absolute z-50 top-10 left-0 w-[min(92vw,420px)] bg-white border border-stone-200 shadow-2xl p-4">
                  <div className="label-uppercase mb-1">Follow-up Completion</div>
                  <div className="text-xs text-stone-500 mb-3">Record the result before moving the lead to its next action.</div>
                  <div className="space-y-3">
                    <div>
                      <div className="label-uppercase mb-1">What happened *</div>
                      <Select value={completionOutcome} onValueChange={setCompletionOutcome}>
                        <SelectTrigger className="rounded-none border-stone-300 h-9 text-sm"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="connected">Customer connected</SelectItem>
                          <SelectItem value="interested">Interested / positive</SelectItem>
                          <SelectItem value="needs_time">Needs more time</SelectItem>
                          <SelectItem value="site_visit_discussion">Site visit discussed</SelectItem>
                          <SelectItem value="estimate_discussion">Estimate discussed</SelectItem>
                          <SelectItem value="not_connected">Could not connect</SelectItem>
                          <SelectItem value="not_interested">Not interested</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="label-uppercase mb-1">Customer response</div>
                      <Textarea value={customerResponse} onChange={e => setCustomerResponse(e.target.value)} placeholder="What did the customer say?" className="rounded-none border-stone-300 min-h-[64px]" />
                    </div>
                    <div>
                      <div className="label-uppercase mb-1">Next action</div>
                      <Textarea value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="Example: send estimate / call after salary date / arrange site visit" className="rounded-none border-stone-300 min-h-[64px]" />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-stone-700">
                      <input type="checkbox" checked={noFurtherFollowup} onChange={e => setNoFurtherFollowup(e.target.checked)} className="accent-emerald-600" />
                      No further follow-up required
                    </label>
                    {!noFurtherFollowup && (
                      <div>
                        <div className="label-uppercase mb-1">Next follow-up date *</div>
                        <input type="date" value={nextFollowupDate} onChange={e => setNextFollowupDate(e.target.value)} className="w-full h-9 border border-stone-300 px-2 text-sm" />
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button disabled={posting} onClick={completeFollowup} className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white h-8 text-xs font-semibold">Save Completion</Button>
                      <Button disabled={posting} onClick={() => setCompleteOpen(false)} variant="outline" className="rounded-none h-8 text-xs">Cancel</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <Button onClick={() => { setQuickFollowupOpen(v => !v); setQuickStatusOpen(false); setFollowupDate(lead.next_followup_date || ""); setFollowupNote(lead.reminder_note || ""); }} variant="outline" className="rounded-none border-orange-300 text-orange-700 hover:bg-orange-50 h-9 text-xs tracking-widest uppercase font-semibold"><CalendarClock className="w-3.5 h-3.5 mr-1.5" />Follow-up</Button>
              {quickFollowupOpen && (
                <div className="absolute z-50 top-10 left-0 w-80 bg-white border border-stone-200 shadow-xl p-3">
                  <div className="label-uppercase mb-2">Quick Follow-up</div>
                  <input type="date" value={followupDate || ""} onChange={e => setFollowupDate(e.target.value)} className="w-full h-9 border border-stone-300 px-2 text-sm" />
                  <input value={followupNote} onChange={e => setFollowupNote(e.target.value)} placeholder="Reminder / next action..." className="w-full h-9 border border-stone-300 px-2 text-sm mt-2" />
                  <div className="flex gap-2 mt-2">
                    <Button disabled={posting || !followupDate} onClick={() => quickUpdate({ next_followup_date: followupDate, reminder_note: followupNote || null }, "Follow-up scheduled")} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs font-semibold">Save Follow-up</Button>
                    {lead.next_followup_date && <Button disabled={posting} onClick={() => quickUpdate({ next_followup_date: null, reminder_note: null }, "Follow-up cleared")} variant="outline" className="rounded-none h-8 text-xs">Clear</Button>}
                  </div>
                </div>
              )}
            </div>
            <Button onClick={openSchedule} variant="outline" className="rounded-none border-violet-300 text-violet-700 hover:bg-violet-50 h-9 text-xs tracking-widest uppercase font-semibold"><CalendarDays className="w-3.5 h-3.5 mr-1.5" />Meeting</Button>
            <a href={`tel:${phoneClean}`} className="inline-flex items-center gap-1.5 px-3 h-9 bg-stone-900 hover:bg-stone-800 text-white text-xs tracking-widest uppercase font-semibold" data-testid="details-call"><Phone className="w-3.5 h-3.5" /> Call</a>
            <a href={`https://wa.me/${phoneClean}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs tracking-widest uppercase font-semibold" data-testid="details-whatsapp"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>
            <Button onClick={() => onEdit(lead)} disabled={lead.is_locked} variant="outline" className="rounded-none border-stone-300 h-9 text-xs tracking-widest uppercase font-semibold" data-testid="details-edit"><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</Button>
            <Button onClick={() => { window.location.href = buildEstimatorUrl({ leadId: lead.id }); }} className="rounded-none bg-blue-700 hover:bg-blue-800 text-white h-9 text-xs tracking-widest uppercase font-semibold" data-testid="details-create-estimate">
              <Calculator className="w-3.5 h-3.5 mr-1.5" />Create Estimate
            </Button>
            {lead.last_estimate_id && (
              <Button onClick={() => { window.location.href = buildEstimatorUrl({ estimateId: lead.last_estimate_id }); }} variant="outline" className="rounded-none border-blue-300 text-blue-700 hover:bg-blue-50 h-9 text-xs tracking-widest uppercase font-semibold" data-testid="details-view-estimate">
                <Calculator className="w-3.5 h-3.5 mr-1.5" />View Last Estimate
              </Button>
            )}
            {lead.status !== "converted" && (
              <Button onClick={() => onConvert(lead)} disabled={lead.is_locked} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs tracking-widest uppercase font-semibold" data-testid="details-convert">
                <ArrowRightCircle className="w-3.5 h-3.5 mr-1.5" />Convert to Customer
              </Button>
            )}
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="rounded-none w-full justify-start bg-stone-50 border-b border-stone-200 h-11 p-0 px-2">
            <TabsTrigger value="overview" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-stone-900 px-4 h-full" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-stone-900 px-4 h-full" data-testid="tab-timeline">Timeline</TabsTrigger>
            <TabsTrigger value="followups" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-stone-900 px-4 h-full" data-testid="tab-followups">Follow-ups</TabsTrigger>
            <TabsTrigger value="files" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-stone-900 px-4 h-full" data-testid="tab-files">Files</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="m-0 p-6 space-y-5">
            <Section title="Contact">
              <Field icon={<Phone className="w-3.5 h-3.5" />} label="Phone (Primary)" value={lead.phone} />
              <Field icon={<Phone className="w-3.5 h-3.5" />} label="Phone (Secondary)" value={lead.phone_secondary} />
            </Section>
            <Section title="Location">
              <Field icon={<MapPin className="w-3.5 h-3.5" />} label="Location" value={lead.location} />
              <Field label="Area" value={lead.area} />
              <Field label="Pincode" value={lead.pincode} mono />
            </Section>
            <Section title="Project">
              <Field label="Project Type" value={lead.project_type} />
              <Field label="Property Type" value={lead.property_type} />
              <Field label="Area (sq ft)" value={lead.area_sqft ? `${lead.area_sqft} sqft` : null} />
              <Field icon={<IndianRupee className="w-3.5 h-3.5" />} label="Budget" value={formatINR(lead.budget)} mono />
              <Field label="Source" value={lead.source} />
              <Field label="Requirement" value={lead.requirement} full />
            </Section>
            <Section title="Tracking">
              <div className="col-span-2 mb-1 px-3 py-3 bg-stone-50 border border-stone-200">
                <AssigneeManager
                  lead={lead}
                  profiles={profiles}
                  onChanged={onAssigneesChanged}
                  variant="inline"
                />
              </div>
              <Field label="Created By" value={lead.creator?.full_name || lead.creator?.email} />
              <Field icon={<CalendarClock className="w-3.5 h-3.5" />} label="Next Follow-up" value={
                lead.next_followup_date ? (
                  <span className={cn(overdue && "text-rose-600 font-medium", today && "text-orange-600 font-medium")}>
                    {formatDate(lead.next_followup_date)} {overdue ? "· Overdue" : today ? "· Today" : ""}
                  </span>
                ) : null
              } />
              <Field label="Last Contact" value={formatDate(lead.last_contact_date)} />
              <Field label="Created" value={formatDateTime(lead.created_at)} />
              <Field label="Reminder Note" value={lead.reminder_note} full />
            </Section>
          </TabsContent>

          {/* TIMELINE */}
          <TabsContent value="timeline" className="m-0 p-6 space-y-4">
            <div className="bg-stone-50 border border-stone-200 p-3">
              <div className="label-uppercase mb-2">Add a note / call log</div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Discussed budget, scheduling site visit next Tuesday…"
                className="rounded-none border-stone-300 min-h-[70px] focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0"
                data-testid="timeline-note-input"
              />
              <div className="flex items-center gap-2 mt-2">
                <Button onClick={() => postNote("note")} disabled={posting || !note.trim()} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white h-8 text-xs tracking-widest uppercase font-semibold" data-testid="timeline-post-note"><NotebookPen className="w-3.5 h-3.5 mr-1.5" />Save Note</Button>
                <Button onClick={() => postNote("call")} disabled={posting || !note.trim()} variant="outline" className="rounded-none border-stone-300 h-8 text-xs tracking-widest uppercase font-semibold" data-testid="timeline-post-call"><Phone className="w-3.5 h-3.5 mr-1.5" />Log Call</Button>
              </div>
              <div className="mt-3 pt-3 border-t border-stone-200">
                <div className="text-[10px] tracking-[0.12em] uppercase font-semibold text-stone-500 mb-2">Call outcome · records the attempt</div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => { window.location.href = "tel:" + phoneClean; setTimeout(() => handleCallOutcome("connected"), 1200); }} disabled={posting} className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white h-8 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Call Connected</Button>
                  <Button onClick={() => { window.location.href = "tel:" + phoneClean; setTimeout(() => handleCallOutcome("not_connected"), 1200); }} disabled={posting} variant="outline" className="rounded-none border-rose-300 text-rose-700 hover:bg-rose-50 h-8 text-xs font-semibold"><XCircle className="w-3.5 h-3.5 mr-1.5" />Call Not Connected</Button>
                </div>
              </div>
            </div>
            <div className="space-y-0 border border-stone-200 bg-white">
              {loading ? (
                <div className="p-8 text-center text-sm text-stone-500">Loading timeline…</div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center text-sm text-stone-500">No activity yet</div>
              ) : (
                activities.map((a) => <ActivityRow key={a.id} a={a} />)
              )}
            </div>
          </TabsContent>

          {/* FOLLOW-UPS */}
          <TabsContent value="followups" className="m-0 p-6 space-y-4">
            {lead.next_followup_date && (
              <div className={cn(
                "border p-4",
                overdue ? "bg-rose-50 border-rose-300" : today ? "bg-orange-50 border-orange-300" : "bg-stone-50 border-stone-300",
              )}>
                <div className="flex items-center gap-2 label-uppercase">
                  {overdue ? <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> : <CalendarClock className="w-3.5 h-3.5 text-stone-700" />}
                  {overdue ? "Missed" : today ? "Due Today" : "Upcoming"}
                </div>
                <div className="mt-2 font-display text-xl tracking-tight text-stone-900">{formatDate(lead.next_followup_date)}</div>
                {lead.reminder_note && <div className="text-sm text-stone-700 mt-2">{lead.reminder_note}</div>}
              </div>
            )}
            {!lead.next_followup_date && (
              <div className="bg-stone-50 border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">No follow-up scheduled. Edit lead to add one.</div>
            )}
            <div>
              <div className="label-uppercase mb-2">Past activity</div>
              <div className="border border-stone-200 bg-white">
                {followups.length === 0 ? (
                  <div className="p-6 text-center text-sm text-stone-500">No past follow-ups logged</div>
                ) : (
                  followups.map((a) => <ActivityRow key={a.id} a={a} />)
                )}
              </div>
            </div>
          </TabsContent>

          {/* FILES — Lead Files backed by Google Drive + BMS registry */}
          <TabsContent value="files" className="m-0 p-6">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="label-uppercase mb-1">Files & Documents</div>
                  <h3 className="font-display text-xl tracking-tight text-stone-900">Lead Files</h3>
                  <p className="text-xs text-stone-500 mt-1">All files related to this lead — photos, plans, drawings, quotations and documents.</p>
                </div>
                <Button
                  type="button"
                  onClick={() => { setSelectedFile(null); setUploadOpen(true); }}
                  className="rounded-none bg-blue-700 hover:bg-blue-800 text-white h-9 text-xs font-semibold shrink-0"
                  data-testid="lead-files-upload-btn"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload File
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {LEAD_FILE_CATEGORIES.map((category) => {
                  const count = category.key === "all"
                    ? leadFiles.length
                    : leadFiles.filter((file) => file.category === category.key).length;
                  return (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => setActiveFileCategory(category.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border transition-colors",
                        activeFileCategory === category.key
                          ? "bg-blue-50 text-blue-700 border-blue-300"
                          : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                      )}
                    >
                      <category.Icon className="w-3 h-3" />
                      {category.label}
                      <span className="text-[10px] text-stone-400">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="border border-stone-200 bg-white">
                <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_80px] gap-3 px-4 py-3 bg-stone-50 border-b border-stone-200 text-[10px] tracking-[0.1em] uppercase font-semibold text-stone-500">
                  <span>File Name</span>
                  <span>Category</span>
                  <span>Source</span>
                  <span>Uploaded By / Date</span>
                  <span className="text-right">Actions</span>
                </div>

                {loadingLeadFiles ? (
                  <div className="min-h-[220px] flex items-center justify-center text-sm text-stone-500">Loading files…</div>
                ) : (activeFileCategory === "all" ? leadFiles : leadFiles.filter((file) => file.category === activeFileCategory)).length === 0 ? (
                  <div className="min-h-[260px] flex flex-col items-center justify-center px-8 py-10 text-center">
                    <div className="w-12 h-12 border border-stone-200 bg-stone-50 flex items-center justify-center mb-4">
                      <FolderOpen className="w-6 h-6 text-stone-300" />
                    </div>
                    <div className="font-display text-lg tracking-tight text-stone-800">No files uploaded yet</div>
                    <p className="text-sm text-stone-500 mt-1 max-w-md mx-auto">
                      Upload site photos, room photos, floor plans, drawings, reference images, quotations and other lead documents here.
                    </p>
                  </div>
                ) : (
                  <div>
                    {(activeFileCategory === "all" ? leadFiles : leadFiles.filter((file) => file.category === activeFileCategory)).map((file) => {
                      const category = LEAD_FILE_CATEGORIES.find((item) => item.key === file.category);
                      const uploadedBy = file.uploader?.full_name || file.uploader?.email || "—";
                      return (
                        <div key={file.id} className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_80px] gap-3 px-4 py-3 border-b border-stone-100 last:border-0 items-center">
                          <div className="min-w-0 flex items-center gap-2">
                            {String(file.file_type || "").startsWith("image/") ? <Image className="w-4 h-4 text-blue-600 shrink-0" /> : <FileType className="w-4 h-4 text-stone-500 shrink-0" />}
                            <span className="text-sm text-stone-800 truncate" title={file.file_name}>{file.file_name}</span>
                          </div>
                          <span className="text-xs text-stone-600">{category?.label || file.category || "Other"}</span>
                          <span className="text-xs text-stone-600">{file.source || "lead"}</span>
                          <div className="text-xs text-stone-600 min-w-0">
                            <div className="truncate">{uploadedBy}</div>
                            <div className="text-stone-400 mt-0.5">{formatDateTime(file.uploaded_at)}</div>
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Preview"
                              onClick={async () => {
                                try { await downloadLeadFile({ fileId: file.id, preview: true }); }
                                catch (e) { toast.error(e.message || "Could not preview file"); }
                              }}
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Download"
                              onClick={async () => {
                                try { await downloadLeadFile({ fileId: file.id }); }
                                catch (e) { toast.error(e.message || "Could not download file"); }
                              }}
                            >
                              <ArrowRightCircle className="w-4 h-4 rotate-90" />
                            </Button>
                            {isAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                title="Delete"
                                onClick={() => handleLeadFileDelete(file.id)}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {uploadOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-lg bg-white border border-stone-300 shadow-2xl">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
                    <div>
                      <div className="label-uppercase">Add Lead File</div>
                      <div className="font-display text-lg tracking-tight text-stone-900 mt-0.5">What are you uploading?</div>
                    </div>
                    <button type="button" onClick={() => { setUploadOpen(false); setSelectedFile(null); }} className="p-1.5 text-stone-500 hover:text-stone-900" aria-label="Close">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-5 space-y-5">
                    <div>
                      <div className="label-uppercase mb-2">File Category *</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {LEAD_FILE_CATEGORIES.filter((item) => item.key !== "all").map((category) => (
                          <button
                            key={category.key}
                            type="button"
                            onClick={() => setUploadCategory(category.key)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2.5 border text-left text-xs font-semibold",
                              uploadCategory === category.key
                                ? "border-blue-400 bg-blue-50 text-blue-700"
                                : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                            )}
                          >
                            <category.Icon className="w-3.5 h-3.5 shrink-0" />
                            {category.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="label-uppercase mb-2">Select File</div>
                      <label className="block border border-dashed border-stone-300 bg-stone-50 hover:bg-stone-100 cursor-pointer p-7 text-center">
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                        <FileText className="w-7 h-7 text-stone-400 mx-auto mb-2" />
                        <div className="text-sm font-semibold text-stone-800">
                          {selectedFile ? selectedFile.name : "Choose a file"}
                        </div>
                        <div className="text-xs text-stone-500 mt-1">
                          {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : "Images, PDF, drawings, quotations and documents"}
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-xs text-stone-500">
                        Category: <span className="font-semibold text-stone-800">{LEAD_FILE_CATEGORIES.find((item) => item.key === uploadCategory)?.label}</span>
                      </div>
                      <Button
                        type="button"
                        disabled={!selectedFile || uploadingLeadFile}
                        onClick={handleLeadFileUpload}
                        className="rounded-none h-9 bg-blue-700 hover:bg-blue-800 text-white disabled:bg-stone-300 disabled:text-stone-600"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> {uploadingLeadFile ? "Uploading…" : "Upload"}
                      </Button>
                    </div>
                    <p className="text-[11px] text-stone-400 border-t border-stone-100 pt-3">
                      The file will be uploaded to the lead's Google Drive folder and registered in BMS.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

const LEAD_FILE_CATEGORIES = [
  { key: "all", label: "All", Icon: FolderOpen },
  { key: "site_photo", label: "Site Photo", Icon: Image },
  { key: "room_photo", label: "Room Photo", Icon: Home },
  { key: "floor_plan", label: "Floor Plan", Icon: Map },
  { key: "drawing", label: "Drawing", Icon: Ruler },
  { key: "reference_image", label: "Reference Image", Icon: Image },
  { key: "pdf_document", label: "PDF / Document", Icon: FileType },
  { key: "quotation", label: "Quotation", Icon: Quote },
  { key: "customer_requirement", label: "Customer Requirement", Icon: FileSpreadsheet },
  { key: "other", label: "Other", Icon: FolderOpen },
];

function Section({ title, children }) {
  return (
    <div>
      <div className="label-uppercase mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border border-stone-200 bg-white p-4">{children}</div>
    </div>
  );
}

function Field({ label, value, icon, mono, full }) {
  return (
    <div className={cn(full && "col-span-2")}>
      <div className="text-[10px] tracking-[0.12em] uppercase font-semibold text-stone-500 flex items-center gap-1">
        {icon}{label}
      </div>
      <div className={cn("text-sm text-stone-900 mt-0.5 break-words", mono && "font-mono", !value && "text-stone-400")}>
        {value || "—"}
      </div>
    </div>
  );
}

function ActivityRow({ a }) {
  const meta = a.meta || {};
  const labels = { call: "Call Logged", note: "Note Added", status_change: "Lead Status Changed", followup: "Follow-up", schedule_created: "Meeting Scheduled", schedule_rescheduled: "Meeting Rescheduled", schedule_status_changed: "Meeting Status Changed", schedule_feedback_updated: "Meeting Feedback Updated", schedule_followup_updated: "Meeting Follow-up Updated", schedule_updated: "Meeting Updated", schedule_file_added: "Meeting File Added" };
  const Icon = a.type === "call" ? Phone : a.type === "status_change" ? History : a.type === "followup" ? CalendarClock : a.type === "schedule_created" ? CalendarDays : a.type === "schedule_rescheduled" ? RefreshCw : a.type === "schedule_status_changed" ? CheckCircle2 : a.type === "schedule_feedback_updated" ? MessageSquareText : a.type === "schedule_followup_updated" ? CalendarClock : a.type === "schedule_file_added" ? Paperclip : a.type === "schedule_updated" ? RefreshCw : NotebookPen;
  const tone = a.type === "call" ? "text-emerald-700 bg-emerald-50" : a.type === "status_change" ? "text-blue-700 bg-blue-50" : a.type === "followup" ? "text-orange-700 bg-orange-50" : a.type === "schedule_created" ? "text-blue-700 bg-blue-50" : a.type === "schedule_rescheduled" ? "text-orange-700 bg-orange-50" : a.type === "schedule_status_changed" ? "text-emerald-700 bg-emerald-50" : a.type === "schedule_feedback_updated" ? "text-violet-700 bg-violet-50" : a.type === "schedule_followup_updated" ? "text-amber-700 bg-amber-50" : a.type === "schedule_file_added" ? "text-sky-700 bg-sky-50" : "text-stone-700 bg-stone-50";
  const actor = a.creator?.full_name || a.creator?.email;
  return (
    <div className="px-4 py-3 border-b border-stone-100 last:border-0 flex items-start gap-3 hover:bg-stone-50/70 transition-colors">
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border border-stone-200 shrink-0", tone)}><Icon className="w-3.5 h-3.5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap"><div className="text-[10px] tracking-[0.12em] uppercase font-semibold text-stone-600">{labels[a.type] || a.type.replace(/_/g, " ")}</div><div className="text-xs text-stone-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(a.created_at)}</div></div>
        {a.type === "call" && meta.attempt_number && <div className="mt-1.5 inline-flex items-center gap-2 text-[11px] text-stone-500"><span className="font-semibold text-stone-700">Attempt #{meta.attempt_number}</span><span>·</span><span>{meta.outcome === "connected" ? "Connected" : "Not Connected"}</span>{meta.status_changed && <span className="text-emerald-700 font-medium">· First contact</span>}</div>}
        {a.content && (a.type === "schedule_file_added" && meta.schedule_file_id ? (
          <button type="button" onClick={async () => { try { await downloadGoogleDriveFile({ fileId: meta.schedule_file_id, recordId: meta.schedule_id }); } catch (e) { toast.error(e.message || "Could not open file"); } }} className="text-left text-sm text-blue-700 hover:text-blue-900 hover:underline mt-1 whitespace-pre-wrap cursor-pointer">
            {a.content}
          </button>
        ) : (
          <div className="text-sm text-stone-900 mt-1 whitespace-pre-wrap">{a.content}</div>
        ))}
        {a.type.startsWith("schedule_") && meta.meeting_type && <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-stone-500"><span>{String(meta.meeting_type).replace(/_/g, " ")}</span>{meta.mode && <span>· {meta.mode}</span>}{meta.status && <span>· {String(meta.status).replace(/_/g, " ")}</span>}</div>}
        {actor && <div className="text-xs text-stone-500 mt-1 inline-flex items-center gap-1"><UserRound className="w-3 h-3" />{actor}</div>}
      </div>
    </div>
  );
}