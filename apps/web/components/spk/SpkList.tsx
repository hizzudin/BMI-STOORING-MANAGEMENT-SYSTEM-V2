"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SpksApi } from "../../lib/spks-api";
import type { SpkListItem, SpkListTab, SpkCategory, SpkPriority } from "@bmi/shared";
import { Icon } from "../kit/Icon";
import { PageHead } from "../shell/AppShell";
import { StatusPill } from "../kit/StatusPill";
import { Button } from "../kit/Button";
import { DataTable } from "../kit/DataTable";
import { Input } from "../../lib/Input";
import { Select } from "../../lib/Select";

const TABS: { key: SpkListTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "mine", label: "My steps" },
  { key: "draft", label: "Draft" },
  { key: "pending", label: "Pending approval" },
  { key: "rejected", label: "Rejected" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const CATEGORIES: SpkCategory[] = ["PM", "Corrective", "Tyre", "Document", "Other"];

interface SpkListProps {
  api: SpksApi;
}

export function SpkList({ api }: SpkListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<SpkListItem[]>([]);
  const [tabCounts, setTabCounts] = useState<Record<SpkListTab, number>>({
    active: 0, mine: 0, draft: 0, pending: 0, rejected: 0, completed: 0, cancelled: 0, all: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);

  const tab = (searchParams.get("tab") as SpkListTab) || "active";
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";
  const vehicleId = searchParams.get("vehicleId") ? parseInt(searchParams.get("vehicleId")!) : undefined;

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.list(tab, search, type || undefined, vehicleId);
      if (result.ok && result.data) {
        setItems(result.data.spkList.items);
        setTabCounts(result.data.spkList.tabCounts);
        setCanCreate(result.data.spkList.allowedActions.includes("create"));
      } else {
        setError((result as { message?: string }).message || "Failed to load SPK list");
      }
    } catch (e) {
      setError("Failed to load SPK list");
    } finally {
      setLoading(false);
    }
  }, [api, tab, search, type, vehicleId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleTabChange = (newTab: SpkListTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.push("/spk?" + params.toString());
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const params = new URLSearchParams(searchParams.toString());
    const searchValue = formData.get("search") as string;
    if (searchValue) params.set("search", searchValue);
    else params.delete("search");
    router.push("/spk?" + params.toString());
  };

  const handleTypeChange = (newType: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newType) params.set("type", newType);
    else params.delete("type");
    router.push("/spk?" + params.toString());
  };

  const handleVehicleChange = (newVehicleId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newVehicleId) params.set("vehicleId", newVehicleId);
    else params.delete("vehicleId");
    router.push("/spk?" + params.toString());
  };

  const handleRowClick = (item: SpkListItem) => {
    const action = item.isMine && item.allowedActions.includes("open") ? "open" : "view";
    router.push(`/spk/${item.id}${action === "open" ? "?open=step" : ""}`);
  };

  const getStatusPill = (status: string) => {
    const statusMap: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
      "Active": "info", "In Progress": "info", "In_Progress": "info",
      "Pending Verification": "warning", "Pending_Verification": "warning",
      "Pending Approval": "warning", "Pending_Approval": "warning",
      "Pending Amendment": "warning", "Pending_Amendment": "warning",
      "Draft": "neutral", "Rejected": "danger", "Completed": "success", "Cancelled": "neutral",
    };
    return <StatusPill tone={statusMap[status] || "neutral"}>{
      status.replace("_", " ")
    }</StatusPill>;
  };

  const getPriorityPill = (priority: SpkPriority) => {
    const toneMap: Record<SpkPriority, "success" | "warning" | "danger" | "info" | "neutral"> = {
      "Urgent": "danger", "High": "warning", "Normal": "info", "Low": "neutral",
    };
    return <StatusPill tone={toneMap[priority] || "info"}>{priority}</StatusPill>;
  };

  const columns = [
    { key: "spkNumber", label: "SPK", value: (item: SpkListItem) => item.spkNumber, render: (item: SpkListItem) => item.allowedActions.includes("view") ? <a href={`/spk/${item.id}`}>{item.spkNumber}</a> : item.spkNumber, searchable: true },
    { key: "vehicle", label: "Vehicle", value: (item: SpkListItem) => item.vehicle.licensePlate, render: (item: SpkListItem) => <> <a href={`/vehicles/${item.vehicle.id}`}>{item.vehicle.licensePlate}</a> <span className="vehicle-class">{item.vehicle.className}</span> </>, searchable: true },
    { key: "category", label: "Type", value: (item: SpkListItem) => item.category, searchable: true },
    { key: "status", label: "Status", value: (item: SpkListItem) => item.status, render: (item: SpkListItem) => getStatusPill(item.status) },
    { key: "priority", label: "Priority", value: (item: SpkListItem) => item.priority, render: (item: SpkListItem) => getPriorityPill(item.priority) },
    { key: "currentStep", label: "Current step", value: (item: SpkListItem) => item.currentStep || "" },
    { key: "waitingOn", label: "Waiting on", value: (item: SpkListItem) => item.waitingOn || "" },
    { key: "actions", label: "", value: () => "", render: (item: SpkListItem) => (
      <>
        {item.isMine && item.allowedActions.includes("open") && (
          <Button variant="primary">
            <a href={`/spk/${item.id}?open=step`}>Open</a>
          </Button>
        )}
        {item.allowedActions.includes("view") && !item.isMine && (
          <Button variant="ghost">
            <a href={`/spk/${item.id}`}>View</a>
          </Button>
        )}
        {item.allowedActions.includes("edit") && (
          <Button variant="ghost">
            <a href={`/spk/${item.id}/edit`}>Edit</a>
          </Button>
        )}
      </>
    ) },
  ];

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="alert error">{error}</div>;

  return (
    <div>
      <PageHead
        title="Surat Perintah Kerja"
        actions={
          canCreate && (
            <Button>
              <a href="/spk/new">
                <Icon name="plus" size={16} />
                Create SPK
              </a>
            </Button>
          )
        }
      />

      <nav className="tabs" aria-label="SPK tabs" role="tablist">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`tab-pill ${tab === key ? "active" : ""}`}
            onClick={() => handleTabChange(key)}
          >
            {label}
            {tabCounts[key] > 0 && <span className="tab-count">{tabCounts[key]}</span>}
          </button>
        ))}
      </nav>

      <form onSubmit={handleSearch} className="filter-bar">
        <Input
          name="search"
          placeholder="Search SPK, plate, title"
          value={search}
          className="search-input"
        />
        <Select
          name="type"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value)}
          options={[{ value: "", label: "All types" }, ...CATEGORIES.map(c => ({ value: c, label: c }))]}
          className="filter-select"
        />
        <Select
          name="vehicleId"
          value={vehicleId?.toString() || ""}
          onChange={(e) => handleVehicleChange(e.target.value)}
          options={[{ value: "", label: "All vehicles" }]}
          className="filter-select"
        />
      </form>

      <DataTable
        rows={items}
        columns={columns}
        rowKey={(item) => item.id.toString()}
        onSelect={handleRowClick}
      />
    </div>
  );
}
