import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { createProject, updateProject } from "@/services/projectService";
import { PROJECT_STATUSES, todayISO } from "@/utils/format";
import { toast } from "sonner";

const inputCls = "rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0";

export default function ProjectFormDialog({ open, onOpenChange, customers, project, onSaved }) {
  const { user } = useAuth();
  const isEdit = Boolean(project?.id);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({
      project_name: project?.project_name || "",
      customer_id: project?.customer_id || "",
      location: project?.location || "",
      start_date: project?.start_date || todayISO(),
      end_date: project?.end_date || "",
      status: project?.status || "planning",
      total_value: project?.total_value || "",
    });
  }, [open, project, reset]);

  const onSubmit = async (values) => {
    if (!values.customer_id) { toast.error("Select a customer"); return; }
    setSubmitting(true);
    try {
      const payload = {
        project_name: values.project_name,
        customer_id: values.customer_id,
        location: values.location || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        status: values.status,
        total_value: values.total_value ? Number(values.total_value) : 0,
      };
      if (isEdit) {
        await updateProject(project.id, payload);
        toast.success("Project updated");
      } else {
        await createProject(payload, user.id);
        toast.success("Project created");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-stone-300 max-w-xl p-0" data-testid="project-form-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">{isEdit ? "Edit Project" : "New Project"}</div>
          <DialogTitle className="font-display text-2xl tracking-tight">{isEdit ? project.project_name : "Set up a project"}</DialogTitle>
          <DialogDescription className="sr-only">Create or edit a project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <Label className="label-uppercase">Project Name *</Label>
            <Input className={inputCls} {...register("project_name", { required: true })} data-testid="project-input-name" />
          </div>
          <div>
            <Label className="label-uppercase">Customer *</Label>
            <Select value={watch("customer_id") || ""} onValueChange={(v) => setValue("customer_id", v)}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="project-select-customer"><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent className="rounded-none">
                {customers.map((c) => <SelectItem key={c.id} value={c.id} className="rounded-none">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-uppercase">Location</Label>
            <Input className={inputCls} {...register("location")} data-testid="project-input-location" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-uppercase">Start Date</Label>
              <Input type="date" className={inputCls} {...register("start_date")} data-testid="project-input-startdate" />
            </div>
            <div>
              <Label className="label-uppercase">End / Handover Date</Label>
              <Input type="date" className={inputCls} {...register("end_date")} data-testid="project-input-enddate" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-uppercase">Status</Label>
              <Select value={watch("status") || "planning"} onValueChange={(v) => setValue("status", v)}>
                <SelectTrigger className="rounded-none mt-1.5 border-stone-300"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {PROJECT_STATUSES.map((s) => <SelectItem key={s.key} value={s.key} className="rounded-none">{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-uppercase">Total Value (₹)</Label>
              <Input type="number" className={inputCls} {...register("total_value")} data-testid="project-input-value" />
            </div>
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-stone-200 bg-stone-50 flex-row justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="project-form-submit">
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
