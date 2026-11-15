'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { spksApi } from '@/lib/spks-api';
import { DataTable } from '@/components/kit/DataTable';
import { Button } from '@/components/kit/Button';
import { Input } from '@/components/kit/Input';
import { Select } from '@/components/kit/Select';
import { StatusPill } from '@/components/kit/StatusPill';
import { Icon } from '@/components/kit/Icon';
import { SpkListItem, SpkListQuery, SpkListResponse } from '@bmi/shared';

interface SpkListProps {
  api: ReturnType<typeof spksApi>;
}

export function SpkList({ api }: SpkListProps) {
  const router = useRouter();
  const [data, setData] = useState<SpkListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<SpkListQuery>({
    tab: 'active',
    page: 1,
    pageSize: 20,
  });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.list(query);
      setData(response);
    } catch (error) {
      console.error('Failed to fetch SPK list:', error);
    } finally {
      setLoading(false);
    }
  }, [api, query]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleTabChange = (tab: SpkListQuery['tab']) => {
    setQuery((prev) => ({ ...prev, tab: tab ?? 'active', page: 1 }));
  };

  const handleSearch = (search: string) => {
    setQuery((prev) => ({ ...prev, search: search || undefined, page: 1 }));
  };

  const handleTypeChange = (type: SpkListQuery['type']) => {
    setQuery((prev) => ({ ...prev, type: type ?? undefined, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setQuery((prev) => ({ ...prev, page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setQuery((prev) => ({ ...prev, pageSize, page: 1 }));
  };

  const tabs = [
    { key: 'active', label: 'Active' },
    { key: 'mine', label: 'My steps' },
    { key: 'draft', label: 'Draft' },
    { key: 'pending', label: 'Pending approval' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'all', label: 'All' },
  ];

  const getTabCount = (tab: SpkListQuery['tab']) => {
    if (!data?.tabCounts) return 0;
    return data.tabCounts[tab ?? 'active'] ?? 0;
  };

  const statusPillVariant = (status: string) => {
    const variantMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
      Active: 'success',
      In_Progress: 'info',
      Pending_Verification: 'warning',
      Pending_Amendment: 'warning',
      Pending_Approval: 'warning',
      Draft: 'neutral',
      Rejected: 'danger',
      Completed: 'success',
      Cancelled: 'neutral',
    };
    return variantMap[status] || 'neutral';
  };

  return (
    <div className="spk-list">
      <div className="spk-list-header">
        <h1>Surat Perintah Kerja</h1>
        <div className="spk-list-actions">
          <Button variant="primary" onClick={() => router.push('/spk/new')}>
            <Icon name="plus" size={16} /> Create SPK
          </Button>
        </div>
      </div>

      <div className="spk-list-toolbar">
        <nav className="spk-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={query.tab === tab.key}
              className={`spk-tab ${query.tab === tab.key ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
              <span className="tab-count">{getTabCount(tab.key)}</span>
            </button>
          ))}
        </nav>

        <div className="spk-filters">
          <Input
            placeholder="Search SPK, vehicle, title..."
            value={query.search ?? ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
          <Select
            value={query.type ?? ''}
            onChange={(e) => handleTypeChange(e.target.value)}
            options={[
              { value: '', label: 'All types' },
              { value: 'PM', label: 'PM' },
              { value: 'Corrective', label: 'Corrective' },
              { value: 'Tyre', label: 'Tyre' },
              { value: 'Document', label: 'Document' },
              { value: 'Other', label: 'Other' },
            ]}
            className="type-select"
          />
        </div>
      </div>

      {loading ? (
        <div className="spk-list-loading">Loading...</div>
      ) : (
        <DataTable<SpkListItem>
          columns={[
            {
              key: 'spkNumber',
              header: 'SPK',
              render: (item) => (
                <a href={`/spk/${item.id}`} className="spk-link">
                  {item.spkNumber}
                </a>
              ),
            },
            {
              key: 'vehicle.licensePlate',
              header: 'Vehicle',
              render: (item) => (
                <a href={`/vehicle/${item.vehicle.id}`} className="vehicle-link">
                  {item.vehicle.licensePlate}
                </a>
              ),
            },
            {
              key: 'category',
              header: 'Type',
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => (
                <StatusPill variant={statusPillVariant(item.status)}>
                  {item.status.replace(/_/g, ' ')}
                </StatusPill>
              ),
            },
            {
              key: 'currentStep',
              header: 'Current step',
              render: (item) => item.currentStep ?? '—',
            },
            {
              key: 'waitingOn',
              header: 'Waiting on',
              render: (item) => item.waitingOn ?? '—',
            },
            {
              key: 'actions',
              header: '',
              render: (item) => (
                <div className="action-buttons">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/spk/${item.id}`)}
                  >
                    View
                  </Button>
                  {item.allowedActions.includes('edit') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/spk/${item.id}/edit`)}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          data={data?.items ?? []}
          pagination={{
            page: data?.pagination.page ?? 1,
            pageSize: data?.pagination.pageSize ?? 20,
            total: data?.pagination.total ?? 0,
            totalPages: data?.pagination.totalPages ?? 0,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
          }}
          loading={loading}
          emptyMessage="No SPKs found"
        />
      )}
    </div>
  );
}