'use client';
import {
  App, Drawer, Button, Input, InputNumber, Select, Table, Tag, Card,
  Modal, Space, Empty, Spin, Divider, Form, Popconfirm, Switch,
} from 'antd';
import {
  WalletOutlined, PlusOutlined, DeleteOutlined, TeamOutlined,
  UserOutlined, CloseOutlined, EditOutlined, DollarOutlined,
  SearchOutlined, PhoneOutlined, IdcardOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAuth } from '@/lib/AuthProvider';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, getDoc, arrayUnion, arrayRemove, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const { Option } = Select;

const FixedPaymentGroups = ({ open, onClose }) => {
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const selectedProgram = useSelector((s) => s.data.selectedProgram);

  const [groups, setGroups] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // create group
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupAmount, setNewGroupAmount] = useState(15200);
  const [creating, setCreating] = useState(false);

  // add member
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [filteredAddMembers, setFilteredAddMembers] = useState(null);

  const groupsRef = () =>
    collection(db, `users/${user.uid}/programs/${selectedProgram.id}/fixedPaymentGroups`);

  const membersRef = () =>
    collection(db, `users/${user.uid}/programs/${selectedProgram.id}/members`);

  const fetchData = async () => {
    if (!user || !selectedProgram) return;
    setLoading(true);
    try {
      const [groupSnap, memberSnap] = await Promise.all([
        getDocs(query(groupsRef(), where('delete_flag', '==', false))),
        getDocs(query(membersRef(),
          where('delete_flag', '==', false),
          where('status', '==', 'accepted'),
          where('active_flag', '==', true),
        )),
      ]);
      setGroups(groupSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAllMembers(memberSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchData();
  }, [open, user, selectedProgram]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) { message.error('Enter a group name'); return; }
    if (!newGroupAmount || newGroupAmount <= 0) { message.error('Enter a valid amount'); return; }
    setCreating(true);
    try {
      const ref = groupsRef();
      const newGroup = {
        name: newGroupName.trim(),
        fixedAmount: Number(newGroupAmount),
        memberCount: 0,
        members: [],
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        programId: selectedProgram.id,
        delete_flag: false,
      };
      const docRef = await addDoc(ref, newGroup);
      setGroups((prev) => [...prev, { id: docRef.id, ...newGroup }]);
      setNewGroupName('');
      setNewGroupAmount(15200);
      message.success('Group created!');
    } catch (e) {
      console.error(e);
      message.error('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveGroup = (groupId) => {
    const targetGroup = groups.find((g) => g.id === groupId);
    modal.confirm({
      title: 'Delete this group?',
      content: targetGroup?.members?.length
        ? `This group has ${targetGroup.members.length} member(s). Their fixed amount status will also be reset.`
        : 'No members will be affected.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const batch = writeBatch(db);
          batch.update(doc(groupsRef(), groupId), { delete_flag: true });

          // Reset all member docs in this group
          const memberList = targetGroup?.members || [];
          for (const m of memberList) {
            const memberRef = doc(membersRef(), m.memberId);
            batch.update(memberRef, {
              isFixedAmountMember: false,
              fixedAmount: null,
            });
          }

          await batch.commit();
          setGroups((prev) => prev.filter((g) => g.id !== groupId));
          if (selectedGroup?.id === groupId) setSelectedGroup(null);
          message.success(`Group deleted${memberList.length ? ` and ${memberList.length} member(s) reset` : ''}`);
        } catch (e) {
          console.error(e);
          message.error('Failed to delete');
        }
      },
    });
  };

  const handleAddMembers = async () => {
    if (!selectedMemberIds.length || !selectedGroup) return;
    setAddingMembers(true);
    try {
      const batch = writeBatch(db);
      const groupRef = doc(groupsRef(), selectedGroup.id);
      const groupSnap = await getDoc(groupRef);
      const currentMembers = groupSnap.data().members || [];

      // Build new entries and compute the final members array once
      const existingIds = new Set(currentMembers.map((m) => m.memberId));
      const newEntries = [];

      for (const memberId of selectedMemberIds) {
        if (existingIds.has(memberId)) continue;
        const member = allMembers.find((m) => m.id === memberId);
        if (!member) continue;
        newEntries.push({
          memberId: member.id,
          name: member.displayName || '',
          registrationNumber: member.registrationNumber || '',
          fatherName: member.fatherName || '',
          phone: member.phone || '',
          village: member.village || '',
        });
      }

      if (!newEntries.length) {
        message.warning('All selected members are already in this group');
        setAddingMembers(false);
        return;
      }

      // Single update to group doc with final members array + count
      batch.update(groupRef, {
        members: [...currentMembers, ...newEntries],
        memberCount: currentMembers.length + newEntries.length,
      });

      // Update each member doc
      for (const entry of newEntries) {
        const memberRef = doc(membersRef(), entry.memberId);
        batch.update(memberRef, {
          isFixedAmountMember: true,
          fixedAmount: Number(selectedGroup.fixedAmount),
        });
      }

      await batch.commit();

      const updatedGroup = {
        ...selectedGroup,
        members: [...(selectedGroup.members || []), ...newEntries],
        memberCount: (selectedGroup.members?.length || 0) + newEntries.length,
      };
      setGroups((prev) =>
        prev.map((g) => (g.id === selectedGroup.id ? updatedGroup : g))
      );
      setSelectedGroup(updatedGroup);
      setSelectedMemberIds([]);
      setFilteredAddMembers(null);
      setAddMemberModalOpen(false);
      message.success(`${newEntries.length} member(s) added`);
    } catch (e) {
      console.error(e);
      message.error('Failed to add members');
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!selectedGroup) return;
    try {
      const batch = writeBatch(db);
      const groupRef = doc(groupsRef(), selectedGroup.id);
      const groupSnap = await getDoc(groupRef);
      const memberEntry = (groupSnap.data().members || []).find((m) => m.memberId === memberId);
      if (!memberEntry) return;

      batch.update(groupRef, {
        members: arrayRemove(memberEntry),
        memberCount: Math.max(0, (groupSnap.data().memberCount || 0) - 1),
      });

      const memberRef = doc(membersRef(), memberId);
      batch.update(memberRef, {
        isFixedAmountMember: false,
        fixedAmount: null,
      });

      await batch.commit();

      const updatedGroup = {
        ...selectedGroup,
        members: (selectedGroup.members || []).filter((m) => m.memberId !== memberId),
        memberCount: Math.max(0, (selectedGroup.memberCount || 0) - 1),
      };
      setGroups((prev) =>
        prev.map((g) => (g.id === selectedGroup.id ? updatedGroup : g))
      );
      setSelectedGroup(updatedGroup);
      message.success('Member removed from group');
    } catch (e) {
      console.error(e);
      message.error('Failed to remove member');
    }
  };

  const getAvailableMembers = () => {
    const groupMemberIds = new Set((selectedGroup?.members || []).map((m) => m.memberId));
    return allMembers.filter((m) => !groupMemberIds.has(m.id));
  };

  return (
    <Drawer
      title={
        <Space>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <WalletOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>Fixed Payment Groups</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Manage fixed-amount member groups</div>
          </div>
        </Space>
      }
      placement="right"
      onClose={onClose}
      open={open}
      width={600}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* ── Create Group ── */}
          <Card size="small" style={{ marginBottom: 16, background: '#faf5ff', border: '1px solid #e9d5ff' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <PlusOutlined style={{ marginRight: 6 }} />Create New Group
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Input
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                maxLength={40}
                size="middle"
              />
              <InputNumber
                placeholder="Fixed amount"
                value={newGroupAmount}
                onChange={(v) => setNewGroupAmount(v)}
                min={1}
                prefix="₹"
                style={{ width: '100%' }}
                size="middle"
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateGroup}
                loading={creating}
                block
                style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
              >
                Create Group
              </Button>
            </Space>
          </Card>

          {/* ── Groups List ── */}
          {groups.length === 0 ? (
            <Empty description="No groups yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            groups.map((group) => (
              <Card
                key={group.id}
                size="small"
                style={{
                  marginBottom: 10,
                  border: selectedGroup?.id === group.id ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                  cursor: 'pointer',
                  background: selectedGroup?.id === group.id ? '#faf5ff' : '#fff',
                }}
                onClick={() => setSelectedGroup(group)}
                extra={
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => { e.stopPropagation(); handleRemoveGroup(group.id); }}
                  />
                }
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{group.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      <DollarOutlined style={{ marginRight: 4 }} />₹{group.fixedAmount?.toLocaleString('en-IN')} per member
                    </div>
                  </div>
                  <Tag color="purple">{group.memberCount || 0} members</Tag>
                </div>
              </Card>
            ))
          )}

          {/* ── Selected Group Members ── */}
          {selectedGroup && (
            <>
              <Divider style={{ margin: '12px 0', fontSize: 12, color: '#7c3aed' }}>
                <TeamOutlined style={{ marginRight: 6 }} />{selectedGroup.name}
              </Divider>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                  {selectedGroup.members?.length || 0} member(s)
                </span>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                  onClick={() => { setSelectedMemberIds([]); setFilteredAddMembers(null); setAddMemberModalOpen(true); }}
                >
                  Add Members
                </Button>
              </div>

              {(selectedGroup.members || []).length === 0 ? (
                <Empty description="No members in this group" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                (selectedGroup.members || []).map((member) => {
                  const full = allMembers.find((m) => m.id === member.memberId);
                  return (
                    <div
                      key={member.memberId}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                        background: '#f9fafb', border: '1px solid #f3f4f6',
                      }}
                    >
                      <Space>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'linear-gradient(135deg,#a855f7,#7c3aed)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>
                          {full?.displayName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{full?.displayName || member.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{full?.registrationNumber || member.registrationNumber}</div>
                        </div>
                      </Space>
                      <Space size={4}>
                        <Tag color="purple" style={{ margin: 0 }}>₹{Number(selectedGroup.fixedAmount).toLocaleString('en-IN')}</Tag>
                        <Popconfirm
                          title="Remove from this group?"
                          onConfirm={() => handleRemoveMember(member.memberId)}
                          okText="Remove"
                          okType="danger"
                        >
                          <Button type="text" size="small" danger icon={<CloseOutlined />} />
                        </Popconfirm>
                      </Space>
                    </div>
                  );
                })
              )}
            </>
          )}
        </>
      )}

      {/* ── Add Members Modal ── */}
      <Modal
        title={<span><TeamOutlined style={{ marginRight: 8, color: '#7c3aed' }} />Add Members to Group</span>}
        open={addMemberModalOpen}
        onCancel={() => { setSelectedMemberIds([]); setFilteredAddMembers(null); setAddMemberModalOpen(false); }}
        onOk={handleAddMembers}
        confirmLoading={addingMembers}
        okText={`Add (${selectedMemberIds.length})`}
        okButtonProps={{ disabled: selectedMemberIds.length === 0, style: { background: '#7c3aed', borderColor: '#7c3aed' } }}
        width={520}
      >
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#faf5ff', borderRadius: 8, border: '1px solid #e9d5ff', fontSize: 13 }}>
          <DollarOutlined style={{ color: '#7c3aed', marginRight: 6 }} />
          Each member will be set with fixed amount: <strong>₹{Number(selectedGroup?.fixedAmount || 0).toLocaleString('en-IN')}</strong>
        </div>

        {/* Search input */}
        <Input
          placeholder="Search by name, registration number, phone, or Aadhaar..."
          prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
          allowClear
          onChange={(e) => {
            // Filter available members client-side
            const q = e.target.value.toLowerCase().trim();
            const filtered = getAvailableMembers().filter((m) =>
              !q ||
              (m.displayName || '').toLowerCase().includes(q) ||
              (m.fatherName || '').toLowerCase().includes(q) ||
              (m.registrationNumber || '').toLowerCase().includes(q) ||
              (m.phone || '').includes(q) ||
              (m.aadhaarNo || '').includes(q)
            );
            setFilteredAddMembers(filtered);
          }}
          style={{ marginBottom: 12 }}
          size="middle"
        />

        {/* Member list */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, maxHeight: 360, overflowY: 'auto' }}>
          {(() => {
            const members = getAvailableMembers();
            if (members.length === 0) {
              return <Empty description="All members already in this group" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />;
            }
            const list = filteredAddMembers || members;
            if (list.length === 0) {
              return <Empty description="No members match your search" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />;
            }
            return list.map((m) => {
              const isSelected = selectedMemberIds.includes(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setSelectedMemberIds((prev) =>
                      isSelected ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                    );
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    background: isSelected ? '#f5f3ff' : '#fff',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, border: `2px solid ${isSelected ? '#7c3aed' : '#d1d5db'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isSelected ? '#7c3aed' : 'transparent', flexShrink: 0, transition: 'all 0.15s',
                  }}>
                    {isSelected && <CheckCircleOutlined style={{ color: '#fff', fontSize: 12 }} />}
                  </div>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: `hsl(${(m.displayName?.charCodeAt(0) || 0) * 7 % 360},55%,55%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                  }}>
                    {m.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {m.displayName}
                      <Tag style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>{m.registrationNumber || '-'}</Tag>
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 12, marginTop: 1 }}>
                      {m.fatherName && <span><UserOutlined style={{ marginRight: 3 }} />{m.fatherName}</span>}
                      {m.phone && <span><PhoneOutlined style={{ marginRight: 3 }} />{m.phone}</span>}
                      {m.aadhaarNo && <span><IdcardOutlined style={{ marginRight: 3 }} />{m.aadhaarNo.slice(-4).padStart(12, '•')}</span>}
                    </div>
                  </div>
                  {m.village && <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{m.village}</span>}
                </div>
              );
            });
          })()}
        </div>

        {selectedMemberIds.length > 0 && (
          <div style={{ marginTop: 10, padding: '6px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#16a34a' }}>
            <CheckCircleOutlined style={{ marginRight: 6 }} />
            {selectedMemberIds.length} member(s) selected · Total: <strong>₹{(selectedMemberIds.length * Number(selectedGroup?.fixedAmount || 0)).toLocaleString('en-IN')}</strong>
          </div>
        )}
      </Modal>
    </Drawer>
  );
};

export default FixedPaymentGroups;
