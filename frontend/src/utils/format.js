export const formatINR = (n) => {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

export const formatDateTime = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const isOverdue = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

export const isToday = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
};

export const LEAD_STATUSES = [
  { key: "new", label: "New", color: "bg-stone-100 text-stone-900 border-stone-300", dot: "bg-stone-500" },
  { key: "contacted", label: "Contacted", color: "bg-blue-50 text-blue-900 border-blue-300", dot: "bg-blue-500" },
  { key: "site_visit", label: "Site Visit", color: "bg-indigo-50 text-indigo-900 border-indigo-300", dot: "bg-indigo-500" },
  { key: "quotation_given", label: "Estimate Given", color: "bg-amber-50 text-amber-900 border-amber-300", dot: "bg-amber-500" },
  { key: "negotiation", label: "Negotiation", color: "bg-orange-50 text-orange-900 border-orange-400", dot: "bg-orange-500" },
  { key: "converted", label: "Converted", color: "bg-emerald-50 text-emerald-900 border-emerald-400", dot: "bg-emerald-500" },
  { key: "lost", label: "Lost", color: "bg-rose-50 text-rose-900 border-rose-300", dot: "bg-rose-500" },
];

export const LEAD_PRIORITIES = [
  { key: "hot", label: "Hot", color: "bg-rose-100 text-rose-800 border-rose-300", dot: "bg-rose-500" },
  { key: "warm", label: "Warm", color: "bg-amber-100 text-amber-800 border-amber-300", dot: "bg-amber-500" },
  { key: "cold", label: "Cold", color: "bg-sky-100 text-sky-800 border-sky-300", dot: "bg-sky-500" },
];

export const PROJECT_TYPES = ["1BHK", "2BHK", "3BHK", "4BHK", "Villa", "Shop", "Office", "Showroom", "Other"];
export const PROPERTY_TYPES = ["Apartment", "Villa", "Independent House", "Builder Floor", "Commercial", "Other"];
export const LEAD_SOURCES = ["Facebook", "WhatsApp", "Instagram", "Referral", "Walk-in", "Website", "Google Ads", "Other"];
export const PAYMENT_MODES = [
  { key: "cash", label: "Cash" },
  { key: "bank", label: "Bank Transfer" },
  { key: "upi", label: "UPI" },
  { key: "cheque", label: "Cheque" },
  { key: "other", label: "Other" },
];
export const EXPENSE_CATEGORIES = [
  { key: "labour", label: "Labour" },
  { key: "material", label: "Material" },
  { key: "vendor", label: "Vendor" },
  { key: "transport", label: "Transport" },
  { key: "misc", label: "Miscellaneous" },
];
export const PROJECT_STATUSES = [
  { key: "planning", label: "Planning" },
  { key: "in_progress", label: "In Progress" },
  { key: "on_hold", label: "On Hold" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];
export const VENDOR_TYPES = ["Carpenter", "Painter", "Electrician", "Plumber", "Mason", "Polish", "POP/False Ceiling", "Other"];

export const numberToWords = (num) => {
  if (num === null || num === undefined || num === "" || isNaN(num)) return "";
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const w = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? " " + a[n%10] : "");
    if (n < 1000) return a[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + w(n%100) : "");
    if (n < 100000) return w(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + w(n%1000) : "");
    if (n < 10000000) return w(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + w(n%100000) : "");
    return w(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + w(n%10000000) : "");
  };
  const i = Math.floor(Number(num));
  if (i === 0) return "Zero Rupees Only";
  return w(i) + " Rupees Only";
};

export const AGREEMENT_STATUSES = [
  { key: "draft", label: "Draft", color: "bg-stone-100 text-stone-900 border-stone-300", dot: "bg-stone-500" },
  { key: "sent", label: "Sent for Signature", color: "bg-amber-50 text-amber-900 border-amber-300", dot: "bg-amber-500" },
  { key: "signed_physical", label: "Signed (Physical)", color: "bg-blue-50 text-blue-900 border-blue-300", dot: "bg-blue-500" },
  { key: "signed_digital", label: "Signed (Digital)", color: "bg-emerald-50 text-emerald-900 border-emerald-400", dot: "bg-emerald-500" },
  { key: "void", label: "Void", color: "bg-rose-50 text-rose-900 border-rose-300", dot: "bg-rose-500" },
];
