import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LEAD_SOURCES, PROJECT_TYPES } from "@/utils/format";
import { useAuth } from "@/contexts/AuthContext";
import { createLead, updateLead } from "@/services/leadService";
import { fetchProfiles } from "@/services/profileService";
import { toast } from "sonner";

export default function LeadFormDialog({ open, onOpenChange, lead, onSaved }) {
  const { user } = useAuth();
  const isEdit = Boolean(lead?.id);
  const [profiles, setProfiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();

  useEffect(() => {
    if (!open) return;
    fetchProfiles().then(setProfiles).catch(() => {});
    reset({
      name: lead?.name || "",
      phone: lead?.phone || "",
      location: lead?.location || "",
      project_type: lead?.project_type || "",
      requirement: lead?.requirement || "",
      budget: lead?.budget || "",
      source: lead?.source || "",
      assigned_to: lead?.assigned_to || "",
      next_followup_date: lead?.next_followup_date || "",
      reminder_note: lead?.reminder_note || "",
    });
  }, [open, lead, reset]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        budget: values.budget ? Number(values.budget) : null,
        assigned_to: values.assigned_to || null,
        next_followup_date: values.next_followup_date || null,
      };
      if (isEdit) {
        await updateLead(lead.id, payload);
        toast.success("Lead updated");
      } else {
        await createLead(payload, user.id);
        toast.success("Lead created");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message || "Failed to save lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-stone-300 max-w-3xl p-0 max-h-[92vh] overflow-y-auto" data-testid="lead-form-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">{isEdit ? "Edit Lead" : "New Lead"}</div>
          <DialogTitle className="font-display text-2xl tracking-tight">{isEdit ? lead.name : "Add a new business enquiry"}</DialogTitle>
          <DialogDescription className="sr-only">Lead intake form. Capture name, phone, project type, requirement and follow-up.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid md:grid-cols-2 gap-0 grid-divider-x">
          <div className="p-6 space-y-4">
            <div>
              <Label className="label-uppercase">Name *</Label>
              <Input className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("name", { required: true })} data-testid="lead-input-name" />
              {errors.name && <span className="text-xs text-rose-600 mt-1">Required</span>}
            </div>
            <div>
              <Label className="label-uppercase">Phone *</Label>
              <Input className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("phone", { required: true })} data-testid="lead-input-phone" />
              {errors.phone && <span className="text-xs text-rose-600 mt-1">Required</span>}
            </div>
            <div>
              <Label className="label-uppercase">Location</Label>
              <Input className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("location")} data-testid="lead-input-location" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-uppercase">Project Type</Label>
                <Select value={watch("project_type") || ""} onValueChange={(v) => setValue("project_type", v)}>
                  <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="lead-select-project-type"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t} className="rounded-none">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="label-uppercase">Source</Label>
                <Select value={watch("source") || ""} onValueChange={(v) => setValue("source", v)}>
                  <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="lead-select-source"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    {LEAD_SOURCES.map((t) => <SelectItem key={t} value={t} className="rounded-none">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="label-uppercase">Budget (₹)</Label>
              <Input type="number" className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("budget")} data-testid="lead-input-budget" />
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <Label className="label-uppercase">Requirement</Label>
              <Textarea className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0 min-h-[100px]" {...register("requirement")} data-testid="lead-input-requirement" />
            </div>
            <div>
              <Label className="label-uppercase">Assign To (RM)</Label>
              <Select value={watch("assigned_to") || ""} onValueChange={(v) => setValue("assigned_to", v)}>
                <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="lead-select-assignee"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="rounded-none">
                      {p.full_name || p.email} <span className="text-stone-500 ml-1">({p.role})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-uppercase">Next Follow-up Date</Label>
              <Input type="date" className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("next_followup_date")} data-testid="lead-input-followup" />
            </div>
            <div>
              <Label className="label-uppercase">Reminder Note</Label>
              <Textarea className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0 min-h-[80px]" {...register("reminder_note")} data-testid="lead-input-reminder" />
            </div>
          </div>

          <DialogFooter className="md:col-span-2 px-6 py-4 border-t border-stone-200 bg-stone-50 flex-row justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-none border-stone-300 hover:bg-stone-100" onClick={() => onOpenChange(false)} data-testid="lead-form-cancel">Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="lead-form-submit">
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
