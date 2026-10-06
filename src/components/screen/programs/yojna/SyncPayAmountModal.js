"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Table, Alert, Button, Tag, Spin, App } from 'antd';
import { SyncOutlined, ReloadOutlined } from '@ant-design/icons';
import { getAuth } from 'firebase/auth';

// "Update existing amounts" for one yojna.
// Shows what would change first (preview); nothing is written until the
// admin presses the Update button. Server side: /api/programs/sync-pay-amount

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

async function callSyncApi(body) {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch('/api/programs/sync-pay-amount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const hasChanges = (g) => g.membersToUpdate > 0 || g.entriesToUpdate > 0;

const SyncPayAmountModal = ({ program, open, onClose }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);

  const programId = program?.id;

  const loadPreview = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callSyncApi({ programId, mode: 'preview' });
      setPreview(data);
      setSelectedKeys((data.groups || []).filter(hasChanges).map((g) => g.key));
    } catch (e) {
      setPreview(null);
      setError(e.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    if (open && programId) {
      setPreview(null);
      setSelectedKeys([]);
      loadPreview();
    }
  }, [open, programId, loadPreview]);

  const selectedGroups = (preview?.groups || []).filter((g) => selectedKeys.includes(g.key));
  const membersToUpdate = selectedGroups.reduce((s, g) => s + g.membersToUpdate, 0);
  const entriesToUpdate = selectedGroups.reduce((s, g) => s + g.entriesToUpdate, 0);
  const nothingToDo = membersToUpdate === 0 && entriesToUpdate === 0;

  const handleApply = async () => {
    if (nothingToDo) return;
    setApplying(true);
    try {
      const res = await callSyncApi({ programId, mode: 'apply', ranges: selectedKeys });
      if (res.failedWrites > 0) {
        message.warning(
          `${res.membersUpdated} members and ${res.entriesUpdated} entries updated. ` +
          `${res.failedWrites} could not be updated because they changed meanwhile - press Update again.`
        );
      } else {
        message.success(`${res.membersUpdated} members and ${res.entriesUpdated} pending entries updated.`);
      }
      await loadPreview();
    } catch (e) {
      message.error(e.message || 'Update failed');
    } finally {
      setApplying(false);
    }
  };

  const columns = [
    {
      title: 'Age group',
      key: 'range',
      render: (_, g) => <span className="font-medium">{g.startAge} - {g.endAge} yrs</span>,
    },
    {
      title: 'Yojna amount',
      dataIndex: 'payAmount',
      key: 'payAmount',
      align: 'right',
      render: (v) => (v > 0 ? <span className="font-semibold text-green-700">{fmt(v)}</span> : <Tag>Not set</Tag>),
    },
    {
      title: 'Members',
      key: 'members',
      align: 'right',
      render: (_, g) => (
        <span>
          <span className="font-semibold">{g.membersToUpdate}</span>
          <span className="text-gray-400"> of {g.members} to update</span>
        </span>
      ),
    },
    {
      title: 'Pending entries to update',
      key: 'entries',
      render: (_, g) =>
        g.entriesToUpdate === 0 ? (
          <span className="text-gray-400">None</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {Object.entries(g.fromAmounts || {}).map(([from, count]) => (
              <Tag key={from} color="orange" className="mb-0">
                {from === 'none' ? 'no amount' : fmt(from)} → {fmt(g.payAmount)} × {count}
              </Tag>
            ))}
          </div>
        ),
    },
    {
      title: 'Pending total',
      key: 'total',
      align: 'right',
      render: (_, g) =>
        g.entriesToUpdate === 0 ? (
          <span className="text-gray-400">-</span>
        ) : (
          <span>
            <span className="text-gray-500">{fmt(g.oldEntriesTotal)}</span>
            {' → '}
            <span className="font-semibold">{fmt(g.newEntriesTotal)}</span>
          </span>
        ),
    },
  ];

  const skipped = preview?.skipped || {};
  const skippedParts = [
    skipped.fixed > 0 && `${skipped.fixed} fixed-amount`,
    skipped.inactive > 0 && `${skipped.inactive} blocked / inactive`,
    skipped.notMember > 0 && `${skipped.notMember} not accepted yet`,
    skipped.noAmount > 0 && `${skipped.noAmount} in an age group with no amount set`,
  ].filter(Boolean);

  return (
    <Modal
      title={
        <span>
          <SyncOutlined className="mr-2 text-blue-500" />
          Update existing amounts{program?.name ? ` - ${program.name}` : ''}
        </span>
      }
      open={open}
      onCancel={applying ? undefined : onClose}
      maskClosable={!applying}
      closable={!applying}
      width={900}
      destroyOnHidden
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={loadPreview} disabled={loading || applying}>
          Refresh
        </Button>,
        <Button key="close" onClick={onClose} disabled={applying}>
          Close
        </Button>,
        <Button
          key="apply"
          type="primary"
          loading={applying}
          disabled={loading || !preview || nothingToDo}
          onClick={handleApply}
        >
          {nothingToDo ? 'Nothing to update' : `Update ${membersToUpdate} members, ${entriesToUpdate} entries`}
        </Button>,
      ]}
    >
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="Applies the amount set in this yojna to existing members and their pending closing entries."
        description="Only entries on which nothing has been paid yet are changed. Paid and partly paid entries, fixed-amount members and blocked members stay as they are."
      />

      {error && <Alert type="error" showIcon className="mb-4" message={error} />}

      <Spin spinning={loading} tip="Checking members and pending entries...">
        <Table
          size="small"
          rowKey="key"
          columns={columns}
          dataSource={preview?.groups || []}
          pagination={false}
          scroll={{ x: 760 }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: setSelectedKeys,
            getCheckboxProps: (g) => ({ disabled: !hasChanges(g) || applying }),
          }}
          locale={{ emptyText: loading ? ' ' : 'No age groups in this yojna' }}
        />
      </Spin>

      {preview && skippedParts.length > 0 && (
        <p className="text-xs text-gray-500 mt-3">Left out: {skippedParts.join(', ')}.</p>
      )}

      {preview && skipped.unmatched > 0 && (
        <Alert
          type="warning"
          showIcon
          className="mt-3"
          message={`${skipped.unmatched} member(s) do not fit any age group of this yojna and were left out.`}
          description={
            <span className="text-xs">
              {(preview.unmatchedSamples || [])
                .map((m) => `${m.displayName || 'Member'}${m.registrationNumber ? ` (${m.registrationNumber})` : ''}`)
                .join(', ')}
              {skipped.unmatched > (preview.unmatchedSamples || []).length ? ' ...' : ''}
            </span>
          }
        />
      )}
    </Modal>
  );
};

export default SyncPayAmountModal;
