import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  Copy, ExternalLink, FileUp, Filter, Link2, ListFilter, MapPin, MessageCircle,
  MessageSquareText, MoreVertical, Plus, RefreshCw, Search, SlidersHorizontal,
  Users, X, XCircle, Video, Phone, Building2, Home, Target, UserRound,
  ArrowUpRight, RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProfiles } from "@/services/profileService";
import { fetchLeadOptions, updateLead } from "@/services/leadService";
import { fetchCustomers } from "@/services/customerService";
import {
  completeSchedule, createSchedule, fetchScheduleFiles, fetchSchedules, updateSchedule, lifecycleAction, fetchScheduleHistory,
  uploadScheduleFile, fetchMeetingRule, fetchCalendarStatus, checkCalendarAvailability,
  syncScheduleToCalendar, syncPendingCalendar
} from "@/services/scheduleService";

const TYPES = [
  ["site_visit", "Site Visit"], ["customer_home", "Customer Home"], ["office_meeting", "Office Meeting"],
  ["measurement_visit", "Measurement"], ["project_review", "Project Review"], ["material_discussion", "Material Discussion"],
  ["video_meeting", "Video Meeting"], ["design_presentation", "Design Presentation"],
  ["estimate_discussion", "Estimate Discussion"], ["phone_discussion", "Phone Discussion"],
  ["whatsapp_discussion", "WhatsApp Discussion"], ["follow_up", "Follow-up"], ["other", "Other"]
];
const FEEDBACKS = ["Interested", "Need Discussion", "Budget Issue", "Design Discussion", "Follow-up Required", "Not Interested", "Ready for Next Step"];
const DATE_TABS = [
  ["today", "Today"], ["scheduled", "Scheduled"], ["next3", "Next 3 Days"],
  ["next7", "Next 7 Days"], ["previous", "Previous"], ["all", "All"]
];

const localDate = (d = new Date()) => {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const localInput = (d = new Date()) => `${localDate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const slotIso = (date, h, m) => { const d = new Date(`${date}T00:00:00`); d.setHours(h, m, 0, 0); return d.toISOString(); };
const label = v => String(v || "").replaceAll("_", " ").replace(/\b\w/g, m => m.toUpperCase());
const fmtTime = iso => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const fmtDate = iso => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const dayKey = iso => localDate(new Date(iso));
const sameDay = (a, b) => dayKey(a) === dayKey(b);
const startDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const overlaps = (a, b, s, e) => new Date(a).getTime() < new Date(e).getTime() && new Date(b).getTime() > new Date(s).getTime();
const whatsappNumber = value => {
  const digits = String(value || "").replace(/\\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits;
};
const whatsappUrl = (phone, message) => {
  const text = encodeURIComponent(message || "");
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
};
const copyText = async text => {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) { return false; }
};


const statusMeta = {
  scheduled: { label: "Scheduled", cls: "bg-blue-50 text-blue-700 border-blue-100", dot: "bg-blue-600" },
  confirmed: { label: "Confirmed", cls: "bg-cyan-50 text-cyan-700 border-cyan-100", dot: "bg-cyan-600" },
  pending_confirmation: { label: "Pending Confirmation", cls: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-600" },
  rescheduled: { label: "Rescheduled", cls: "bg-orange-50 text-orange-700 border-orange-100", dot: "bg-orange-500" },
  customer_cancelled: { label: "Customer Cancelled", cls: "bg-rose-50 text-rose-700 border-rose-100", dot: "bg-rose-600" },
  cancelled: { label: "Cancelled", cls: "bg-rose-50 text-rose-700 border-rose-100", dot: "bg-rose-600" },
  no_show: { label: "No Show", cls: "bg-violet-50 text-violet-700 border-violet-100", dot: "bg-violet-600" }
};

function StatusBadge({ status }) {
  const m = statusMeta[status] || { label: label(status), cls: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" };
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${m.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
}

function ModeBadge({ mode }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${mode === "physical" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>
    {mode === "physical" ? <MapPin className="w-3 h-3" /> : <Video className="w-3 h-3" />}{mode}
  </span>;
}

export default function SchedulePage() {
  const { profile, role, isAdmin } = useAuth();
  const [rows, setRows] = useState([]), [leads, setLeads] = useState([]), [customers, setCustomers] = useState([]), [team, setTeam] = useState([]);
  const [selected, setSelected] = useState(null), [files, setFiles] = useState([]), [history, setHistory] = useState([]), [lifecycle, setLifecycle] = useState(null);
  const [loading, setLoading] = useState(true), [showCreate, setShowCreate] = useState(false), [loadError, setLoadError] = useState("");
  const [calendar, setCalendar] = useState(null), [rule, setRule] = useState(null);
  const [slots, setSlots] = useState([]), [checking, setChecking] = useState(false), [syncing, setSyncing] = useState(false), [availabilityNote, setAvailabilityNote] = useState("");
  const [titleManual, setTitleManual] = useState(false);
  const [partyType, setPartyType] = useState("lead");
  const [dateTab, setDateTab] = useState("today"), [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("list"), [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState("date_asc");
  const [filters, setFilters] = useState({
    owner: "", assignedBy: "", manager: "", status: "", type: "", mode: "", priority: "", lead: "", calendar: "", from: "", to: ""
  });
  const [form, setForm] = useState({
    lead_id: "", customer_id: "", title: "", meeting_type: "follow_up", mode: "digital", status: "scheduled",
    priority: "normal", date: localDate(), location_address: "", location_map_url: "", location_landmark: "", meeting_link: "",
    description: "", owner_id: "", arranged_by: "", comember_ids: [], manager_ids: [], director_id: "", customer_email: ""
  });

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const today = startDay(new Date());
      const from = addDays(today, -30).toISOString();
      const to = addDays(today, 31).toISOString();
      const [s, l, c, p, cal] = await Promise.all([
        fetchSchedules({ from, to }),
        fetchLeadOptions(),
        fetchCustomers(),
        fetchProfiles(),
        fetchCalendarStatus()
      ]);
      setRows(s || []); setLeads(l || []); setCustomers(c || []); setTeam(p || []); setCalendar(cal);
    } catch (e) {
      setLoadError(e.message || "Could not load schedules");
      toast.error(e.message || "Could not load schedules");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Lead Details -> "Meeting" opens the existing planner with that lead preselected.
  useEffect(() => {
    const leadId = new URLSearchParams(window.location.search).get("lead_id");
    if (!leadId || !leads.some(l => l.id === leadId)) return;
    setPartyType("lead");
    setForm(f => ({ ...f, lead_id: leadId, customer_id: "", meeting_type: "customer_home", mode: "physical" }));
    setShowCreate(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, [leads]);
  useEffect(() => {
    const saved = sessionStorage.getItem("sankalp_schedule_filters");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.filters) setFilters(x => ({ ...x, ...parsed.filters }));
        if (parsed.dateTab) setDateTab(parsed.dateTab);
        if (parsed.viewMode) setViewMode(parsed.viewMode);
      } catch (_) {}
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem("sankalp_schedule_filters", JSON.stringify({ filters, dateTab, viewMode }));
  }, [filters, dateTab, viewMode]);

  useEffect(() => {
    if (showCreate) fetchMeetingRule(form.meeting_type, form.mode).then(setRule).catch(e => toast.error(e.message));
  }, [showCreate, form.meeting_type, form.mode]);

  const activeTeam = useMemo(() => team.filter(p => p.is_active !== false), [team]);
  const leadMap = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);
  const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  useEffect(() => {
    if (showCreate && profile?.id) {
      setForm(f => ({ ...f, owner_id: null, arranged_by: f.arranged_by || profile.id, comember_ids: [] }));
      setTitleManual(false);
    }
  }, [showCreate, profile?.id]);

  useEffect(() => {
    if (!showCreate || titleManual) return;
    const lead = leadMap.get(form.lead_id);
    const customer = customerMap.get(form.customer_id);
    const customerName = lead?.name || customer?.name || "Customer";
    const typeName = label(form.meeting_type);
    const modeName = label(form.mode);
    const chosen = slots.find(s => s.selected);
    const when = chosen?.start
      ? new Date(chosen.start).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
      : (form.date ? new Date(form.date + "T12:00:00").toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "Date");
    const nextTitle = customerName + " — " + typeName + " · " + modeName + " · " + when;
    if (form.title !== nextTitle) setForm(f => ({ ...f, title: nextTitle }));
  }, [showCreate, titleManual, form.lead_id, form.customer_id, form.meeting_type, form.mode, form.date, slots, leadMap, customerMap]);

  const resetFilters = () => setFilters({ owner: "", assignedBy: "", manager: "", status: "", type: "", mode: "", priority: "", lead: "", calendar: "", from: "", to: "" });

  const dateFiltered = useMemo(() => {
    const today = startDay(new Date());
    const next3 = addDays(today, 3);
    const next7 = addDays(today, 7);
    return rows.filter(s => {
      const d = new Date(s.start_at);
      if (dateTab === "today") return sameDay(d, today);
      if (dateTab === "scheduled") return d >= today && !["completed", "cancelled", "customer_cancelled", "no_show"].includes(s.status);
      if (dateTab === "next3") return d >= today && d < next3;
      if (dateTab === "next7") return d >= today && d < next7;
      if (dateTab === "previous") return d < today;
      return true;
    });
  }, [rows, dateTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = dateFiltered.filter(s => {
      const lead = leadMap.get(s.lead_id);
      const owner = s.owner?.full_name || "";
      const participants = Array.isArray(s.participants) ? s.participants : [];
      const participantNames = participants.map(p => p.profile?.full_name).filter(Boolean).join(" ");
      const haystack = [s.title, s.location_address, s.location_landmark, owner, s.meeting_type, s.status, s.google_calendar_status, participantNames, lead?.name, lead?.phone, lead?.email, lead?.location, lead?.project_type].filter(Boolean).join(" ").toLowerCase();
      const managerOk = !filters.manager || participants.some(p => p.user_id === filters.manager && (p.profile?.role === "rm" || p.participant_role === "manager"));
      const dateOk = (!filters.from || new Date(s.start_at) >= startDay(new Date(filters.from))) &&
        (!filters.to || new Date(s.start_at) < addDays(startDay(new Date(filters.to)), 1));
      return (!q || haystack.includes(q)) &&
        (!filters.owner || s.owner_id === filters.owner) &&
        (!filters.assignedBy || s.assigned_by === filters.assignedBy) &&
        managerOk &&
        (!filters.calendar || (s.google_calendar_status || "not_synced") === filters.calendar) &&
        (!filters.status || s.status === filters.status) &&
        (!filters.type || s.meeting_type === filters.type) &&
        (!filters.mode || s.mode === filters.mode) &&
        (!filters.priority || s.priority === filters.priority) &&
        (!filters.lead || s.lead_id === filters.lead) && dateOk;
    });
    return [...result].sort((a, b) => {
      if (sort === "date_desc") return new Date(b.start_at) - new Date(a.start_at);
      if (sort === "priority") return ({ urgent: 0, high: 1, normal: 2, low: 3 }[a.priority] ?? 9) - ({ urgent: 0, high: 1, normal: 2, low: 3 }[b.priority] ?? 9);
      if (sort === "customer") return String(leadMap.get(a.lead_id)?.name || a.title).localeCompare(String(leadMap.get(b.lead_id)?.name || b.title));
      return new Date(a.start_at) - new Date(b.start_at);
    });
  }, [dateFiltered, query, filters, sort, leadMap]);

  const stats = useMemo(() => {
    const now = new Date();
    const active = rows.filter(s => !["cancelled", "customer_cancelled"].includes(s.status));
    return {
      today: rows.filter(s => sameDay(s.start_at, now)).length,
      upcoming: active.filter(s => new Date(s.start_at) >= now).length,
      overdue: active.filter(s => new Date(s.start_at) < now && s.status !== "completed").length,
      completed: rows.filter(s => s.status === "completed").length,
      outcome: rows.filter(s => s.status === "completed" && !s.feedback && !s.remarks).length,
      followup: rows.filter(s => s.next_action_date && new Date(s.next_action_date) < now && s.status !== "completed").length
    };
  }, [rows]);

  const attention = useMemo(() => [
    { label: "Meetings without outcome", count: stats.outcome, icon: MessageSquareText, tone: "amber" },
    { label: "Overdue follow-ups", count: stats.followup, icon: Clock3, tone: "rose" },
    { label: "Overdue meetings", count: stats.overdue, icon: AlertCircle, tone: "red" }
  ].filter(x => x.count > 0), [stats]);

  const days = useMemo(() => {
    const map = new Map();
    filtered.forEach(s => {
      const k = dayKey(s.start_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const checkAvailability = async () => {
    if (!form.arranged_by || !form.date) return toast.error("Meeting arranged by and date are required");
    if (!calendar?.configured || !calendar?.master_calendar_configured) return toast.error("Google Calendar is not fully connected yet");
    const coMemberIds = [...new Set((form.comember_ids || []).filter(Boolean))];
    setChecking(true); setSlots([]); setAvailabilityNote("");
    try {
      const dayStart = slotIso(form.date, 9, 0), dayEnd = slotIso(form.date, 20, 0);
      const duration = rule?.default_duration_minutes || 30, buffer = rule?.travel_buffer_minutes || 0;
      // Check the full active team so every slot can show who is already busy.
      const visibleTeamIds = activeTeam.map(p => p.id).filter(Boolean);
      const data = await checkCalendarAvailability({ start: dayStart, end: dayEnd, userIds: visibleTeamIds });
      const busy = data?.busy || [];
      const unconnected = new Set(data?.unconnected_user_ids || []);
      const selectedUnconnected = coMemberIds.filter(id => unconnected.has(id));
      if (selectedUnconnected.length) {
        const names = selectedUnconnected.map(id => activeTeam.find(p => p.id === id)?.full_name || "Selected member").join(", ");
        setAvailabilityNote("Calendar not connected for: " + names + ". Those members cannot be booked until their Google Calendar is connected.");
      }
      const found = [];
      const now = new Date();
      for (let h = 9; h < 20; h++) for (let m = 0; m < 60; m += 30) {
        const start = slotIso(form.date, h, m), end = slotIso(form.date, h, m + duration);
        const safeStart = new Date(new Date(start).getTime() - buffer * 60000).toISOString();
        const safeEnd = new Date(new Date(end).getTime() + buffer * 60000).toISOString();
        if (new Date(end) > new Date(dayEnd)) continue;
        const past = new Date(start) <= now;
        const overlappingBusy = busy.filter(b => overlaps(b.start, b.end, safeStart, safeEnd));
        const selectedBusy = overlappingBusy.filter(b => b.user_id && coMemberIds.includes(b.user_id));
        const selectedUnavailable = selectedUnconnected.length > 0;
        const blocked = past || selectedBusy.length > 0 || selectedUnavailable ||
          overlappingBusy.some(b => !b.user_id); // Company Master Calendar busy.
        const bookedBy = [...new Set(overlappingBusy.map(b => b.user_name || (b.user_id ? activeTeam.find(p => p.id === b.user_id)?.full_name : "Company Calendar")).filter(Boolean))];
        found.push({
          start, end, participantIds: coMemberIds,
          available: !blocked,
          past,
          bookedBy,
          reason: past ? "Time passed" : selectedUnavailable ? "Calendar not connected" : selectedBusy.length ? "Selected member is busy" : overlappingBusy.length ? "Company/team booking" : ""
        });
      }
      setSlots(found);
      if (!found.some(s => s.available)) toast.info("No selectable free slot found for the selected date and team");
    } catch (e) { toast.error(e.message || "Availability check failed"); }
    finally { setChecking(false); }
  };

  const save = async () => {
    const chosen = slots.find(s => s.selected);
    if (!chosen) return toast.error("Select an available slot first");
    if (form.mode === "physical" && !form.location_address.trim()) return toast.error("Physical schedule needs a site/location");
    setSyncing(true);
    try {
      // Final conflict check immediately before booking. The availability grid can become stale
      // if another user books the same slot after the initial check.
      const finalCheck = await checkCalendarAvailability({
        start: chosen.start,
        end: chosen.end,
        userIds: chosen.participantIds || []
      });
      const selectedIds = new Set(chosen.participantIds || []);
      const blocking = (finalCheck?.busy || []).filter(b => !b.user_id || selectedIds.has(b.user_id));
      if (blocking.length) {
        const names = [...new Set(blocking.map(b => b.user_name || "Company Calendar"))].join(", ");
        setSlots(x => x.map(s => s.start === chosen.start ? { ...s, selected: false, available: false, bookedBy: [...new Set([...s.bookedBy || [], ...blocking.map(b => b.user_name || "Company Calendar")])] } : s));
        throw Object.assign(new Error(`That slot is no longer available: ${names}`), { code: "SLOT_CONFLICT" });
      }
      if (form.lead_id && form.customer_email.trim()) {
        const lead = leadMap.get(form.lead_id);
        if ((lead?.email || "").trim() !== form.customer_email.trim()) await updateLead(form.lead_id, { email: form.customer_email.trim() });
      }
      const created = await createSchedule({
        lead_id: form.lead_id || null, customer_id: form.customer_id || null, title: form.title, meeting_type: form.meeting_type, mode: form.mode,
        status: "scheduled", priority: form.priority, start_at: chosen.start, end_at: chosen.end, timezone: "Asia/Kolkata",
        location_address: form.mode === "physical" ? form.location_address : null,
        location_map_url: form.mode === "physical" ? form.location_map_url || null : null,
        location_landmark: form.mode === "physical" ? form.location_landmark || null : null,
        meeting_link: form.mode === "digital" ? form.meeting_link || null : null,
        description: form.description || null, owner_id: null, arranged_by: form.arranged_by || profile?.id || null, assigned_by: profile?.id || null,
        customer_email: form.customer_email || null
      }, chosen.participantIds, chosen.participantIds);
      if (calendar?.master_calendar_configured) {
        await syncScheduleToCalendar(created.id);
        toast.success("Schedule created and Company Master Calendar synced");
      } else toast.success("Schedule created");
      setShowCreate(false); setSlots([]); await load();
    } catch (e) {
      toast.error(e.code === "SLOT_CONFLICT" ? "That slot was just booked. Please select another slot." : e.message || "Could not create schedule");
    } finally { setSyncing(false); }
  };

  const manualRefreshSync = async () => {
    setSyncing(true);
    try {
      const result = await syncPendingCalendar(); await load();
      const synced = Number(result?.synced || 0), failed = Number(result?.failed || 0);
      toast.success(failed ? `Refresh complete • ${synced} synced • ${failed} failed` : `Refresh & Sync complete • ${synced} calendar sync${synced === 1 ? "" : "s"}`);
    } catch (e) { toast.error(e.message || "Refresh & Sync failed"); }
    finally { setSyncing(false); }
  };

  const open = async r => {
    setSelected({...r,lead:leadMap.get(r.lead_id)||null,customer:customerMap.get(r.customer_id)||null});
    try { const [f,h]=await Promise.all([fetchScheduleFiles(r.id),fetchScheduleHistory(r.id)]); setFiles(f); setHistory(h); } catch (_) { setFiles([]); setHistory([]); }
  };
  const update = async p => {
    if (!selected) return;
    try { const u=p.status==="completed"?await completeSchedule(selected.id,p):await updateSchedule(selected.id,p); setSelected({...selected,...u}); toast.success("Schedule updated"); await load(); }
    catch(e){toast.error(e.message||"Update failed");}
  };
  const runLifecycle = async(action,payload={}) => {
    if(!selected) return;
    if(action==="__close__"){setLifecycle(null);return;}
    try{
      const u=await lifecycleAction(selected.id,action,payload);
      if(action==="delete"){toast.success("Meeting deleted");setSelected(null);setLifecycle(null);await load();return;}
      setSelected({...selected,...u});setLifecycle(null);
      setHistory(await fetchScheduleHistory(selected.id));await load();
      toast.success(action==="reschedule"?"Meeting rescheduled":action==="cancel"?"Meeting cancelled":action==="no_show"?"No-show recorded":"Meeting completed");
    }catch(e){toast.error(e.message||"Could not process meeting");}
  };
  const upload = async file => {
    if (!file || !selected) return;
    try {
      const f = await uploadScheduleFile(selected.id, selected.lead_id, file, { source: selected.mode === "physical" ? "field_visit" : "employee" });
      setFiles(x => [f, ...x]); toast.success("File uploaded");
    } catch (e) { toast.error(e.message || "Upload failed"); }
  };

  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const calendarDays = useMemo(() => {
    const first = startDay(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1));
    const offset = first.getDay();
    const out = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(first, i - offset);
      const key = localDate(d);
      out.push({ d, key, count: rows.filter(s => dayKey(s.start_at) === key).length });
    }
    return out;
  }, [rows, calendarMonth]);

  return (
    <section className="p-4 lg:p-7 max-w-[1600px] mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-orange-600 font-bold">Customer Operations</div>
          <div className="flex items-center gap-3 mt-1"><h1 className="text-3xl font-display font-bold text-slate-950 dark:text-white tracking-tight">Schedule</h1><span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">Smart Planner</span></div>
          <p className="text-sm text-slate-500 mt-1">Meetings, availability, feedback and next actions — in one place.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={manualRefreshSync} disabled={syncing} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-60 shadow-sm flex items-center gap-2 text-sm font-semibold"><RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Refresh & Sync</span></button>
          <button onClick={() => setShowCreate(true)} className="h-10 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-lg shadow-blue-700/20 flex items-center gap-2 text-sm"><Plus className="w-4 h-4" />New Schedule</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-4">
        <div className="flex overflow-x-auto">
          {DATE_TABS.map(([key, name]) => {
            const count = key === "today" ? stats.today : key === "scheduled" ? rows.filter(s => new Date(s.start_at) >= new Date() && !["completed","cancelled","customer_cancelled","no_show"].includes(s.status)).length : key === "next3" ? rows.filter(s => new Date(s.start_at) >= startDay(new Date()) && new Date(s.start_at) < addDays(startDay(new Date()),3)).length : key === "next7" ? rows.filter(s => new Date(s.start_at) >= startDay(new Date()) && new Date(s.start_at) < addDays(startDay(new Date()),7)).length : key === "previous" ? rows.filter(s => new Date(s.start_at) < startDay(new Date())).length : rows.length;
            return <button key={key} onClick={() => setDateTab(key)} className={`min-w-[110px] flex-1 px-4 py-3.5 border-r last:border-r-0 text-left transition-colors ${dateTab === key ? "bg-blue-700 text-white" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}><div className="text-xs font-bold">{name}</div><div className={`text-[11px] mt-0.5 ${dateTab === key ? "text-blue-100" : "text-slate-400"}`}>{count} meetings</div></button>;
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {[
          ["Today", stats.today, CalendarDays, "blue"], ["Upcoming", stats.upcoming, Clock3, "orange"], ["Overdue", stats.overdue, AlertCircle, "rose"],
          ["Completed", stats.completed, CheckCircle2, "emerald"], ["Outcome Pending", stats.outcome, MessageSquareText, "violet"], ["Follow-up Due", stats.followup, Target, "amber"]
        ].map(([name, value, Icon, tone]) => <button key={name} onClick={() => name === "Outcome Pending" ? setFilters(f => ({ ...f, status: "completed" })) : name === "Completed" ? setFilters(f => ({ ...f, status: "completed" })) : null} className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{name}</span><span className={`w-8 h-8 rounded-xl grid place-items-center bg-${tone}-50 text-${tone}-600`}><Icon className="w-4 h-4" /></span></div>
          <div className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-2">{value}</div>
        </button>)}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="min-w-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-4">
            <div className="p-3.5 flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer, lead, phone, meeting, owner, location..." className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none text-sm" />
              </div>
              <button onClick={() => setFilterOpen(v => !v)} className={`h-10 px-4 rounded-xl border flex items-center gap-2 text-sm font-semibold ${filterOpen || Object.values(filters).some(Boolean) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700"}`}><SlidersHorizontal className="w-4 h-4" />Filters <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-slate-100">{Object.values(filters).filter(Boolean).length}</span></button>
              <select value={sort} onChange={e => setSort(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold bg-white"><option value="date_asc">Sort: Earliest</option><option value="date_desc">Sort: Latest</option><option value="priority">Sort: Priority</option><option value="customer">Sort: Customer</option></select>
              <div className="flex h-10 p-1 rounded-xl bg-slate-100">
                <button onClick={() => setViewMode("list")} className={`px-3 rounded-lg text-xs font-bold ${viewMode === "list" ? "bg-white shadow-sm text-blue-700" : "text-slate-500"}`}>List</button>
                <button onClick={() => setViewMode("timeline")} className={`px-3 rounded-lg text-xs font-bold ${viewMode === "timeline" ? "bg-white shadow-sm text-blue-700" : "text-slate-500"}`}>Timeline</button>
              </div>
            </div>
            {Object.values(filters).some(Boolean) && <div className="px-4 pb-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Active filters</span>
              {Object.entries(filters).filter(([,v]) => v).map(([key,value]) => {
                const names = { owner:"Owner", assignedBy:"Assigned By", manager:"Manager", status:"Status", type:"Meeting Type", mode:"Mode", priority:"Priority", lead:"Lead / Customer", calendar:"Calendar", from:"From", to:"To" };
                const collections = { owner:team, assignedBy:team, manager:activeTeam, lead:leads };
                const item = collections[key]?.find(x => x.id === value);
                const display = item ? (item.full_name || item.name) : (key === "calendar" ? label(value) : value);
                return <button key={key} onClick={() => setFilters(x => ({...x,[key]:""}))} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-bold hover:bg-blue-100">{names[key] || key}: {display}<X className="w-3 h-3" /></button>;
              })}
              <button onClick={() => { setQuery(""); resetFilters(); }} className="text-[11px] font-bold text-rose-600 hover:underline ml-1">Clear all</button>
            </div>}
            {filterOpen && <div className="border-t border-slate-100 p-4 bg-slate-50/60">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs font-bold text-slate-500 py-2">Quick date:</span>
                {[["today","Today"],["tomorrow","Tomorrow"],["next3","Next 3 Days"],["next7","Next 7 Days"],["month","This Month"],["previous","Previous"]].map(([k,n]) => <button key={k} onClick={() => {
                  const d = new Date(); const start = startDay(d);
                  if (k==="today") setFilters(x=>({...x,from:localDate(),to:localDate()}));
                  else if(k==="tomorrow"){ const t=addDays(start,1); setFilters(x=>({...x,from:localDate(t),to:localDate(t)})); }
                  else if(k==="next3") setFilters(x=>({...x,from:localDate(start),to:localDate(addDays(start,2))}));
                  else if(k==="next7") setFilters(x=>({...x,from:localDate(start),to:localDate(addDays(start,6))}));
                  else if(k==="month"){ const end=new Date(d.getFullYear(),d.getMonth()+1,0); setFilters(x=>({...x,from:localDate(new Date(d.getFullYear(),d.getMonth(),1)),to:localDate(end)})); }
                  else setDateTab("previous");
                }} className="px-3 py-1.5 rounded-lg border bg-white text-[11px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700">{n}</button>)}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ["Owner", "owner", team.filter(p => p.is_active !== false), "id", "full_name"],
                ["Assigned By", "assignedBy", team.filter(p => p.is_active !== false), "id", "full_name"],
                ["Co-Member", "manager", activeTeam, "id", "full_name"],
                ["Status", "status", Object.keys(statusMeta).map(k => ({ id: k, full_name: statusMeta[k].label })), "id", "full_name"],
                ["Meeting Type", "type", TYPES.map(([id, full_name]) => ({ id, full_name })), "id", "full_name"],
                ["Mode", "mode", [{ id: "physical", full_name: "Physical" }, { id: "digital", full_name: "Digital" }], "id", "full_name"],
                ["Priority", "priority", ["urgent","high","normal","low"].map(id => ({ id, full_name: label(id) })), "id", "full_name"],
                ["Lead / Customer", "lead", leads, "id", "name"],
                ["Calendar", "calendar", [{id:"synced",full_name:"Synced"},{id:"pending",full_name:"Pending"},{id:"failed",full_name:"Failed"},{id:"not_synced",full_name:"Not Synced"}], "id", "full_name"]
              ].map(([name, key, options, valueKey, labelKey]) => <label key={key} className="text-xs font-bold text-slate-500">{name}<select value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))} className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><option value="">All {name}s</option>{options.map(o => <option key={o[valueKey]} value={o[valueKey]}>{o[labelKey]}</option>)}</select></label>)}
              <label className="text-xs font-bold text-slate-500">From<input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" /></label>
              <label className="text-xs font-bold text-slate-500">To<input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" /></label>
              <button onClick={() => { setQuery(""); resetFilters(); }} className="h-10 self-end rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:text-blue-700 flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" />Clear All Filters</button>
            </div></div>}
          </div>

          {loading ? <div className="bg-white border rounded-2xl p-16 text-center"><RefreshCw className="w-7 h-7 mx-auto text-blue-600 animate-spin" /><div className="font-bold text-slate-700 mt-3">Loading schedules…</div><p className="text-sm text-slate-400 mt-1">Fetching meetings and customer details.</p></div> :
          loadError ? <div className="bg-white border border-rose-200 rounded-2xl p-16 text-center"><AlertCircle className="w-10 h-10 mx-auto text-rose-400" /><div className="font-bold text-slate-700 mt-3">Couldn’t load schedules</div><p className="text-sm text-slate-400 mt-1">{loadError}</p><button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-bold">Try Again</button></div> :
          filtered.length === 0 ? <div className="bg-white border rounded-2xl p-16 text-center"><CalendarDays className="w-10 h-10 mx-auto text-slate-300" /><div className="font-bold text-slate-700 mt-3">No meetings found</div><p className="text-sm text-slate-400 mt-1">{query || Object.values(filters).some(Boolean) ? "Try another search, date range, or clear your filters." : "There are no meetings in this view yet."}</p>{(query || Object.values(filters).some(Boolean)) && <button onClick={() => { setQuery(""); resetFilters(); }} className="mt-4 px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-bold">Clear Search & Filters</button>}</div> :
          viewMode === "timeline" ? <div className="space-y-4">{days.map(([date, items]) => <div key={date} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"><div className="px-5 py-3 bg-slate-50 border-b flex items-center justify-between"><div className="font-bold text-slate-900">{new Date(date + "T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long"})}</div><span className="text-xs font-bold text-slate-400">{items.length} meetings</span></div><div className="p-4 space-y-2">{items.map(s => <ScheduleRow key={s.id} s={s} lead={leadMap.get(s.lead_id)} onOpen={open} />)}</div></div>)}</div> :
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"><div className="hidden lg:grid grid-cols-[130px_minmax(250px,1fr)_190px_150px_130px] gap-4 px-5 py-3 bg-slate-50/80 border-b text-[10px] uppercase tracking-wider font-bold text-slate-400"><div>Date & Time</div><div>Meeting / Customer</div><div>Owner</div><div>Mode</div><div>Status</div></div><div className="divide-y">{filtered.map(s => <ScheduleRow key={s.id} s={s} lead={leadMap.get(s.lead_id)} onOpen={open} />)}</div></div>}
        </div>

        <aside className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 flex items-center justify-between"><div><div className="font-display font-bold text-slate-900">{calendarMonth.toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</div><div className="text-[11px] text-slate-400 mt-0.5">Meeting activity</div></div><div className="flex gap-1"><button onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))} className="w-7 h-7 rounded-lg border grid place-items-center"><ChevronLeft className="w-4 h-4" /></button><button onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))} className="w-7 h-7 rounded-lg border grid place-items-center"><ChevronRight className="w-4 h-4" /></button></div></div>
            <div className="px-3 pb-3 grid grid-cols-7 gap-1 text-center">
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="text-[10px] font-bold text-slate-400 py-1">{d}</div>)}
              {calendarDays.map(x => <button key={x.key} onClick={() => { setDateTab("all"); setFilters(f => ({ ...f, from: x.key, to: x.key })); }} className={`relative h-8 rounded-lg text-xs ${x.key === localDate() ? "bg-blue-700 text-white font-bold" : "hover:bg-blue-50 text-slate-600"}`}>{x.d.getDate()}{x.count > 0 && <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${x.key === localDate() ? "bg-white" : "bg-orange-500"}`} />}</button>)}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between"><div className="font-bold text-slate-900">Today’s Overview</div><button onClick={() => setDateTab("today")} className="text-xs font-bold text-blue-700">View Today</button></div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-xl bg-blue-50 p-3"><div className="text-[10px] font-bold text-blue-600 uppercase">Physical</div><div className="text-xl font-bold text-blue-900 mt-1">{rows.filter(s => sameDay(s.start_at,new Date()) && s.mode === "physical").length}</div></div>
              <div className="rounded-xl bg-violet-50 p-3"><div className="text-[10px] font-bold text-violet-600 uppercase">Digital</div><div className="text-xl font-bold text-violet-900 mt-1">{rows.filter(s => sameDay(s.start_at,new Date()) && s.mode === "digital").length}</div></div>
              <div className="rounded-xl bg-emerald-50 p-3"><div className="text-[10px] font-bold text-emerald-600 uppercase">Completed</div><div className="text-xl font-bold text-emerald-900 mt-1">{rows.filter(s => sameDay(s.start_at,new Date()) && s.status === "completed").length}</div></div>
              <div className="rounded-xl bg-orange-50 p-3"><div className="text-[10px] font-bold text-orange-600 uppercase">Upcoming</div><div className="text-xl font-bold text-orange-900 mt-1">{rows.filter(s => sameDay(s.start_at,new Date()) && new Date(s.start_at) >= new Date()).length}</div></div>
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${attention.length ? "bg-rose-50/70 border-rose-100" : "bg-emerald-50/70 border-emerald-100"}`}>
            <div className="flex items-center justify-between"><div className="font-bold text-slate-900">Needs Attention</div><span className={`text-xs font-bold ${attention.length ? "text-rose-600" : "text-emerald-600"}`}>{attention.reduce((a,b)=>a+b.count,0)}</span></div>
            {attention.length ? <div className="mt-3 space-y-2">{attention.map(a => <button key={a.label} onClick={() => a.label.includes("outcome") ? setFilters(f=>({...f,status:"completed"})) : null} className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/80 border border-white text-left"><span className="flex items-center gap-2 text-xs font-semibold text-slate-700"><a.icon className="w-4 h-4 text-rose-500" />{a.label}</span><span className="font-bold text-rose-600">{a.count}</span></button>)}</div> : <div className="mt-3 text-xs text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Everything looks under control.</div>}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="font-bold text-slate-900">Quick Actions</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={() => setShowCreate(true)} className="p-3 rounded-xl bg-blue-700 text-white text-xs font-bold flex items-center gap-2"><Plus className="w-4 h-4" />New Schedule</button>
              <button onClick={() => setDateTab("today")} className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2"><CalendarDays className="w-4 h-4" />Today</button>
              <button onClick={manualRefreshSync} className="p-3 rounded-xl bg-orange-50 text-orange-700 text-xs font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4" />Sync</button>
              <button onClick={() => setFilterOpen(true)} className="p-3 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold flex items-center gap-2"><Filter className="w-4 h-4" />Filters</button>
            </div>
          </div>
        </aside>
      </div>

      {lifecycle && selected && <LifecycleModal action={lifecycle} selected={selected} run={runLifecycle} />}\n      {showCreate && <CreateModal form={form} setForm={setForm} rule={rule} team={team} activeTeam={activeTeam} calendar={calendar} slots={slots} setSlots={setSlots} checking={checking} checkAvailability={checkAvailability} save={save} saving={syncing} close={() => { setShowCreate(false); setSlots([]); setTitleManual(false); }} availabilityNote={availabilityNote} leads={leads} customers={customers} partyType={partyType} setPartyType={setPartyType} setTitleManual={setTitleManual} />}
      {selected && <DetailModal selected={selected} files={files} history={history} update={update} upload={upload} openLifecycle={setLifecycle} close={() => setSelected(null)} syncCalendar={async()=>{try{const result=await syncScheduleToCalendar(selected.id);setSelected(s=>({...s,meeting_link:result?.meeting_link||s.meeting_link,google_calendar_url:result?.event_url||s.google_calendar_url,google_calendar_event_id:result?.event_id||s.google_calendar_event_id,google_calendar_status:"synced"}));toast.success("Google Meet generated and calendar synced");await load();}catch(e){toast.error(e.message||"Calendar sync failed")}}} />}
    </section>
  );
}

function LifecycleModal({action,selected,run}){
 const [reason,setReason]=useState(""),[reasonText,setReasonText]=useState(""),[notes,setNotes]=useState("");
 const [start,setStart]=useState(localInput(new Date(selected.start_at))),[end,setEnd]=useState(localInput(new Date(selected.end_at||new Date(new Date(selected.start_at).getTime()+30*60000))));
 const [outcome,setOutcome]=useState(""),[stage,setStage]=useState(selected.lead_stage_after||"estimate_to_be_created"),[feedback,setFeedback]=useState(selected.feedback||""),[remarks,setRemarks]=useState(selected.remarks||""),[nextAction,setNextAction]=useState(selected.next_action||""),[nextDate,setNextDate]=useState(selected.next_action_date||""),[saving,setSaving]=useState(false);
 const RESCHEDULE=[["customer_requested","Customer Requested"],["employee_unavailable","Employee Unavailable"],["customer_not_available","Customer Not Available"],["site_not_ready","Site Not Ready"],["material_design_pending","Material / Design Pending"],["travel_issue","Travel Issue"],["weather_issue","Weather Issue"],["internal_schedule_conflict","Internal Schedule Conflict"],["other","Other"]];
 const CANCEL=[["customer_cancelled","Customer Cancelled"],["customer_not_available","Customer Not Available"],["customer_not_interested","Customer Not Interested"],["customer_requested_later","Customer Requested Later"],["employee_unavailable","Employee Unavailable"],["site_not_ready","Site Not Ready"],["budget_issue","Budget Issue"],["project_on_hold","Project On Hold"],["duplicate_meeting","Duplicate Meeting"],["wrong_schedule","Wrong Schedule"],["internal_reason","Internal Reason"],["other","Other"]];
 const OUTCOMES=[["highly_interested","Highly Interested"],["interested","Interested"],["needs_more_discussion","Needs More Discussion"],["estimate_required","Estimate Required"],["design_required","Design Required"],["site_measurement_required","Site Measurement Required"],["follow_up_required","Follow-up Required"],["budget_issue","Budget Issue"],["customer_not_interested","Customer Not Interested"],["project_on_hold","Project On Hold"],["converted_booking_expected","Converted / Booking Expected"],["other","Other"]];
 const STAGES=[["new","New"],["contacted","Contacted"],["site_visit","Ready for Meeting"],["floor_plan_site_info","Meeting / Visit Scheduled"],["estimate_to_be_created","Meeting Done · Ready for Estimate"],["quotation_given","Estimate Given"],["need_followup","Closing Follow-up"],["converted","Converted"]];
 const reasons=action==="reschedule"?RESCHEDULE:CANCEL;
 const submit=async()=>{setSaving(true);try{if(action==="reschedule"){const s=new Date(start),e=new Date(end);if(!start||!end||e<=s)throw new Error("Select a valid new time");await run(action,{start_at:s.toISOString(),end_at:e.toISOString(),reason_code:reason,reason_text:reasonText,notes});}else if(action==="cancel"||action==="no_show"){if(!reason)throw new Error("Reason is required");await run(action,{reason_code:reason,reason_text:reasonText,notes});}else if(action==="complete"){if(!outcome||!stage)throw new Error("Outcome and Lead Stage are required");await run(action,{outcome_type:outcome,lead_stage_after:stage,feedback,remarks,next_action:nextAction,next_action_date:nextDate,notes});}else if(action==="delete"){await run(action,{notes});}}catch(e){toast.error(e.message||"Could not process meeting")}finally{setSaving(false)}};
 const title={reschedule:"Reschedule Meeting",cancel:"Cancel Meeting",no_show:"Record No-Show",complete:"Complete Meeting",delete:"Delete Meeting"}[action];
 return <div className="fixed inset-0 z-[60] bg-slate-950/50 p-4 flex items-center justify-center"><div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-auto shadow-2xl"><div className="sticky top-0 bg-white border-b p-5 flex justify-between"><div><h3 className="text-xl font-bold">{title}</h3><div className="text-xs text-slate-500 mt-1">{selected.title}</div></div><button onClick={()=>run("__close__")} className="w-9 h-9 rounded-xl hover:bg-slate-100">×</button></div><div className="p-5 space-y-4">
 {action==="reschedule"&&<><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">New Start<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="mt-1 w-full h-10 border rounded-xl px-3"/></label><label className="text-xs font-bold">New End<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className="mt-1 w-full h-10 border rounded-xl px-3"/></label></div><ReasonPicker values={RESCHEDULE} value={reason} setValue={setReason}/></>}
 {(action==="cancel"||action==="no_show")&&<ReasonPicker values={reasons} value={reason} setValue={setReason}/>}
 {(action==="reschedule"||action==="cancel"||action==="no_show")&&<label className="text-xs font-bold">Reason / Notes<textarea value={reasonText} onChange={e=>setReasonText(e.target.value)} rows={3} className="mt-1 w-full border rounded-xl p-3 font-normal"/></label>}
 {action==="complete"&&<><label className="text-xs font-bold">Meeting Outcome *<select value={outcome} onChange={e=>setOutcome(e.target.value)} className="mt-1 w-full h-10 border rounded-xl px-3"><option value="">Select outcome</option>{OUTCOMES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="text-xs font-bold">Lead Stage After Meeting *<select value={stage} onChange={e=>setStage(e.target.value)} className="mt-1 w-full h-10 border rounded-xl px-3"><option value="">Select stage</option>{STAGES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="text-xs font-bold">Customer Feedback<textarea value={feedback} onChange={e=>setFeedback(e.target.value)} rows={3} className="mt-1 w-full border rounded-xl p-3 font-normal"/></label><label className="text-xs font-bold">Employee Remarks<textarea value={remarks} onChange={e=>setRemarks(e.target.value)} rows={3} className="mt-1 w-full border rounded-xl p-3 font-normal"/></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">Next Action<input value={nextAction} onChange={e=>setNextAction(e.target.value)} className="mt-1 w-full h-10 border rounded-xl px-3 font-normal"/></label><label className="text-xs font-bold">Next Action Date<input type="date" value={nextDate} onChange={e=>setNextDate(e.target.value)} className="mt-1 w-full h-10 border rounded-xl px-3 font-normal"/></label></div></>}
 {action==="delete"&&<><div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">Delete is an administrative soft-delete. The meeting remains in audit history.</div><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} className="w-full border rounded-xl p-3 text-sm" placeholder="Optional delete note"/></>}
 </div><div className="border-t p-4 flex justify-end gap-2"><button onClick={()=>run("__close__")} className="px-4 py-2.5 rounded-xl border font-semibold">Close</button><button disabled={saving} onClick={submit} className="px-5 py-2.5 rounded-xl bg-blue-700 text-white font-bold disabled:opacity-50">{saving?"Processing…":action==="delete"?"Delete Meeting":"Save"}</button></div></div></div>;
}
function ReasonPicker({values,value,setValue}){return <div><div className="text-xs font-bold mb-2">Quick Reason *</div><div className="flex flex-wrap gap-2">{values.map(([v,l])=><button type="button" key={v} onClick={()=>setValue(v)} className={value===v?"px-3 py-2 rounded-full bg-blue-700 text-white text-xs font-bold":"px-3 py-2 rounded-full border bg-slate-50 text-xs font-bold"}>{l}</button>)}</div></div>;}

function ScheduleRow({ s, lead, onOpen }) {
  const owner = s.arranger?.full_name || s.owner?.full_name || "Unassigned";
  const customer = lead?.name || s.title || "Untitled meeting";
  const isToday = sameDay(s.start_at, new Date());
  return <button onClick={() => onOpen(s)} className="w-full text-left p-4 lg:px-5 hover:bg-blue-50/40 transition-colors grid lg:grid-cols-[130px_minmax(250px,1fr)_190px_150px_130px] gap-3 lg:gap-4 items-center">
    <div><div className="text-sm font-bold text-slate-900">{fmtTime(s.start_at)}</div><div className="text-[11px] text-slate-400 mt-0.5">{isToday ? "Today" : fmtDate(s.start_at)}</div></div>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="font-bold text-sm text-slate-900 truncate">{customer}</span>{s.priority && s.priority !== "normal" && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${s.priority === "urgent" ? "bg-rose-100 text-rose-700" : "bg-orange-100 text-orange-700"}`}>{s.priority}</span>}</div><div className="text-xs text-slate-500 mt-1 truncate">{s.title}{lead?.project_type ? ` · ${lead.project_type}` : ""}</div><div className="flex flex-wrap gap-1.5 mt-2"><span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold">{label(s.meeting_type)}</span>{s.location_address && <span className="text-[10px] text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location_address}</span>}</div></div>
    <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 grid place-items-center text-xs font-bold">{owner.slice(0,1).toUpperCase()}</span><div className="min-w-0"><div className="text-xs font-bold text-slate-700 truncate">{owner}</div><div className="text-[10px] text-slate-400">Meeting arranged by</div></div></div>
    <div><ModeBadge mode={s.mode} /></div>
    <div className="flex items-center justify-between gap-2"><StatusBadge status={s.status} /><MoreVertical className="w-4 h-4 text-slate-300" /></div>
  </button>;
}

function CreateModal({ form, setForm, rule, team, activeTeam, calendar, slots, setSlots, checking, checkAvailability, save, saving, close, leads, customers, partyType, setPartyType, setTitleManual, availabilityNote }) {
  return <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm p-4 flex items-center justify-center"><div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-auto shadow-2xl"><div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b p-5 flex justify-between"><div><div className="text-[10px] uppercase tracking-[0.18em] text-orange-600 font-bold">New Activity</div><h2 className="text-xl font-display font-bold mt-1">Create Schedule</h2><p className="text-xs text-slate-500 mt-1">Choose the team, check availability and confirm the meeting.</p></div><button onClick={close} className="w-9 h-9 rounded-xl hover:bg-slate-100 grid place-items-center"><X className="w-5 h-5 text-slate-500" /></button></div><div className="p-5 grid md:grid-cols-2 gap-4">
    <LeadCustomerPicker
      partyType={partyType}
      setPartyType={type => {
        setPartyType(type);
        setSlots([]);
        setForm(f => ({ ...f, lead_id: "", customer_id: "", customer_email: "" }));
      }}
      leads={leads}
      customers={customers}
      selectedLeadId={form.lead_id}
      selectedCustomerId={form.customer_id}
      onSelectLead={lead => setForm(f => ({ ...f, lead_id: lead?.id || "", customer_id: "", customer_email: lead?.email || "" }))}
      onSelectCustomer={customer => setForm(f => ({ ...f, lead_id: "", customer_id: customer?.id || "", customer_email: customer?.email || "" }))}
    />
    <label className="text-xs font-bold text-slate-600">Meeting Arranged By / Generated By<select value={form.arranged_by || ""} onChange={e=>{setForm({...form,arranged_by:e.target.value});setSlots([])}} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm"><option value="">Select employee</option>{activeTeam.map(p=><option key={p.id} value={p.id}>{p.full_name||p.email}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-600 md:col-span-2">Meeting Title <span className="text-slate-400 font-normal">• auto-generated, editable</span><input value={form.title} onChange={e=>{setTitleManual(true);setForm({...form,title:e.target.value})}} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm" placeholder="Rahul Kumar — Site Visit" /></label>
    <label className="text-xs font-bold text-slate-600">Meeting Type<select value={form.meeting_type} onChange={e=>{setForm({...form,meeting_type:e.target.value});setSlots([])}} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm">{TYPES.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-600">Mode<select value={form.mode} onChange={e=>{setForm({...form,mode:e.target.value});setSlots([])}} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm"><option value="physical">Physical</option><option value="digital">Digital</option></select></label>
    <label className="text-xs font-bold text-slate-600">Meeting Date<input type="date" value={form.date} onChange={e=>{setForm({...form,date:e.target.value});setSlots([])}} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm" /></label>
    <CoMemberPicker team={activeTeam} ids={form.comember_ids||[]} setIds={ids=>{setForm({...form,comember_ids:ids});setSlots([])}} />
    {form.mode==="physical"?<div className="md:col-span-2 grid md:grid-cols-3 gap-3"><label className="text-xs font-bold text-slate-600">Google Maps Link<input value={form.location_map_url} onChange={e=>setForm({...form,location_map_url:e.target.value})} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm" placeholder="Google Maps link" /></label><label className="text-xs font-bold text-slate-600">Address<input value={form.location_address} onChange={e=>setForm({...form,location_address:e.target.value})} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm" placeholder="Customer site address" /></label><label className="text-xs font-bold text-slate-600">Landmark<input value={form.location_landmark} onChange={e=>setForm({...form,location_landmark:e.target.value})} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm" placeholder="Nearby landmark" /></label></div>:<label className="text-xs font-bold text-slate-600 md:col-span-2">Meeting Link <span className="text-slate-400 font-normal">(optional)</span><input value={form.meeting_link} onChange={e=>setForm({...form,meeting_link:e.target.value})} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm" placeholder="Google Meet can be generated on sync" /></label>}
    <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="font-bold text-sm text-slate-800">Team Availability</div><div className="text-xs text-slate-500 mt-1">{calendar?.configured&&calendar?.master_calendar_configured?"Connected calendars will be checked together.":"Google Calendar connection is pending."}</div></div><button onClick={checkAvailability} disabled={checking||!calendar?.configured||!calendar?.master_calendar_configured} className="px-4 py-2.5 rounded-xl bg-blue-700 text-white text-xs font-bold disabled:opacity-50">{checking?"Checking…":"Check Available Slots"}</button></div>{availabilityNote&&<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{availabilityNote}</div>}
      {slots.length>0&&<div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">{slots.map((s,i)=><button key={i} type="button" disabled={!s.available} onClick={()=>s.available&&setSlots(x=>x.map((z,j)=>({...z,selected:j===i})))} className={s.selected?"px-3 py-2.5 rounded-xl bg-blue-700 text-white text-xs font-bold text-left":"px-3 py-2.5 rounded-xl border bg-white text-xs font-bold text-left disabled:opacity-60 disabled:cursor-not-allowed hover:border-blue-300"}>
        <div>{fmtTime(s.start)} – {fmtTime(s.end)}</div>
        {s.past?<div className="text-[10px] mt-1 font-semibold text-slate-400">Time passed</div>:s.bookedBy?.length?<div className="text-[10px] mt-1 font-semibold text-rose-600 truncate" title={s.bookedBy.join(", ")}>Booked: {s.bookedBy.join(", ")}</div>:<div className="text-[10px] mt-1 font-semibold text-emerald-600">Available</div>}
      </button>)}</div>}</div>
    <label className="text-xs font-bold text-slate-600">Customer Email <span className="text-slate-400 font-normal">• auto from lead; manual entry updates lead</span><input value={form.customer_email} onChange={e=>setForm({...form,customer_email:e.target.value})} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm" /></label>
    <label className="text-xs font-bold text-slate-600">Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></label>
    <label className="text-xs font-bold text-slate-600 md:col-span-2">Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3} className="mt-1.5 w-full border rounded-xl p-3 text-sm" placeholder="Purpose, customer expectations, preparation notes..." /></label>
  </div><div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-2"><button onClick={close} className="px-4 py-2.5 rounded-xl border text-sm font-semibold">Cancel</button><button disabled={saving||!slots.some(s=>s.selected)} onClick={save} className="px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-bold disabled:opacity-50">{saving?"Booking…":"Confirm Schedule"}</button></div></div></div>;
}

function LeadCustomerPicker({ partyType, setPartyType, leads, customers, selectedLeadId, selectedCustomerId, onSelectLead, onSelectCustomer }) {
  const [open, setOpen] = useState(false), [q, setQ] = useState("");
  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selected = partyType === "lead" ? selectedLead : selectedCustomer;
  const list = (partyType === "lead" ? leads : customers)
    .filter(item => {
      if (!q.trim()) return true;
      return [item.name, item.phone, item.email, item.location, item.area, item.address, item.project_details]
        .filter(Boolean).join(" ").toLowerCase().includes(q.trim().toLowerCase());
    })
    .slice(0, 80);

  return <div className="relative">
    <label className="text-xs font-bold text-slate-600">Lead / Customer</label>
    <div className="mt-1.5 flex gap-1 p-1 rounded-xl bg-slate-100">
      {[["lead", "Lead"], ["customer", "Customer"]].map(([value, name]) => <button
        type="button" key={value}
        onClick={() => { setPartyType(value); setOpen(false); setQ(""); }}
        className={`flex-1 h-8 rounded-lg text-xs font-bold transition-colors ${partyType === value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
      >{name}</button>)}
    </div>
    <button type="button" onClick={() => setOpen(v => !v)} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm text-left flex items-center justify-between">
      <span className={selected ? "text-slate-800" : "text-slate-400"}>
        {selected ? selected.name + (selected.phone ? " — " + selected.phone : "") : `Select ${partyType === "lead" ? "lead" : "customer"}`}
      </span>
      <ChevronRight className="w-4 h-4 rotate-90 text-slate-400"/>
    </button>
    {open && <div className="absolute z-30 left-0 right-0 mt-1 bg-white border rounded-2xl shadow-xl overflow-hidden">
      <div className="p-2 border-b"><div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
        <input autoFocus value={q} onChange={e=>setQ(e.target.value)} className="w-full h-9 border rounded-lg pl-9 pr-3 text-sm" placeholder={`Search ${partyType === "lead" ? "lead" : "customer"} name, phone, email...`}/>
      </div></div>
      <div className="max-h-64 overflow-auto">
        {list.map(item => <button type="button" key={item.id} onClick={() => {
          if (partyType === "lead") onSelectLead(item); else onSelectCustomer(item);
          setOpen(false); setQ("");
        }} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b last:border-b-0">
          <div className="text-sm font-semibold">{item.name || "No Name"}</div>
          <div className="text-[11px] text-slate-400">{[item.phone, item.email, item.location || item.address].filter(Boolean).join(" · ")}</div>
        </button>)}
        {!list.length && <div className="p-4 text-xs text-slate-400">No matching {partyType === "lead" ? "lead" : "customer"} found.</div>}
      </div>
    </div>}
  </div>;
}
function CoMemberPicker({ team, ids, setIds }) {
  const selected = new Set(ids);
  return <div className="md:col-span-2 text-xs font-bold text-slate-600">
    Assign Co-Member(s) <span className="text-slate-400 font-normal">• multiple employees can be selected; their calendars will be checked</span>
    <div className="mt-1.5 border rounded-xl p-2 max-h-40 overflow-auto grid sm:grid-cols-2 gap-1">
      {team.map(p => <label key={p.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer font-medium">
        <input type="checkbox" checked={selected.has(p.id)} onChange={()=>setIds(selected.has(p.id)?ids.filter(x=>x!==p.id):[...ids,p.id])}/>
        <span>{p.full_name || p.email}</span>
      </label>)}
      {!team.length && <div className="p-2 text-slate-400">No active employees available.</div>}
    </div>
  </div>;
}

function ManagerPicker({ managers, ids, setIds, multi, urgent }) {
  if (!multi) return <label className="text-xs font-bold text-slate-600">Manager<select value={ids[0]||""} onChange={e=>setIds(e.target.value?[e.target.value]:[])} className="mt-1.5 w-full h-10 border rounded-xl px-3 text-sm"><option value="">Any available manager</option>{managers.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>;
  return <div className="text-xs font-bold text-slate-600">Manager(s) <span className="text-slate-400 font-normal">• Admin/Director can assign multiple{urgent ? " • urgent/special case" : ""}</span><div className="mt-1.5 border rounded-xl p-2 max-h-32 overflow-auto space-y-1">{managers.map(p=><label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer font-medium"><input type="checkbox" checked={ids.includes(p.id)} onChange={()=>setIds(ids.includes(p.id)?ids.filter(x=>x!==p.id):[...ids,p.id])}/>{p.full_name}</label>)}<button type="button" onClick={()=>setIds([])} className="text-[11px] text-blue-700 font-bold px-2 py-1">Auto assign any available</button></div></div>;
}

function DetailModal({ selected, files, history, update, upload, openLifecycle, close, syncCalendar }) {
  const customer = selected.customer || selected.lead || {};
  const titleCaseName = value => String(value || "").trim().toLowerCase().replace(/\b\w/g, m => m.toUpperCase());
  const customerName = titleCaseName(customer.name || selected.title || "Customer");
  const customerPhone = customer.phone || customer.mobile || customer.whatsapp || "";
  const arranger = selected.arranger || selected.owner || null;
  const arrangerName = titleCaseName(arranger?.full_name || "Unassigned");
  const participantProfiles = (selected.participants || []).map(p => p.profile).filter(Boolean);
  const comembers = participantProfiles.filter(p => p.id !== arranger?.id);
  const comemberNames = comembers.map(p => titleCaseName(p.full_name || p.email)).filter(Boolean);
  const meetLink = selected.meeting_link || "";
  const meetingTypeName = {
    customer_home: "Customer Home Consultation",
    office_meeting: "Office Meeting",
    site_visit: "Site Visit",
    measurement_visit: "Measurement Visit",
    project_review: "Project Review",
    material_discussion: "Material Discussion",
    video_meeting: "Video Meeting",
    design_presentation: "Design Presentation",
    estimate_discussion: "Estimate Discussion",
    phone_discussion: "Phone Discussion",
    whatsapp_discussion: "WhatsApp Discussion",
    follow_up: "Follow-up",
    other: "Meeting"
  }[selected.meeting_type] || label(selected.meeting_type);
  const meetMessage = `Hello *${customerName}*,\n\nGreetings from *Sankalp Interior Solution*! ✨\n\nYour *${meetingTypeName}* has been scheduled with our team.\n\n📅 *Date:* ${fmtDate(selected.start_at)}\n⏰ *Time:* ${fmtTime(selected.start_at)}\n💻 *Mode:* Google Meet\n\n🔗 *Meeting Link:*\n${meetLink || "The meeting link will be shared shortly."}\n\nPlease join the meeting at the scheduled time.\n\nLooking forward to connecting with you.\n\nWarm regards,\n*Sankalp Interior Solution*`;
  const teamMessage = `📌 *SANKALP SCHEDULE UPDATE*\n\n👤 *Customer:* ${customerName}\n📋 *Meeting Type:* ${meetingTypeName}\n💻 *Mode:* Digital\n\n📅 *Date:* ${fmtDate(selected.start_at)}\n⏰ *Time:* ${fmtTime(selected.start_at)}\n\n👨‍💼 *Arranged By:* ${arrangerName}\n👥 *Co-Members:* ${comemberNames.join(", ") || "None"}\n\n🔗 *Google Meet:*\n${meetLink || "Pending"}\n\nPlease be available on time.`;
  const openWhatsApp = async (phone, message, labelText) => {
    const ok = await copyText(message);
    if (ok) toast.success(`${labelText} message copied`);
    window.open(whatsappUrl(phone, message), "_blank", "noopener,noreferrer");
  };
  return <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm p-4 flex items-center justify-center" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-auto shadow-2xl"><div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b p-5 flex justify-between"><div><div className="flex items-center gap-2"><StatusBadge status={selected.status}/><ModeBadge mode={selected.mode}/></div><h2 className="text-xl font-display font-bold mt-2">{selected.title}</h2><div className="text-sm text-slate-500 mt-1">{new Date(selected.start_at).toLocaleString("en-IN")}</div></div><button onClick={close} className="w-9 h-9 rounded-xl hover:bg-slate-100 grid place-items-center"><X className="w-5 h-5 text-slate-500"/></button></div><div className="p-5 space-y-5">
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2"><button onClick={()=>openLifecycle("complete")} className="p-3 rounded-xl border bg-emerald-50 text-emerald-700 font-bold text-sm"><CheckCircle2 className="w-4 h-4 inline mr-1"/>Complete</button><button onClick={()=>openLifecycle("reschedule")} className="p-3 rounded-xl border bg-orange-50 text-orange-700 font-bold text-sm"><Clock3 className="w-4 h-4 inline mr-1"/>Reschedule</button><button onClick={()=>openLifecycle("cancel")} className="p-3 rounded-xl border bg-rose-50 text-rose-700 font-bold text-sm"><XCircle className="w-4 h-4 inline mr-1"/>Cancel</button><button onClick={()=>openLifecycle("no_show")} className="p-3 rounded-xl border bg-violet-50 text-violet-700 font-bold text-sm">No Show</button><button onClick={()=>openLifecycle("delete")} className="p-3 rounded-xl border bg-slate-100 text-slate-700 font-bold text-sm">Delete</button></div>
    <div><div className="text-sm font-bold mb-2">Quick Feedback</div><div className="flex flex-wrap gap-2">{FEEDBACKS.map(n=><button key={n} onClick={()=>update({feedback_tags:[n]})} className="px-3 py-2 rounded-full border bg-slate-50 text-xs font-bold hover:border-blue-300">{n}</button>)}</div></div>
    <div className="grid md:grid-cols-2 gap-4"><label className="text-sm font-bold">Remarks<textarea defaultValue={selected.remarks||""} onBlur={e=>e.target.value!==selected.remarks&&update({remarks:e.target.value})} rows={4} className="mt-1 w-full border rounded-xl p-3 text-sm font-normal" placeholder="What happened?" /></label><label className="text-sm font-bold">Customer Feedback<textarea defaultValue={selected.feedback||""} onBlur={e=>e.target.value!==selected.feedback&&update({feedback:e.target.value})} rows={4} className="mt-1 w-full border rounded-xl p-3 text-sm font-normal" placeholder="What did the customer say?" /></label></div>
    <div className="grid md:grid-cols-2 gap-4"><label className="text-sm font-bold">Next Action<input defaultValue={selected.next_action||""} onBlur={e=>e.target.value!==selected.next_action&&update({next_action:e.target.value})} className="mt-1 w-full h-10 border rounded-xl px-3 text-sm font-normal" placeholder="Create estimate / follow-up call" /></label><label className="text-sm font-bold">Next Action Date<input type="date" defaultValue={selected.next_action_date||""} onBlur={e=>e.target.value!==selected.next_action_date&&update({next_action_date:e.target.value})} className="mt-1 w-full h-10 border rounded-xl px-3 text-sm font-normal" /></label></div>
    <div className="border-t pt-4"><div className="flex items-center justify-between mb-2"><div className="font-bold">Files / Site Information</div><label className="px-3 py-2 rounded-xl border text-sm font-bold cursor-pointer flex items-center gap-2"><FileUp className="w-4 h-4"/>Upload<input type="file" className="hidden" onChange={e=>upload(e.target.files?.[0])}/></label></div>{files.length===0?<div className="text-sm text-slate-400 py-4">No files uploaded yet.</div>:<div className="space-y-2">{files.map(f=><a key={f.id} href={f.file_url||f.drive_url||"#"} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border text-sm"><span className="truncate">{f.file_name}</span><span className="text-xs text-slate-400">{label(f.source)}</span></a>)}</div>}</div>
    <div className="grid md:grid-cols-2 gap-3 text-sm">
      <div className="p-3 bg-slate-50 rounded-xl text-slate-600"><MapPin className="w-4 h-4 inline mr-2"/>{selected.location_address||"Digital meeting"}</div>
      <div className="p-3 bg-slate-50 rounded-xl text-slate-600"><UserRound className="w-4 h-4 inline mr-2"/><span className="font-semibold">Meeting Arranged By:</span> {arranger?.full_name||"Unassigned"}</div>
    </div>
    <div className="border rounded-2xl p-4 bg-violet-50/50 border-violet-100">
      <div className="flex items-center justify-between gap-3">
        <div><div className="font-bold text-slate-900">Digital Meeting & Sharing</div><div className="text-xs text-slate-500 mt-1">Google Meet is generated automatically for digital meetings.</div></div>
        {selected.google_calendar_status === "synced" && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">Calendar Synced</span>}
      </div>
      {selected.mode === "digital" ? <div className="mt-3 space-y-3">
        <div className="flex items-center gap-2 p-3 bg-white rounded-xl border">
          <Link2 className="w-4 h-4 text-violet-700 shrink-0"/>
          <a href={meetLink || "#"} target="_blank" rel="noreferrer" className={`text-sm font-semibold truncate ${meetLink ? "text-blue-700 hover:underline" : "text-slate-400 pointer-events-none"}`}>{meetLink || "Google Meet link pending"}</a>
          {meetLink && <button type="button" onClick={async()=>{const ok=await copyText(meetLink);toast[ok?"success":"error"](ok?"Google Meet link copied":"Could not copy link")} } className="ml-auto shrink-0 px-2.5 py-2 rounded-lg border bg-white text-xs font-bold flex items-center gap-1.5"><Copy className="w-3.5 h-3.5"/>Copy</button>}
          {!meetLink && <button type="button" onClick={syncCalendar} className="ml-auto shrink-0 px-2.5 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold">Generate / Sync</button>}
        </div>
        {meetLink && <a href={meetLink} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold"><Video className="w-4 h-4"/>Join Google Meet<ExternalLink className="w-3.5 h-3.5"/></a>}
        <div className="grid md:grid-cols-2 gap-2">
          <button type="button" onClick={()=>openWhatsApp(customerPhone,meetMessage,"Customer")} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4"/>WhatsApp Customer</button>
          <button type="button" onClick={()=>openWhatsApp(arranger?.phone,teamMessage,"Team")} className="px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-bold flex items-center justify-center gap-2"><Users className="w-4 h-4"/>WhatsApp Team</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={async()=>{const ok=await copyText(meetMessage);toast[ok?"success":"error"](ok?"Customer message copied":"Could not copy message")}} className="px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5"><Copy className="w-3.5 h-3.5"/>Copy Customer Message</button>
          <button type="button" onClick={async()=>{const ok=await copyText(teamMessage);toast[ok?"success":"error"](ok?"Team message copied":"Could not copy message")}} className="px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5"><Copy className="w-3.5 h-3.5"/>Copy Team Message</button>
        </div>
      </div> : <div className="mt-3 p-3 bg-white rounded-xl border text-sm text-slate-600">Physical meeting — Google Meet sharing controls are hidden.</div>}
    </div>
    <div className="border rounded-2xl p-4 bg-slate-50">
      <div className="font-bold text-sm">Participants</div>
      <div className="text-xs text-slate-500 mt-1"><span className="font-semibold">Arranged By:</span> {arranger?.full_name || "Unassigned"}</div>
      <div className="text-xs text-slate-500 mt-1"><span className="font-semibold">Co-Members:</span> {comembers.map(p=>p.full_name||p.email).join(", ") || "None"}</div>
    </div>
  </div></div></div>;
}