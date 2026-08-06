import { useEffect, useState, useRef } from "react";
import { Bell, Check, CheckCheck, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { fetchNotifications, unreadCount, markRead, markAllRead } from "@/services/notificationService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import { playEmergencySiren } from "@/utils/chime";

const SNOOZE_MS = 30 * 60 * 1000; // re-alert after 30 minutes if dismissed without being addressed

export default function NotificationBell() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [alertNotif, setAlertNotif] = useState(null); // reminder/report shown as a blocking centered popup
  const snoozeTimerRef = useRef(null);

  const refresh = async () => {
    if (!user) return;
    const [list, c] = await Promise.all([fetchNotifications(20), unreadCount()]);
    setItems(list);
    setCount(c);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const t = setInterval(refresh, 30000); // poll every 30s
    // also realtime if available
    const ch = supabase
      .channel("notif-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        const n = payload.new;
        // Reminder digests and the end-of-day report get a centered popup
        // that stays until manually dismissed, plus a chime — everything
        // else (lead assigned, delete requests, etc.) stays as a silent
        // badge update, same as before.
        if (n?.type === "reminder_chime" || n?.type === "daily_report" || n?.type === "admin_broadcast") {
          playEmergencySiren();
          setAlertNotif(n);
        }
        refresh();
      })
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Repeat the siren every ~2.2s for as long as the popup stays open —
  // stops the instant either button is clicked (popup closes → alertNotif becomes null).
  useEffect(() => {
    if (!alertNotif) return;
    const repeat = setInterval(() => playEmergencySiren(), 2200);
    return () => clearInterval(repeat);
  }, [alertNotif]);

  const handleClick = async (n) => {
    if (!n.read) {
      try { await markRead(n.id); } catch {}
    }
    setOpen(false);
    if (n.link) nav(n.link);
    refresh();
  };

  const scheduleSnooze = (notif) => {
    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current = setTimeout(async () => {
      // Only re-alert if it's still genuinely unread (i.e. never actually
      // opened/viewed in the meantime) — avoids re-nagging about something
      // already handled.
      try {
        const { data } = await supabase.from("notifications").select("*").eq("id", notif.id).maybeSingle();
        if (data && !data.read) {
          playEmergencySiren();
          setAlertNotif(data);
        }
      } catch {}
    }, SNOOZE_MS);
  };

  // "Got it, thanks" — full acknowledgement: marks read, no further re-alert.
  const acknowledgeAlert = async () => {
    const n = alertNotif;
    if (snoozeTimerRef.current) { clearTimeout(snoozeTimerRef.current); snoozeTimerRef.current = null; }
    setAlertNotif(null);
    if (n && !n.read) { try { await markRead(n.id); } catch {} refresh(); }
  };
  // "Remind me after 30 minutes again" — closes now, stays unread, and
  // re-alerts with sound+popup in 30 minutes if still unread by then.
  const snoozeAlert = () => {
    if (alertNotif) scheduleSnooze(alertNotif);
    setAlertNotif(null);
  };

  useEffect(() => () => { if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current); }, []);

  const handleMarkAll = async () => {
    try { await markAllRead(); refresh(); } catch {}
  };

  return (
    <>
      <Dialog open={!!alertNotif} onOpenChange={(v) => { if (!v) snoozeAlert(); }}>
        <DialogContent
          className="max-w-sm border-2 border-rose-400 shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          hideClose
          data-testid="reminder-alert-dialog"
        >
          <DialogHeader>
            <div className="mx-auto mb-2 h-16 w-16 rounded-full bg-rose-100 grid place-items-center relative">
              <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-50" />
              <Siren className="w-8 h-8 text-rose-600 relative siren-flash" />
            </div>
            <DialogTitle className="text-center text-rose-700">{alertNotif?.title}</DialogTitle>
            <div className="text-center font-extrabold text-rose-600 text-sm mt-1 leading-snug" data-testid="reminder-alert-urgent-message">
              <div>{(profile?.full_name || "").split(" ")[0] || "Hi"}, please complete your pending tasks urgently!</div>
              <div lang="bn">{(profile?.full_name || "").split(" ")[0] || "আপনি"}, অনুগ্রহ করে জরুরি ভিত্তিতে আপনার বাকি কাজগুলো সম্পন্ন করুন!</div>
            </div>
            <DialogDescription className="text-center pt-1">{alertNotif?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2 mt-2">
            <Button className="w-full rounded-lg bg-rose-600 hover:bg-rose-700 text-white" onClick={acknowledgeAlert} data-testid="reminder-alert-ack">
              Got it, thanks
            </Button>
            <Button variant="outline" className="w-full rounded-lg" onClick={snoozeAlert} data-testid="reminder-alert-snooze">
              Remind me after 30 minutes again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style>{`
        @keyframes siren-flash { 0%, 100% { color: #e11d48; } 50% { color: #f97316; } }
        .siren-flash { animation: siren-flash 0.6s infinite; }
      `}</style>

      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-slate-100" data-testid="notification-bell">
          <Bell className="w-5 h-5 text-slate-700" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center" data-testid="notification-badge">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0 rounded-xl border-slate-200" data-testid="notification-popover">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <div className="font-display font-bold text-slate-900">Notifications</div>
            <div className="text-xs text-slate-500">{count > 0 ? `${count} unread` : "All caught up"}</div>
          </div>
          {count > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAll} className="text-xs text-blue-700 hover:bg-blue-50" data-testid="notification-mark-all">
              <CheckCheck className="w-3.5 h-3.5 mr-1" />Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No notifications yet.</div>
          ) : (
            items.map((n) => (
              <button key={n.id} onClick={() => handleClick(n)}
                className={cn("w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 flex gap-3 items-start", !n.read && "bg-blue-50/40")}
                data-testid={`notification-item-${n.id}`}>
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", !n.read ? "bg-blue-600" : "bg-transparent")} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{n.title}</div>
                  {n.body && <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.body}</div>}
                  <div className="text-[10px] text-slate-400 mt-1">{formatDateTime(n.created_at)}</div>
                </div>
                {!n.read && <Check className="w-3.5 h-3.5 text-blue-600 mt-1.5" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
      </Popover>
    </>
  );
}
