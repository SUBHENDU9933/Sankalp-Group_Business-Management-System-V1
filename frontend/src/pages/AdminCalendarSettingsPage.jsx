import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { CalendarDays, RefreshCw, ShieldCheck, HardDrive, Settings2, CheckCircle2, ExternalLink, Copy, UserCircle2, FolderOpen, Cloud, LockKeyhole, Database, Gauge, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { fetchGoogleCalendarConnection, startGoogleCalendarOAuth, disconnectGoogleCalendar } from "@/services/scheduleService";
import { fetchGoogleDriveStatus, startGoogleDriveOAuth, disconnectGoogleDrive, fetchGoogleDriveQuota } from "@/services/googleDriveService";

export default function AdminCalendarSettingsPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [driveStatus, setDriveStatus] = useState(null);
  const [driveWorking, setDriveWorking] = useState(false);
  const [driveQuota, setDriveQuota] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [calendarStatus, storageStatus] = await Promise.all([fetchGoogleCalendarConnection(), fetchGoogleDriveStatus()]);
      setStatus(calendarStatus);
      setDriveStatus(storageStatus);
      if (storageStatus?.connected) {
        try { setDriveQuota(await fetchGoogleDriveQuota()); } catch (_) { setDriveQuota(null); }
      } else setDriveQuota(null);
    }
    catch (e) { setStatus(null); toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_calendar") === "connected" || params.get("google_drive") === "connected") {
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

          <div className="mt-6 bg-white border border-stone-200 p-6" data-testid="google-drive-storage-section">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label-uppercase mb-2"><HardDrive className="w-3 h-3 inline mr-1" />BMS File Storage</div>
                <h2 className="text-xl font-semibold text-stone-900">Google Drive Storage</h2>
                <p className="text-sm text-stone-500 mt-2 max-w-2xl">Google Drive is the primary file storage for BMS modules. The BMS keeps file metadata and permissions in Supabase while the actual files are stored in the connected Drive account.</p>
              </div>
              <span className={driveStatus?.connected ? "shrink-0 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1" : "shrink-0 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1"}>{driveStatus?.connected ? "Connected" : "Not Connected"}</span>
            </div>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div className="border border-stone-200 p-4 bg-stone-50">
                <div className="text-[10px] tracking-widest uppercase text-stone-400">Google Account</div>
                <div className="mt-1 font-semibold text-stone-900">{driveStatus?.connection?.google_email || "Not connected"}</div>
              </div>
              <div className="border border-stone-200 p-4 bg-stone-50">
                <div className="text-[10px] tracking-widest uppercase text-stone-400">BMS Root Folder</div>
                <div className="mt-1 text-sm text-stone-700 break-all">{driveStatus?.connection?.root_folder_id || "Created automatically after connection"}</div>
              </div>
            </div>
            {driveStatus?.connection?.last_error && <div className="mt-4 p-3 bg-rose-50 border border-rose-100 text-xs text-rose-700">{driveStatus.connection.last_error}</div>}
            <div className="mt-6 flex gap-2">
              <Button onClick={async()=>{setDriveWorking(true);try{await startGoogleDriveOAuth();}catch(e){toast.error(e.message);setDriveWorking(false)}}} disabled={driveWorking || loading} className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white">
                <HardDrive className="w-4 h-4 mr-1.5" />{driveWorking ? "Connecting…" : driveStatus?.connected ? "Reconnect Google Drive" : "Connect Google Drive"}
              </Button>
              {driveStatus?.connected && <Button onClick={async()=>{if(!window.confirm("Disconnect Google Drive from Sankalp BMS? Existing Drive files will not be deleted."))return;setDriveWorking(true);try{await disconnectGoogleDrive();setDriveStatus(await fetchGoogleDriveStatus());toast.success("Google Drive disconnected")}catch(e){toast.error(e.message)}finally{setDriveWorking(false)}}} disabled={driveWorking} variant="outline" className="rounded-none"><RefreshCw className="w-4 h-4 mr-1.5" />Disconnect</Button>}
              <Button onClick={async()=>{try{setDriveStatus(await fetchGoogleDriveStatus())}catch(e){toast.error(e.message)}}} disabled={driveWorking} variant="outline" className="rounded-none"><RefreshCw className="w-4 h-4 mr-1.5" />Refresh</Button>
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
}  const quota = driveQuota?.storage_quota || null;
  const usedBytes = Number(quota?.usage_in_drive || quota?.usage || 0);
  const limitBytes = Number(quota?.limit || 0);
  const usedPct = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;
  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : i >= 3 ? 1 : 0) + " " + units[i];
  };
  const copyText = async (value) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); toast.success("Copied to clipboard"); } catch (_) {}
  };

  return (
    <div data-testid="admin-calendar-settings-page">
      <PageHeader subtitle="Admin" title="Google & System Settings" />
      <PageBody>
        <div className="max-w-6xl">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/60 p-6 lg:p-7 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300"><Settings2 className="w-4 h-4" /> System Integrations</div>
                <h1 className="mt-2 text-2xl lg:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Google & System Settings</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">Manage the Google services and backend infrastructure that power Sankalp BMS. Calendar handles meetings and availability; Google Drive provides secure file storage.</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="w-5 h-5" /> Connected &amp; Secure</div>
                <div className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-400/80">Google services are integrated with BMS.</div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              [Cloud, "Google Account", driveStatus?.connection?.google_email || master?.google_email || "Not connected", driveStatus?.connected || connected],
              [CalendarDays, "Google Calendar", "Company meetings & schedules", connected],
              [HardDrive, "Google Drive Storage", "Primary file storage for BMS", driveStatus?.connected],
              [LockKeyhole, "OAuth Status", "Secure server-side authentication", Boolean(driveStatus?.connected && connected)]
            ].map(([Icon,label,value,ok]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-blue-700 dark:bg-slate-800 dark:text-blue-300"><Icon className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</div>
                    <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{value}</div>
                    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}/>{ok ? "Connected" : "Not Connected"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 lg:p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid="google-drive-storage-section">
            <div className="grid gap-7 lg:grid-cols-[1.55fr_.85fr]">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 dark:bg-blue-950/50"><HardDrive className="h-8 w-8 text-blue-600 dark:text-blue-300" /></div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-slate-950 dark:text-white">Google Drive Storage</h2><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> {driveStatus?.connected ? "Connected" : "Not Connected"}</span></div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Google Drive is the primary file storage for BMS modules. Files are stored in your connected Drive while BMS keeps metadata and permissions under its own access controls.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><UserCircle2 className="w-4 h-4" /> Connected Google Account</div>
                    <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{driveStatus?.connection?.google_email || "Not connected"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><FolderOpen className="w-4 h-4" /> BMS Root Folder</div>
                    <div className="mt-2 flex items-center gap-2"><span className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{driveStatus?.connection?.root_folder_id || "Created automatically after connection"}</span>{driveStatus?.connection?.root_folder_id && <button onClick={()=>copyText(driveStatus.connection.root_folder_id)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-800" aria-label="Copy root folder ID"><Copy className="w-4 h-4" /></button>}</div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={async()=>{setDriveWorking(true);try{await startGoogleDriveOAuth();}catch(e){toast.error(e.message);setDriveWorking(false)}}} disabled={driveWorking || loading} className="rounded-xl bg-blue-700 hover:bg-blue-800 text-white shadow-sm"><HardDrive className="w-4 h-4 mr-1.5" />{driveWorking ? "Connecting…" : driveStatus?.connected ? "Reconnect Google Drive" : "Connect Google Drive"}</Button>
                  {driveStatus?.connected && <Button onClick={async()=>{if(!window.confirm("Disconnect Google Drive from Sankalp BMS? Existing Drive files will not be deleted."))return;setDriveWorking(true);try{await disconnectGoogleDrive();await load();toast.success("Google Drive disconnected")}catch(e){toast.error(e.message)}finally{setDriveWorking(false)}}} disabled={driveWorking} variant="outline" className="rounded-xl text-rose-600 hover:text-rose-700"><HardDrive className="w-4 h-4 mr-1.5" />Disconnect</Button>}
                  <Button onClick={async()=>{try{setDriveQuota(await fetchGoogleDriveQuota())}catch(e){toast.error(e.message||"Could not refresh storage usage")}}} disabled={driveWorking || !driveStatus?.connected} variant="outline" className="rounded-xl"><RefreshCw className="w-4 h-4 mr-1.5" />Refresh Storage</Button>
                </div>

                <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/80 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
                  <div className="flex gap-3"><Gauge className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" /><div><div className="text-sm font-semibold text-blue-900 dark:text-blue-200">About Google Drive Storage</div><p className="mt-1 text-xs leading-5 text-blue-700/80 dark:text-blue-300/80">BMS automatically organizes uploaded files into module folders under the SANKALP BMS root folder. Access remains controlled by BMS permissions.</p></div></div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/70 p-5 dark:border-slate-800 dark:from-slate-950/50 dark:to-blue-950/30">
                <div className="flex items-center justify-between"><div><div className="text-lg font-bold text-slate-950 dark:text-white">Storage Usage</div><div className="text-xs text-slate-500 dark:text-slate-400">Live data from Google Drive</div></div><div className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">Google Drive</div></div>
                {driveStatus?.connected && quota ? (
                  <>
                    <div className="mt-5 flex justify-center"><div className="relative grid h-40 w-40 place-items-center rounded-full" style={{background:`conic-gradient(#2563eb ${usedPct}%, #dbe4f0 0)`}}><div className="grid h-28 w-28 place-items-center rounded-full bg-white dark:bg-slate-900"><div className="text-center"><div className="text-2xl font-bold text-slate-950 dark:text-white">{usedPct.toFixed(1)}%</div><div className="text-xs text-slate-500">Used</div></div></div></div></div>
                    <div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">Used Space</span><strong className="text-slate-900 dark:text-white">{formatBytes(usedBytes)}</strong></div><div className="flex justify-between"><span className="text-slate-500">Available Space</span><strong className="text-slate-900 dark:text-white">{limitBytes ? formatBytes(Math.max(0,limitBytes-usedBytes)) : "Unlimited"}</strong></div><div className="flex justify-between"><span className="text-slate-500">Total Storage</span><strong className="text-slate-900 dark:text-white">{limitBytes ? formatBytes(limitBytes) : "Unlimited"}</strong></div></div>
                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all" style={{width:`${usedPct}%`}} /></div>
                  </>
                ) : (
                  <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white/70 p-6 text-center dark:border-slate-700 dark:bg-slate-900/60"><AlertCircle className="mx-auto h-8 w-8 text-slate-400" /><div className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{driveStatus?.connected ? "Storage usage unavailable" : "Connect Google Drive"}</div><p className="mt-1 text-xs leading-5 text-slate-500">Storage statistics will appear here when Google Drive usage data is available.</p></div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 lg:p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/50"><CalendarDays className="h-7 w-7 text-indigo-600 dark:text-indigo-300" /></div><div><div className="flex items-center gap-2"><h2 className="text-xl font-bold text-slate-950 dark:text-white">Google Calendar</h2><span className={connected ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}><CheckCircle2 className="w-3.5 h-3.5" /> {connected ? "Connected" : "Not Connected"}</span></div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Official central calendar for company meetings and schedules, used with employee calendars for availability checks.</p></div></div>
              <div className="hidden lg:block rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-950/40"><div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Calendar Features</div><div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-xs text-indigo-700/80 dark:text-indigo-300/80">{["Company meetings","Availability checks","Employee calendar sync","Automatic event creation","Realtime updates","Centralized scheduling"].map(x=><div key={x} className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" />{x}</div>)}</div></div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50"><div className="text-xs text-slate-500">Connected Google Account</div><div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{master?.google_email || "Not connected"}</div></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50"><div className="text-xs text-slate-500">Calendar ID</div><div className="mt-1 flex items-center gap-2"><span className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-300">{master?.calendar_id || "—"}</span>{master?.calendar_id&&<button onClick={()=>copyText(master.calendar_id)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-800" aria-label="Copy calendar ID"><Copy className="w-4 h-4" /></button>}</div></div></div>
            {master?.last_error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{master.last_error}</div>}
            <div className="mt-5 flex flex-wrap gap-2"><Button onClick={connect} disabled={working || loading} className="rounded-xl bg-blue-700 hover:bg-blue-800 text-white"><CalendarDays className="w-4 h-4 mr-1.5" />{working ? "Connecting…" : connected ? "Reconnect Master Calendar" : "Connect Company Master Calendar"}</Button>{connected&&<Button onClick={disconnect} disabled={working} variant="outline" className="rounded-xl"><RefreshCw className="w-4 h-4 mr-1.5" />Disconnect</Button>}<Button onClick={load} disabled={loading||working} variant="outline" className="rounded-xl"><RefreshCw className="w-4 h-4 mr-1.5" />Refresh</Button></div>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/80 p-5 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="w-4 h-4" /> Access &amp; Security</div>
            <ul className="mt-2 grid gap-1 text-xs leading-5 md:grid-cols-2">{["Only Admin can connect, reconnect, or disconnect Google services.","Employees and Managers cannot change these backend connections.","Each employee connects only their own Google Calendar.","Google refresh tokens are encrypted and stored server-side."].map(x=><li key={x}>• {x}</li>)}</ul>
          </div>
        </div>
      </PageBody>
    </div>
  );\n}