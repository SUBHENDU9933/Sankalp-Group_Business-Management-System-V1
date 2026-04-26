import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { fetchNotifications, unreadCount, markRead, markAllRead } from "@/services/notificationService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/lib/utils";

export default function NotificationBell() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleClick = async (n) => {
    if (!n.read) {
      try { await markRead(n.id); } catch {}
    }
    setOpen(false);
    if (n.link) nav(n.link);
    refresh();
  };

  const handleMarkAll = async () => {
    try { await markAllRead(); refresh(); } catch {}
  };

  return (
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
  );
}
