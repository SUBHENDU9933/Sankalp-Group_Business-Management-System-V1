import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { CalendarDays, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fetchGoogleCalendarConnection, startGoogleCalendarOAuth, disconnectGoogleCalendar } from "@/services/scheduleService";

export default function AdminCalendarSettingsPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setStatus(await fetchGoogleCalendarConnection()); }
    catch (e) { setStatus(null); toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_calendar") === "connected") {
      params.delete("google_calendar");
      const q = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (q ? "?" + q : ""));
    }
  }, []);

  const connect = async () => {
    setWorking(true);
    try { await startGoogleCalendarOAuth("master"); }
    catch (e) { toast.error(e.message); setWorking(false); }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect the Company Master Calendar from Sankalp BMS? Existing Google events will not be deleted.")) return;
    setWorking(true);
    try { await disconnectGoogleCalendar("master"); await load(); toast.success("Company Master Calendar disconnected"); }
    catch (e) { toast.error(e.message); }
    finally { setWorking(false); }
  };

  const master = status?.master_calendar;
  const connected = status?.master_connected;

  return (
    <div data-testid="admin-calendar-settings-page">
      <PageHeader subtitle="Admin" title="Calendar Settings" />
      <PageBody>
        <div className="max-w-4xl">
          <div className="bg-white border border-stone-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label-uppercase mb-2"><CalendarDays className="w-3 h-3 inline mr-1" />Company Master Calendar</div>
                <h2 className="text-xl font-semibold text-stone-900">SANKALP BMS – MASTER MEETINGS</h2>
                <p className="text-sm text-stone-500 mt-2 max-w-2xl">This is the official central calendar for all company meetings and schedules. Schedule availability checks and calendar events use this calendar together with the required employees' personal calendars.</p>
              </div>
              <span className={connected ? "shrink-0 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1" : "shrink-0 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1"}>{loading ? "Checking…" : connected ? "Connected" : "Not Connected"}</span>
            </div>

            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div className="border border-stone-200 p-4 bg-stone-50">
                <div className="text-[10px] tracking-widest uppercase text-stone-400">Google Account</div>
                <div className="mt-1 font-semibold text-stone-900">{master?.google_email || "Not connected"}</div>
              </div>
              <div className="border border-stone-200 p-4 bg-stone-50">
                <div className="text-[10px] tracking-widest uppercase text-stone-400">Calendar ID</div>
                <div className="mt-1 text-sm text-stone-700 break-all">{master?.calendar_id || "—"}</div>
              </div>
            </div>

            {master?.connected_at && <div className="text-xs text-stone-400 mt-4">Connected {new Date(master.connected_at).toLocaleDateString("en-IN")}</div>}
            {master?.last_error && <div className="mt-4 p-3 bg-rose-50 border border-rose-100 text-xs text-rose-700">{master.last_error}</div>}

            <div className="mt-6 flex gap-2">
              <Button onClick={connect} disabled={working || loading} className="rounded-none bg-blue-700 hover:bg-blue-800 text-white">
                <CalendarDays className="w-4 h-4 mr-1.5" />{working ? "Connecting…" : connected ? "Reconnect Master Calendar" : "Connect Company Master Calendar"}
              </Button>
              {connected && <Button onClick={disconnect} disabled={working} variant="outline" className="rounded-none"><RefreshCw className="w-4 h-4 mr-1.5" />Disconnect</Button>}
              <Button onClick={load} disabled={loading || working} variant="outline" className="rounded-none"><RefreshCw className="w-4 h-4 mr-1.5" />Refresh</Button>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-100 p-5 text-sm text-blue-900">
            <div className="font-semibold mb-2"><ShieldCheck className="w-4 h-4 inline mr-1" />Access &amp; security</div>
            <ul className="space-y-1 text-xs leading-5">
              <li>• Only Admin can connect, reconnect, or disconnect the Company Master Calendar.</li>
              <li>• Employees and Managers can see the master connection status from My Profile but cannot change it.</li>
              <li>• Each employee connects only their own Google Calendar.</li>
              <li>• Google refresh tokens are stored encrypted on the server and reused for automatic token refresh.</li>
            </ul>
          </div>
        </div>
      </PageBody>
    </div>
  );
}
