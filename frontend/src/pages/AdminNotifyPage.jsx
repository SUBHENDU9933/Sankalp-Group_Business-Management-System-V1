import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { fetchAllUsers, sendBroadcast, fetchMyBroadcasts } from "@/services/adminNotifyService";
import { formatDateTime } from "@/utils/format";

export default function AdminNotifyPage() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sendAt, setSendAt] = useState(""); // datetime-local string, blank = now
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [u, h] = await Promise.all([fetchAllUsers(), fetchMyBroadcasts()]);
      setUsers(u);
      setHistory(h);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggleUser = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const selectAll = () => setSelected(users.map((u) => u.id));
  const clearAll = () => setSelected([]);

  const handleSend = async () => {
    if (selected.length === 0) { toast.error("Pick at least one user"); return; }
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSending(true);
    try {
      const sendAtIso = sendAt ? new Date(sendAt).toISOString() : null;
      await sendBroadcast({ userIds: selected, title: title.trim(), body: body.trim(), link: link.trim(), sendAt: sendAtIso });
      toast.success(sendAtIso ? "Scheduled" : "Sent now");
      setTitle(""); setBody(""); setLink(""); setSendAt(""); setSelected([]);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  return (
    <>
      <PageHeader title="Send Notification" subtitle="Admin — Manual Broadcast" />
      <PageBody className="max-w-3xl space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Recipients</div>
          <div className="flex items-center gap-2 mb-3">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={selectAll}>Select all</Button>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={clearAll}>Clear</Button>
            <span className="text-xs text-slate-400 ml-1">{selected.length} selected</span>
          </div>
          {loading ? (
            <div className="text-sm text-slate-400">Loading users…</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{u.full_name || u.email}</div>
                    <div className="text-xs text-slate-400 truncate">{u.email}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Message</div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-500">Title</Label>
              <Input className="rounded-lg mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Urgent: Close today's pending leads" data-testid="broadcast-title-input" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Body (optional)</Label>
              <Textarea rows={3} className="rounded-lg mt-1" value={body} onChange={(e) => setBody(e.target.value)} data-testid="broadcast-body-input" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Link (optional — e.g. /leads)</Label>
              <Input className="rounded-lg mt-1" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/leads" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Timing</div>
          <Label className="text-xs text-slate-500">Send at (leave blank to send immediately)</Label>
          <Input type="datetime-local" className="rounded-lg mt-1 max-w-xs" value={sendAt} onChange={(e) => setSendAt(e.target.value)} data-testid="broadcast-schedule-input" />
          <p className="text-xs text-slate-400 mt-2">Scheduled sends are checked every 5 minutes.</p>
        </div>

        <Button className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white" disabled={sending} onClick={handleSend} data-testid="broadcast-send-button">
          <Send className="w-4 h-4 mr-1.5" /> {sending ? "Sending…" : sendAt ? "Schedule" : "Send Now"}
        </Button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Recent Broadcasts</div>
          {history.length === 0 ? (
            <div className="text-sm text-slate-400">None sent yet.</div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="border border-slate-100 rounded-lg px-3 py-2 text-sm">
                  <div className="font-medium text-slate-800">{h.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {h.target_user_ids?.length || 0} recipient(s) · {h.sent ? `Sent ${formatDateTime(h.sent_at)}` : `Scheduled for ${formatDateTime(h.send_at)}`}
                  </div>
                  {h.sent && h.totalCount > 0 && (
                    <div className="text-xs mt-1">
                      <span className="text-emerald-600 font-medium">✓ Read by {h.readCount}</span>
                      {h.totalCount - h.readCount > 0 && (
                        <span className="text-amber-600 font-medium ml-2">● Unread by {h.totalCount - h.readCount}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}
