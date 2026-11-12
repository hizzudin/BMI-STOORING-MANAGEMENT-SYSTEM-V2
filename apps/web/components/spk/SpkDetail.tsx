"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { SpksApi } from "../../lib/spks-api";
import type { SpkDetail, SpkAssignment, SpkPartLine, SpkServiceLine, SpkHistoryEntry, SpkChangeRequestSummary, SpkDetailTab } from "@bmi/shared";
import { Icon } from "../kit/Icon";
import { PageHead } from "../shell/AppShell";
import { StatusPill } from "../kit/StatusPill";
import { Button } from "../kit/Button";
import { DataTable } from "../kit/DataTable";

const DETAIL_TABS: { key: SpkDetailTab; label: string; icon: string }[] = [
  { key: "steps", label: "Steps", icon: "wrench" },
  { key: "parts", label: "Parts and services", icon: "wrench" },
  { key: "cost", label: "Cost", icon: "reports" },
  { key: "history", label: "History", icon: "clock" },
  { key: "cr", label: "Change requests", icon: "wrench" },
];

interface SpkDetailProps {
  api: SpksApi;
}

export function SpkDetail({ api }: SpkDetailProps) {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string);
  const [spk, setSpk] = useState<SpkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SpkDetailTab>("steps");

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.detail(id);
      if (result.ok && result.data) {
        setSpk(result.data.spk);
      } else {
        setError((result as { message?: string }).message || "Failed to load SPK detail");
      }
    } catch (e) {
      setError("Failed to load SPK detail");
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="alert error">{error}</div>;
  if (!spk) return <div className="alert error">SPK not found</div>;

  const canCancel = spk.allowedActions.includes("cancel");
  const canChangeRequest = spk.allowedActions.includes("change_request");
  const canReverseIssue = spk.allowedActions.includes("reverse_issue");
  const canAssign = spk.allowedActions.includes("assign");
  const canReassign = spk.allowedActions.includes("reassign");
  const canCorrectTime = spk.allowedActions.includes("correct_time");
  const canViewDocument = spk.allowedActions.includes("document");

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

  const getPriorityPill = (priority: string) => {
    const variantMap: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
      "Urgent": "danger", "High": "warning", "Normal": "info", "Low": "neutral",
    };
    return <StatusPill tone={variantMap[priority] || "info"}>{
      priority
    }</StatusPill>;
  };

  const getStepStatusPill = (status: string) => {
    const statusMap: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
      "Locked": "neutral", "Open": "info", "In Progress": "info", "In_Progress": "info",
      "Submitted": "warning", "Verified": "success", "Skipped": "neutral",
    };
    return <StatusPill tone={statusMap[status] || "neutral"}>{
      status.replace("_", " ")
    }</StatusPill>;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("id-ID", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
  };

  const statusPill = getStatusPill(spk.status);

  return (
    <div>
      <PageHead
        title={spk.title}
        status={statusPill}
        actions={
          <>
            {getPriorityPill(spk.priority)}
            <span className="grow" />
            {spk.allowedActions.includes("document") && (
              <Button variant="ghost">
                <a href={`/spk/${spk.id}/document`}>
                  <Icon name="documents" size={16} /> SPK document
                </a>
              </Button>
            )}
            {spk.allowedActions.includes("change_request") && (
              <Button>
                <a href={`/spk/${spk.id}/change-request`}>
                  <Icon name="wrench" size={16} /> Raise change request
                </a>
              </Button>
            )}
            {spk.allowedActions.includes("cancel") && (
              <Button variant="danger">
                <a href={`/spk/${spk.id}/cancel`}>
                  <Icon name="close" size={16} /> Cancel SPK
                </a>
              </Button>
            )}
          </>
        }
      />
      <p className="spk-meta">
        <a href={`/vehicles/${spk.vehicle.id}`} className="nowrap">{spk.vehicle.licensePlate}</a>
        {" · "}{spk.vehicle.className}{" · "}{spk.vehicle.currentOdometer?.toLocaleString("id-ID") || "0"} km
        {" · "}created by {spk.createdByName || "—"} · approved by {spk.approvedByName || "—"}
      </p>

      <nav className="tabs" aria-label="Detail tabs" role="tablist">
        {DETAIL_TABS.map(({ key, label, icon }) => {
          let count = 0;
          if (key === "cr") count = spk.changeRequests?.length || 0;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              className={`tab-pill ${activeTab === key ? "active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon name={icon as any} size={14} /> {label}
              {count > 0 && <span className="tab-count">{count}</span>}
            </button>
          );
        })}
      </nav>

      {activeTab === "steps" && (
        <section className="steps-panel">
          <div className="step-tracker">
            {spk.assignments?.map((asg, idx) => {
              const currentIdx = spk.assignments.findIndex(a => a.status === "Open" || a.status === "In_Progress");
              return (
                <div key={asg.id} className={`step-marker ${idx === currentIdx ? "current" : ""} ${asg.status === "Verified" ? "done" : ""} ${asg.status === "Locked" ? "locked" : ""}`}>
                  <span className="num">{asg.sequenceNo}</span>
                  <span className="icon"><Icon name={asg.moduleIcon as any} size={16} /></span>
                  <span className="label">{asg.moduleName}</span>
                  <span className="status">{getStepStatusPill(asg.status)}</span>
                </div>
              );
            })}
          </div>

          <div className="step-cards">
            {spk.assignments?.map((asg) => {
              const isCurrentUserStep = asg.allowedActions.includes("start") || asg.allowedActions.includes("verify");
              const isOpen = asg.status === "Open" || asg.status === "In_Progress";
              return (
                <div key={asg.id} className={`step-card ${isCurrentUserStep ? "mine" : ""} ${asg.status === "Locked" ? "locked" : ""} ${asg.status === "Submitted" ? "submitted" : ""} ${asg.status === "Verified" ? "verified" : ""}`}>
                  <div className="step-header">
                    <span className="step-num">{asg.sequenceNo}</span>
                    <Icon name={asg.moduleIcon as any} size={20} />
                    <div className="step-info">
                      <strong>{asg.moduleName}</strong>
                      <small>{asg.assignedTo?.name || asg.executorRoles?.join(", ")}</small>
                    </div>
                    {getStepStatusPill(asg.status)}
                  </div>
                  <div className="step-meta">
                    {asg.openedAt && <span><Icon name="clock" size={12} /> Opened: {formatDate(asg.openedAt)}</span>}
                    {asg.startedAt && <span><Icon name="schedule" size={12} /> Started: {formatDate(asg.startedAt)}</span>}
                    {asg.submittedAt && <span><Icon name="approvals" size={12} /> Submitted: {formatDate(asg.submittedAt)}</span>}
                    {asg.verifiedAt && <span><Icon name="approvals" size={12} /> Verified: {formatDate(asg.verifiedAt)}</span>}
                    {asg.returnNote && <span className="return-note">Returned: {asg.returnNote}</span>}
                    {asg.isOptional && <StatusPill tone="neutral">Optional</StatusPill>}
                  </div>
                  <div className="step-actions">
                    {isOpen && asg.allowedActions.includes("start") && (
                      <Button>
                        <a href={`/steps/${asg.module.toLowerCase()}/${spk.id}/${asg.sequenceNo}`}>Open step</a>
                      </Button>
                    )}
                    {asg.allowedActions.includes("verify") && (
                      <Button variant="primary">
                        <a href={`/steps/verify/${spk.id}/${asg.sequenceNo}`}>Verify</a>
                      </Button>
                    )}
                    {asg.allowedActions.includes("view") && !isCurrentUserStep && (
                      <Button variant="ghost">
                        <a href={`/steps/${asg.module.toLowerCase()}/${spk.id}/${asg.sequenceNo}`}>View</a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="spk-context">
            <div className="card">
              <h3><Icon name="spk" size={18} /> Context</h3>
              {spk.findingNote && (
                <div className="context-row">
                  <Icon name="breakdown" size={16} />
                  <a href="/spk/breakdown-reports" className="b">Report reference: {spk.findingNote}</a>
                </div>
              )}
              <div className="context-row">
                <Icon name="wrench" size={16} />
                <div className="grow">Odometer</div>
                <strong>{spk.vehicle.currentOdometer?.toLocaleString("id-ID") || "0"} km</strong>
              </div>
              <div className="context-row">
                <Icon name="clock" size={16} />
                <div className="grow">Planned day</div>
                <strong>{spk.plannedDay || "—"}</strong>
              </div>
              <div className="context-row">
                <Icon name="route" size={16} />
                <div className="grow">Work location</div>
                <strong>{spk.requiresDowntime ? "Workshop" : "Field"}</strong>
              </div>
              <div className="context-row">
                <Icon name="invoices" size={16} />
                <div className="grow">Cost so far</div>
                <strong>{formatCurrency(spk.costBreakdown?.total || 0)}</strong>
              </div>
            </div>

            <div className="action-bar">
              {spk.allowedActions.includes("assign") && <Button><a href={`/spk/${spk.id}/assign`}><Icon name="users" size={16} /> Assign step</a></Button>}
              {spk.allowedActions.includes("reassign") && <Button variant="ghost"><a href={`/spk/${spk.id}/reassign`}><Icon name="users" size={16} /> Reassign</a></Button>}
              {spk.allowedActions.includes("correct_time") && <Button variant="ghost"><a href={`/spk/${spk.id}/correct-time`}><Icon name="clock" size={16} /> Correct time</a></Button>}
              {spk.allowedActions.includes("reverse_issue") && <Button variant="ghost"><a href={`/steps/stock-reversal/${spk.id}`}><Icon name="inventory" size={16} /> Reverse issue</a></Button>}
            </div>
          </div>
        </section>
      )}

      {activeTab === "parts" && spk && (
        <section className="parts-panel">
          <div className="card">
            <h3><Icon name="inventory" size={18} /> Parts</h3>
            <DataTable
              rows={spk.partLines ?? []}
              columns={[
                { key: "partName", label: "Part", value: (row: SpkPartLine) => row.partName, searchable: true },
                { key: "source", label: "Source", value: (row: SpkPartLine) => row.source, searchable: true },
                { key: "plannedQty", label: "Planned", value: (row: SpkPartLine) => row.plannedQty, align: "end" },
                { key: "usedQty", label: "Used", value: (row: SpkPartLine) => row.usedQty ?? 0, align: "end", render: (row: SpkPartLine) => row.usedQty ?? "—" },
                { key: "unitPrice", label: "Unit price", value: (row: SpkPartLine) => row.unitPrice, align: "end", render: (row: SpkPartLine) => formatCurrency(row.unitPrice) },
                { key: "total", label: "Total", value: (row: SpkPartLine) => row.total, align: "end", render: (row: SpkPartLine) => formatCurrency(row.total) },
                { key: "step", label: "Step", value: (row: SpkPartLine) => row.step },
              ]}
              rowKey={(row) => `${row.partName}-${row.step}`}
            />
          </div>

          <div className="card">
            <h3><Icon name="wrench" size={18} /> Services</h3>
            <DataTable
              rows={spk.serviceLines ?? []}
              columns={[
                { key: "service", label: "Service", value: (row: SpkServiceLine) => row.service, searchable: true },
                { key: "code", label: "Code", value: (row: SpkServiceLine) => row.code },
                { key: "team", label: "Team", value: (row: SpkServiceLine) => row.team },
                { key: "price", label: "Price", value: (row: SpkServiceLine) => row.price, align: "end", render: (row: SpkServiceLine) => formatCurrency(row.price) },
                { key: "step", label: "Step", value: (row: SpkServiceLine) => row.step },
              ]}
              rowKey={(row) => `${row.service}-${row.step}`}
            />
          </div>
        </section>
      )}

      {activeTab === "cost" && spk && (
        <section className="cost-panel">
          <div className="cost-summary">
            <div className="card"><div className="metric"><Icon name="inventory" size={24} /><div><strong>{formatCurrency(spk.costBreakdown?.parts || 0)}</strong><small>Parts</small></div></div></div>
            <div className="card"><div className="metric"><Icon name="wrench" size={24} /><div><strong>{formatCurrency(spk.costBreakdown?.services || 0)}</strong><small>Services</small></div></div></div>
            <div className="card"><div className="metric"><Icon name="route" size={24} /><div><strong>{formatCurrency(spk.costBreakdown?.stooring || 0)}</strong><small>Stooring</small></div></div></div>
            <div className="card"><div className="metric"><Icon name="reports" size={24} /><div><strong>{formatCurrency(spk.costBreakdown?.total || 0)}</strong><small>Cost so far</small></div></div></div>
          </div>

          <DataTable
            rows={[
              ...(spk.partLines?.map((line) => ({ ...line, kind: "Part", total: line.total })) ?? []),
              ...(spk.serviceLines?.map((line) => ({ ...line, kind: "Service", total: line.price })) ?? []),
            ]}
            columns={[
              { key: "partName", label: "Item", value: (row: any) => row.partName || row.service, searchable: true },
              { key: "kind", label: "Kind", value: (row: any) => row.kind },
              { key: "step", label: "Step", value: (row: any) => row.step },
              { key: "total", label: "Amount", value: (row: any) => row.total, align: "end", render: (row: any) => formatCurrency(row.total) },
            ]}
            rowKey={(row: any) => `${row.kind}-${row.partName || row.service}-${row.step}`}
          />
        </section>
      )}

      {activeTab === "history" && spk && (
        <section className="history-panel">
          <DataTable
            rows={spk.history ?? []}
            columns={[
              { key: "when", label: "When", value: (row: SpkHistoryEntry) => row.when, render: (row: SpkHistoryEntry) => formatDate(row.when) },
              { key: "who", label: "Who", value: (row: SpkHistoryEntry) => row.who.name, render: (row: SpkHistoryEntry) => `${row.who.name} <span className="role-pill">${row.who.role}</span>` },
              { key: "what", label: "What", value: (row: SpkHistoryEntry) => row.what },
            ]}
            rowKey={(row) => row.when}
          />
        </section>
      )}

      {activeTab === "cr" && spk && (
        <section className="cr-panel">
          <DataTable
            rows={spk.changeRequests ?? []}
            columns={[
              { key: "crNumber", label: "Request", value: (row: SpkChangeRequestSummary) => row.crNumber },
              { key: "raisedBy", label: "Raised by", value: (row: SpkChangeRequestSummary) => row.raisedBy.name, render: (row: SpkChangeRequestSummary) => row.raisedBy.name },
              { key: "reason", label: "Reason", value: (row: SpkChangeRequestSummary) => row.reason },
              { key: "status", label: "Status", value: (row: SpkChangeRequestSummary) => row.status, render: (row: SpkChangeRequestSummary) => <span className={`status-pill ${row.status === "Approved" ? "ok" : row.status === "Rejected" ? "bad" : "warn"}`}>{row.status}</span> },
              { key: "raisedAt", label: "Raised", value: (row: SpkChangeRequestSummary) => row.raisedAt, render: (row: SpkChangeRequestSummary) => formatDate(row.raisedAt) },
            ]}
            rowKey={(row) => row.id.toString()}
          />
        </section>
      )}
    </div>
  );
}