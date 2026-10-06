"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Table, Alert, Button, Tag, Spin, App } from 'antd';
import { SyncOutlined, ReloadOutlined } from '@ant-design/icons';
import { callYojnaSync as callSyncApi } from '@/lib/yojnaSync';

// "Update existing amounts" for one yojna.
// Shows what would change first (preview); nothing is written until the
// admin presses the Update button. Server side: /api/programs/sync-pay-amount

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const hasChanges = (g) => g.memberDocsToUpdate > 0 || g.entriesToUpdate > 0;

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
  const membersToUpdate = selectedGroups.reduce((s, g) => s + g.memberDocsToUpdate, 0);
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
      title: 'Pay amount',
      key: 'payAmount',
      render: (_, g) => (
        <div>
          {g.payAmount > 0 ? <span className="font-semibold text-green-700">{fmt(g.payAmount)}</span> : <Tag>Not set</Tag>}
          <div className="text-xs text-gray-400">
            {g.membersToUpdate} of {g.members} member(s) to update
          </div>
        </div>
      ),
    },
    {
      title: 'Join fee',
      key: 'joinFee',
      render: (_, g) => (
        <div>
          {g.joinFee === null || g.joinFee === undefined
            ? <Tag>Not set</Tag>
            : <span className="font-semibold text-blue-700">{fmt(g.joinFee)}</span>}
          {g.joinFeeMembersToUpdate > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(g.fromJoinFees || {}).map(([from, count]) => (
                <Tag key={from} color="blue" className="mb-0">
                  {from === 'none' ? 'no fee' : fmt(from)} → {fmt(g.joinFee)} × {count}
                </Tag>
              ))}
            </div>
          )}
          {g.joinFeePaidLeft > 0 && (
            <div className="text-xs text-gray-400 mt-1">{g.joinFeePaidLeft} already paid in full, not changed</div>
          )}
        </div>
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
    skipped.fixed > 0 && `${skipped.fixed} fixed-amount (pay amount only)`,
    skipped.inactive > 0 && `${skipped.inactive} blocked / inactive`,
    skipped.notMember > 0 && `${skipped.notMember} not accepted yet`,
    skipped.noAmount > 0 && `${skipped.noAmount} in an age group with no pay amount set`,
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
      width={980}
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
        message="Applies the pay amount and join fee set in this yojna to existing members and their pending closing entries."
        description="Pay amount: only closing entries on which nothing has been paid yet are changed; fixed-amount members keep their own amount. Join fee: only members who have not paid their join fee in full are changed (remaining = new fee - already paid). Blocked members stay as they are."
      />

      {error && <Alert type="error" showIcon className="mb-4" message={error} />}

      <Spin spinning={loading} tip="Checking members and pending entries...">
        <Table
          size="small"
          rowKey="key"
          columns={columns}
          dataSource={preview?.groups || []}
          pagination={false}
          scroll={{ x: 880 }}
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
