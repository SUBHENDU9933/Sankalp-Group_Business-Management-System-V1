import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Phone, MessageCircle, Mail, Pencil, ArrowRightCircle, MapPin, IndianRupee,
  CalendarClock, Clock, NotebookPen, FileText, AlertTriangle, History, Calculator,
} from "lucide-react";
import { LEAD_PRIORITIES, formatDate, formatDateTime, formatINR, isOverdue, isToday } from "@/utils/format";
import { fetchLeadActivities, addLeadActivity } from "@/services/leadActivityService";
import { buildEstimatorUrl } from "@/services/estimateService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LeadDetailsSheet({ open, onOpenChange, lead, onEdit, onConvert }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open || !lead?.id) return;
    setTab("overview");
    setLoading(true);
    fetchLeadActivities(lead.id)
      .then(setActivities)
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [open, lead?.id]);

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
              <Field label="Assigned RM" value={lead.assigned_profile?.full_name || lead.assigned_profile?.email} />
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

          {/* FILES */}
          <TabsContent value="files" className="m-0 p-6">
            <div className="bg-stone-50 border border-dashed border-stone-300 p-10 text-center">
              <FileText className="w-8 h-8 text-stone-400 mx-auto mb-3" />
              <div className="font-display text-lg tracking-tight text-stone-900">File uploads</div>
              <p className="text-sm text-stone-500 mt-1">Coming soon — attach floor plans, reference images and quotations to each lead.</p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

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
  const Icon = a.type === "call" ? Phone : a.type === "status_change" ? History : a.type === "followup" ? CalendarClock : NotebookPen;
  const tone = a.type === "call" ? "text-emerald-700 bg-emerald-50" : a.type === "status_change" ? "text-blue-700 bg-blue-50" : a.type === "followup" ? "text-orange-700 bg-orange-50" : "text-stone-700 bg-stone-50";
  return (
    <div className="px-4 py-3 border-b border-stone-100 last:border-0 flex items-start gap-3">
      <div className={cn("w-7 h-7 flex items-center justify-center border border-stone-200 shrink-0", tone)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">{a.type.replace("_"," ")}</div>
          <div className="text-xs text-stone-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(a.created_at)}</div>
        </div>
        {a.content && <div className="text-sm text-stone-900 mt-1 whitespace-pre-wrap">{a.content}</div>}
        {a.creator && <div className="text-xs text-stone-500 mt-1">by {a.creator.full_name || a.creator.email}</div>}
      </div>
    </div>
  );
}
