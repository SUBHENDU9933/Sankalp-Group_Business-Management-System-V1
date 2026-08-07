import { supabase } from "@/lib/supabase";
import { uploadFile } from "@/services/attachmentService";

export const fetchProjectDocuments = async (projectId) => {
  const { data, error } = await supabase
    .from("project_documents")
    .select("*, uploader:profiles!project_documents_uploaded_by_fkey(id,full_name)")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const uploadProjectDocument = async (projectId, file, userId) => {
  const res = await uploadFile(file, "project-documents");
  const { data, error } = await supabase
    .from("project_documents")
    .insert([{ project_id: projectId, name: file.name, url: res.url, file_type: file.type, uploaded_by: userId }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const deleteProjectDocument = async (id, userId) => {
  const { error } = await supabase
    .from("project_documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
};
