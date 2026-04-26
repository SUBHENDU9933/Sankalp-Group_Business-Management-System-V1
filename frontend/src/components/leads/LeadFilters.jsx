import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, KanbanSquare, Table as TableIcon, X,
} from "lucide-react";
import { LEAD_STATUSES, LEAD_SOURCES } from "@/utils/format";

export default function LeadFilters({
  search, onSearchChange,
  status, onStatusChange,
  rm, onRmChange,
  source, onSourceChange,
  fromDate, onFromDateChange,
  toDate, onToDateChange,
  view, onViewChange,
  rmOptions = [],
  isAdmin = false,
  onClear,
}) {
  const hasFilters = search || status !== "all" || rm !== "all" || source !== "all" || fromDate || toDate;
  return (
    <div className="bg-white border border-stone-200" data-testid="leads-filters">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-0 grid-divider-x">
        <div className="flex items-center gap-2 px-4 py-3">
          <Search className="w-4 h-4 text-stone-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, phone, location, area, pincode…"
            className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8"
            data-testid="leads-search-input"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={onClear} className="rounded-none text-xs text-stone-500 hover:text-stone-900 h-7" data-testid="leads-clear-filters">
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>
        <div className="px-4 py-3 flex items-center">
          <Tabs value={view} onValueChange={onViewChange}>
            <TabsList className="rounded-none bg-stone-100 p-0 h-9 border border-stone-300">
              <TabsTrigger value="table" className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white px-3" data-testid="view-table"><TableIcon className="w-4 h-4 mr-1" />Table</TabsTrigger>
              <TabsTrigger value="kanban" className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white px-3" data-testid="view-kanban"><KanbanSquare className="w-4 h-4 mr-1" />Pipeline</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="border-t border-stone-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-0 grid-divider-x">
        <FilterCell label="Status">
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="rounded-none border-0 shadow-none focus:ring-0 h-9 px-0 bg-transparent" data-testid="leads-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all" className="rounded-none">All Statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s.key} value={s.key} className="rounded-none">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterCell>
        {isAdmin && (
          <FilterCell label="Assigned RM">
            <Select value={rm} onValueChange={onRmChange}>
              <SelectTrigger className="rounded-none border-0 shadow-none focus:ring-0 h-9 px-0 bg-transparent" data-testid="leads-rm-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all" className="rounded-none">All RMs</SelectItem>
                <SelectItem value="unassigned" className="rounded-none">Unassigned</SelectItem>
                {rmOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="rounded-none">{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterCell>
        )}
        <FilterCell label="Source">
          <Select value={source} onValueChange={onSourceChange}>
            <SelectTrigger className="rounded-none border-0 shadow-none focus:ring-0 h-9 px-0 bg-transparent" data-testid="leads-source-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all" className="rounded-none">All Sources</SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s} className="rounded-none">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterCell>
        <FilterCell label="From">
          <Input type="date" value={fromDate} onChange={(e) => onFromDateChange(e.target.value)} className="rounded-none border-0 shadow-none focus-visible:ring-0 px-0 h-9" data-testid="leads-from-date" />
        </FilterCell>
        <FilterCell label="To">
          <Input type="date" value={toDate} onChange={(e) => onToDateChange(e.target.value)} className="rounded-none border-0 shadow-none focus-visible:ring-0 px-0 h-9" data-testid="leads-to-date" />
        </FilterCell>
      </div>
    </div>
  );
}

function FilterCell({ label, children }) {
  return (
    <div className="px-4 py-2">
      <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">{label}</div>
      {children}
    </div>
  );
}
