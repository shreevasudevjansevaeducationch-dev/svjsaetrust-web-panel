import React, { useState, useEffect } from 'react';
import { Button, Drawer, Form, Input, InputNumber, Select, Space, Card, Typography, App, Radio, message, Table, Tag } from 'antd';
import { FiPlusCircle, FiTrash2, FiUser, FiMapPin, FiDollarSign, FiCalendar, FiTag, FiEdit2, FiSave } from 'react-icons/fi';
import { useAuth } from '@/lib/AuthProvider';
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setgetMemberDataChange, setPrograms } from '@/redux/slices/commonSlice';
import { useDispatch, useSelector } from 'react-redux';
import { callYojnaSync } from '@/lib/yojnaSync';

const { TextArea } = Input;
const { Title, Text } = Typography;

const AddProgramEdit = ({ program, mode = 'add', onSuccess, triggerButton = null,isDrawerOpen,setIsDrawerOpen }) => {
  const { message: antdMessage, modal: antdModal } = App.useApp();
  const [form] = Form.useForm();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const dispatch=useDispatch()
  const programList = useSelector((state) => state.data.programList);

  const locationGroupTypes = [
    { label: 'Group A', value: 'A' },
    { label: 'Group B', value: 'B' },
    { label: 'Group C', value: 'C' },
  ];

  const programCategories = [
    { label: 'Suraksha', value: 'isSuraksha' },
    { label: 'Mamera', value: 'isMamera' },
    { label: 'Vivah', value: 'isVivah' },
    { label: 'Other', value: 'isOther' },
  ];

  // Initialize form with program data when in edit mode
  useEffect(() => {
    if (mode === 'edit' && program && isDrawerOpen) {
      // Set isSelected from program data (default to false if not exists)
      setIsSelected(program.isSelected || false);
      
      // Determine selected category
      let selectedCategory = 'isOther';
      programCategories.forEach(cat => {
        if (program[cat.value]) {
          selectedCategory = cat.value;
        }
      });

      form.setFieldsValue({
        name: program.name,
        hiname: program.hiname,
        guname: program.guname || "",
        noteLine: program.noteLine || '',
        about: program.about,
        memberCount:program?.memberCount ||  0,
        inactivemembercount:program?.inactivemembercount || 0,
        category: selectedCategory,
        ageGroups: program.ageGroups || [],
        locationGroups: program.locationGroups || [],
      });
    } else if (mode === 'add' && isDrawerOpen) {
      // Reset form for add mode
      setIsSelected(false);
      form.resetFields();
    }
  }, [mode, program, isDrawerOpen, form]);

  // Generate an id only when the group doesn't already have one.
  // (Keeping existing ids matters: members store their age group's id.)
  const generateId = () =>
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  // Compare the age groups being saved against the ones currently stored on the
  // program and return the ones whose joinFee / payAmount actually changed.
  const getChangedFeeGroups = (newGroups) => {
    const oldGroups = program?.ageGroups || [];
    const rangeOf = (g) => `${g?.startAge}-${g?.endAge}`;
    const changed = [];

    (newGroups || []).forEach(newGroup => {
      // Same group = same id; older programs may not have stable ids, so fall
      // back to the same age range.
      const oldGroup = oldGroups.find(g => g.id && g.id === newGroup.id)
        || oldGroups.find(g => rangeOf(g) === rangeOf(newGroup));
      if (!oldGroup) return; // newly added group -> no existing members yet

      const oldJoinFee = Number(oldGroup.joinFee) || 0;
      const newJoinFee = Number(newGroup.joinFee) || 0;
      const oldPayAmount = Number(oldGroup.payAmount) || 0;
      const newPayAmount = Number(newGroup.payAmount) || 0;

      if (oldJoinFee !== newJoinFee || oldPayAmount !== newPayAmount) {
        changed.push({
          id: newGroup.id,
          range: rangeOf(newGroup),
          oldJoinFee,
          newJoinFee,
          oldPayAmount,
          newPayAmount,
        });
      }
    });

    return changed;
  };

  // Ask the user whether the new amounts should also be applied to members that
  // already exist in the affected age groups. Resolves true (yes) / false (no).
  const confirmApplyToExistingMembers = (changedGroups) =>
    new Promise(resolve => {
      antdModal.confirm({
        title: 'Update existing members?',
        width: 640,
        okText: 'Yes, update existing members',
        cancelText: 'No, only change the program',
        content: (
          <div className="space-y-3">
            <Text>
              Joining Fee / Pay Amount changed for the age group(s) below. Do you
              want to apply these new amounts to the existing members in these
              age groups?
            </Text>
            <Table
              size="small"
              pagination={false}
              rowKey="range"
              dataSource={changedGroups}
              columns={[
                { title: 'Age Group', dataIndex: 'range', key: 'range' },
                {
                  title: 'Joining Fee',
                  key: 'joinFee',
                  render: (_, r) =>
                    r.oldJoinFee === r.newJoinFee ? (
                      <Text type="secondary">₹{r.newJoinFee}</Text>
                    ) : (
                      <span>
                        <Text delete type="secondary">₹{r.oldJoinFee}</Text>{' '}
                        <Tag color="green">₹{r.newJoinFee}</Tag>
                      </span>
                    ),
                },
                {
                  title: 'Pay Amount',
                  key: 'payAmount',
                  render: (_, r) =>
                    r.oldPayAmount === r.newPayAmount ? (
                      <Text type="secondary">₹{r.newPayAmount}</Text>
                    ) : (
                      <span>
                        <Text delete type="secondary">₹{r.oldPayAmount}</Text>{' '}
                        <Tag color="green">₹{r.newPayAmount}</Tag>
                      </span>
                    ),
                },
              ]}
            />
            <div className="text-xs text-gray-500">
              <div>If you choose Yes:</div>
              <div>• Pay amount: the member and their unpaid pending closing entries get the new amount. Paid entries and fixed-amount members are not changed.</div>
              <div>• Joining fee: members who have not paid it in full get the new fee (remaining = new fee - already paid). Members who paid in full are not changed.</div>
            </div>
            <Text type="warning" className="block">
              Choosing "No" keeps the old amounts on existing members; only new
              members will get the updated amounts. You can still apply them later
              with "Update existing amounts" on the yojna card.
            </Text>
          </div>
        ),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

  // Apply the new amounts to the existing members of the changed age groups.
  // Done on the server (same rules as "Update existing amounts" on the yojna
  // card): member docs + their unpaid pending closing entries, in safe batches.
  const applyToExistingMembers = async (programId, changedGroups) => {
    const res = await callYojnaSync({
      programId,
      mode: 'apply',
      ranges: changedGroups.map(g => g.range),
    });
    if (res.failedWrites > 0) {
      antdMessage.warning(
        `${res.membersUpdated} member(s) and ${res.entriesUpdated} pending entries updated. ` +
        `${res.failedWrites} could not be updated because they changed meanwhile - ` +
        `use "Update existing amounts" on the yojna card to finish.`,
        8
      );
    } else if (res.membersUpdated > 0 || res.entriesUpdated > 0) {
      antdMessage.success(
        `${res.membersUpdated} existing member(s) and ${res.entriesUpdated} pending entries updated with the new amounts.`
      );
    } else {
      antdMessage.info('No existing members needed a change in the changed age groups.');
    }
  };

  const handleSubmit = async (values) => {
    if (!user?.uid) {
      antdMessage.error("User not authenticated!");
      return;
    }

    // Add unique id to each age group and location group if not exists
    const ageGroupsWithId = (values.ageGroups || []).map(group => ({
      ...group,
      id: group.id || generateId()
    }));

    const locationGroupsWithId = (values.locationGroups || []).map(group => ({
      ...group,
      id: group.id || generateId()
    }));

    // Joining fee / pay amount changed? Ask before touching existing members
    // (edit mode only). The program itself is saved either way.
    let updateExistingMembers = false;
    let changedFeeGroups = [];

    if (mode === 'edit' && program?.id) {
      changedFeeGroups = getChangedFeeGroups(ageGroupsWithId);
      if (changedFeeGroups.length > 0) {
        updateExistingMembers = await confirmApplyToExistingMembers(changedFeeGroups);
      }
    }

    setLoading(true);
    try {

      // Create category flags based on selected category
      const categoryFlags = {
        isSuraksha: false,
        isMamera: false,
        isVivah: false,
        isOther: false,
      };
      
      // Set the selected category to true
      if (values.category) {
        categoryFlags[values.category] = true;
      }

      if (mode === 'add') {
        const programsRef = collection(db, "users", user.uid, "programs");
        await addDoc(programsRef, {
          name: values.name,
          hiname: values.hiname,
          guname: values.guname || "",
          noteLine: values.noteLine || '',
          about: values.about,
          ...categoryFlags,
          isSelected: isSelected,
          ageGroups: ageGroupsWithId,
          memberCount:values?.memberCount,
          inactivemembercount:values?.inactivemembercount,
          locationGroups: locationGroupsWithId,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: user.uid,
        });
        
        antdMessage.success('Program created successfully!');
      } else if (mode === 'edit' && program?.id) {
        const programRef = doc(db, "users", user.uid, "programs", program.id);
        await updateDoc(programRef, {
          name: values.name,
          hiname: values.hiname,
          guname: values.guname || "",
          noteLine: values.noteLine || '',
          about: values.about,
          ...categoryFlags,
          isSelected: isSelected,
            memberCount:parseInt(values?.memberCount) || 0,
          inactivemembercount:parseInt(values?.inactivemembercount) || 0,
          ageGroups: ageGroupsWithId,
          locationGroups: locationGroupsWithId,
          updatedAt: new Date(),
        });
        
        antdMessage.success('Program updated successfully!');

        // Push the new joinFee / payAmount down to existing members if confirmed
        if (updateExistingMembers && changedFeeGroups.length > 0) {
          try {
            await applyToExistingMembers(program.id, changedFeeGroups);
          } catch (memberError) {
            console.error('Error updating existing members:', memberError);
            antdMessage.error('Program saved, but updating existing members failed. Use "Update existing amounts" on the yojna card to try again.', 8);
          }
        }
          const programs=programList.map((item)=>{
        if(item.id ===program.id){
          return {
            ...item,
            memberCount:values?.memberCount,
                 name: values.name,
          hiname: values.hiname,
          guname:values.guname,
          noteLine: values.noteLine || '',
          about: values.about,
          ...categoryFlags,
          isSelected: isSelected,
            memberCount:values?.memberCount,
              inactivemembercount:values?.inactivemembercount,
          ageGroups: ageGroupsWithId,
          locationGroups: locationGroupsWithId,
          updatedAt: new Date(),
          }
        }else{
          return item
        }
      })
      dispatch(setPrograms(programs))
      }
      
    
 
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
      dispatch(setgetMemberDataChange(true));
      form.resetFields();
      setIsDrawerOpen(false);
    } catch (error) {
      console.error(`Error ${mode === 'add' ? 'adding' : 'updating'} program:`, error);
      antdMessage.error(`Failed to ${mode === 'add' ? 'create' : 'update'} program.`);
    }
    setLoading(false);
  };

  const AgeGroupCard = ({ field, remove }) => (
    <Card 
      key={field.key}
      className="bg-white hover:shadow-md transition-all duration-200 border border-gray-200"
      extra={
        <Button
          type="text"
          icon={<FiTrash2 className="text-red-500 hover:text-red-600" />}
          onClick={() => remove(field.name)}
          className="hover:bg-red-50"
        />
      }
      title={
        <div className="flex items-center gap-2">
          <FiCalendar className="text-blue-500" />
          <Text strong>Age Group {field.name + 1}</Text>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-6">
        <Form.Item
          {...field}
          label="Start Age"
          name={[field.name, 'startAge']}
          rules={[{ required: true, message: 'Required' }]}
        >
          <InputNumber 
            placeholder="Start age" 
            className="w-full h-10" 
            min={0}
            max={100}
          />
        </Form.Item>
        <Form.Item
          {...field}
          label="End Age"
          name={[field.name, 'endAge']}
          rules={[{ required: true, message: 'Required' }]}
        >
          <InputNumber 
            placeholder="End age" 
            className="w-full h-10" 
            min={0}
            max={100}
          />
        </Form.Item>
        <Form.Item
          {...field}
          label={
            <div className="flex items-center gap-1">
              <FiDollarSign className="text-green-500" />
              <span>Joining Fee</span>
            </div>
          }
          name={[field.name, 'joinFee']}
          rules={[{ required: true, message: 'Required' }]}
        >
          <InputNumber 
            placeholder="Amount" 
            className="w-full h-10"
            prefix="₹"
            min={0}
          />
        </Form.Item>
        <Form.Item
          {...field}
          label={
            <div className="flex items-center gap-1">
              <FiDollarSign className="text-green-500" />
              <span>Pay Amount</span>
            </div>
          }
          name={[field.name, 'payAmount']}
          rules={[{ required: true, message: 'Required' }]}
        >
          <InputNumber 
            placeholder="Amount" 
            className="w-full h-10"
            prefix="₹"
            min={0}
          />
        </Form.Item>
      </div>
      {/* Hidden field for ID */}
      <Form.Item
        {...field}
        name={[field.name, 'id']}
        hidden
      >
        <Input type="hidden" />
      </Form.Item>
    </Card>
  );

  const LocationGroupCard = ({ field, remove }) => (
    <Card 
      key={field.key}
      className="bg-white hover:shadow-md transition-all duration-200 border border-gray-200"
      extra={
        <Button
          type="text"
          icon={<FiTrash2 className="text-red-500 hover:text-red-600" />}
          onClick={() => remove(field.name)}
          className="hover:bg-red-50"
        />
      }
      title={
        <div className="flex items-center gap-2">
          <FiMapPin className="text-purple-500" />
          <Text strong>Location Group {field.name + 1}</Text>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-6">
        <Form.Item
          {...field}
          label="Group Name"
          name={[field.name, 'groupName']}
          rules={[{ required: true, message: 'Required' }]}
        >
          <Input 
            placeholder="Enter group name" 
            className="h-10 w-full"
            prefix={<FiUser className="text-gray-400" />}
          />
        </Form.Item>
        <Form.Item
          {...field}
          label="Location"
          name={[field.name, 'location']}
          rules={[{ required: true, message: 'Required' }]}
        >
          <Input 
            placeholder="Enter location" 
            className="h-10 w-full"
            prefix={<FiMapPin className="text-gray-400" />}
          />
        </Form.Item>
        <Form.Item
          {...field}
          label="Location Group"
          name={[field.name, 'groupType']}
          rules={[{ required: true, message: 'Required' }]}
          className="col-span-2"
        >
          <Select
            placeholder="Select group type"
            options={locationGroupTypes}
            className="h-10 w-full"
          />
        </Form.Item>
      </div>
      {/* Hidden field for ID */}
      <Form.Item
        {...field}
        name={[field.name, 'id']}
        hidden
      >
        <Input type="hidden" />
      </Form.Item>
    </Card>
  );

  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    form.resetFields();
  };

  return (
    <>
      {/* Custom trigger button or default button */}
   

      <Drawer
        title={
          <div className="flex items-center gap-2">
            {mode === 'edit' ? <FiEdit2 className="text-blue-500" /> : <FiPlusCircle className="text-blue-500" />}
            <Title level={4} className="!mb-0">
              {mode === 'edit' ? 'Edit Program' : 'Create New Program'}
            </Title>
          </div>
        }
        placement="right"
        onClose={handleCloseDrawer}
        open={isDrawerOpen}
        width={600}
        className="custom-drawer"
       destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="h-full"
        >
          <div className="space-y-6 pb-20">
            {/* Basic Information */}
            <Card className="border border-gray-200">
              <Title level={5} className="!mb-4 flex items-center gap-2">
                <FiUser className="text-blue-500" />
                Basic Information
              </Title>
              <Space direction="vertical" className="w-full">
                <Form.Item
                  label="Program Name"
                  name="name"
                  rules={[{ required: true, message: 'Please enter program name' }]}
                >
                  <Input 
                    placeholder="Enter program name" 
                    className="h-10"
                  />
                </Form.Item>
                <Form.Item
                  label="Hindi Yojna Name"
                  name="hiname"
                  rules={[{ required: true, message: 'Please enter yojna name' }]}
                >
                  <Input 
                    placeholder="Enter hindi yojna name" 
                    className="h-10"
                  />
                </Form.Item>
                 <Form.Item
                  label="Gujrati Yojna Name"
                  name="guname"
                  rules={[{ required: true, message: 'Please enter yojna name' }]}
                >
                  <Input 
                    placeholder="Enter Gujrati yojna name" 
                    className="h-10"
                  />
                </Form.Item>
                        <Form.Item
                  label="Member Count"
                  name="memberCount"
                  rules={[{ required: false }]}
                >
                  <Input 
                    placeholder="Enter Member Count" 
                    className="h-10"
                  />
                </Form.Item>
                        
                        <Form.Item
                  label="InActive Member Count"
                  name="inactivemembercount"
                  rules={[{ required: false }]}
                >
                  <Input 
                    placeholder="Enter InActive Member Count" 
                    className="h-10"
                  />
                </Form.Item>
                <Form.Item
                  label="Certificate Note (Hindi)"
                  name="noteLine"
                  rules={[{ required: true, message: 'Please enter note' }]}
                >
                  <Input 
                    placeholder="Enter hindi note for certificate" 
                    className="h-10"
                  />
                </Form.Item>
                <Form.Item
                  label="About Program"
                  name="about"
                  rules={[{ required: true, message: 'Please enter program description' }]}
                >
                  <TextArea
                    placeholder="Enter program description"
                    rows={3}
                    className="resize-none"
                  />
                </Form.Item>

                {/* isSelected Field */}
                <Form.Item
                  label={
                    <div className="flex items-center gap-2">
                      <FiTag className="text-orange-500" />
                      <span>Set as Selected Program</span>
                    </div>
                  }
                  name="isSelected"
                >
                  <Radio.Group 
                    value={isSelected}
                    onChange={(e) => setIsSelected(e.target.value)}
                    className="w-full"
                  >
                    <Space direction="horizontal">
                      <Radio value={true}>Yes</Radio>
                      <Radio value={false}>No</Radio>
                    </Space>
                  </Radio.Group>
                </Form.Item>

                {/* Program Category */}
                <Form.Item
                  label={
                    <div className="flex items-center gap-2">
                      <FiTag className="text-orange-500" />
                      <span>Program Category</span>
                    </div>
                  }
                  name="category"
                  rules={[{ required: true, message: 'Please select a category' }]}
                >
                  <Radio.Group className="w-full">
                    <Space direction="vertical" className="w-full">
                      {programCategories.map(cat => (
                        <Radio key={cat.value} value={cat.value}>
                          {cat.label}
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>
                </Form.Item>
              </Space>
            </Card>

            {/* Age Groups */}
            <Card className="border border-gray-200">
              <Title level={5} className="!mb-4 flex items-center gap-2">
                <FiCalendar className="text-blue-500" />
                Age Groups
              </Title>
              <Form.List name="ageGroups">
                {(fields, { add, remove }) => (
                  <div className="space-y-4">
                    {fields.map(field => (
                      <AgeGroupCard key={field.key} field={field} remove={remove} />
                    ))}
                    <Button 
                      type="dashed" 
                      onClick={() => add()} 
                      className="w-full h-12 flex items-center justify-center gap-2 !border-blue-200 hover:!border-blue-400"
                      icon={<FiPlusCircle />}
                    >
                      Add Age Group
                    </Button>
                  </div>
                )}
              </Form.List>
            </Card>

            {/* Location Groups */}
            <Card className="border border-gray-200">
              <Title level={5} className="!mb-4 flex items-center gap-2">
                <FiMapPin className="text-purple-500" />
                Location Groups
              </Title>
              <Form.List name="locationGroups">
                {(fields, { add, remove }) => (
                  <div className="space-y-4">
                    {fields.map(field => (
                      <LocationGroupCard key={field.key} field={field} remove={remove} />
                    ))}
                    <Button 
                      type="dashed" 
                      onClick={() => add()} 
                      className="w-full h-12 flex items-center justify-center gap-2 !border-purple-200 hover:!border-purple-400"
                      icon={<FiPlusCircle />}
                    >
                      Add Location Group
                    </Button>
                  </div>
                )}
              </Form.List>
            </Card>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
            <div className="flex justify-end gap-3">
              <Button
                onClick={handleCloseDrawer}
                className="hover:bg-gray-50 px-6"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                className="bg-blue-500 hover:bg-blue-600 px-6"
                loading={loading}
                icon={mode === 'edit' ? <FiSave /> : null}
              >
                {mode === 'edit' ? 'Update Program' : 'Create Program'}
              </Button>
            </div>
          </div>
        </Form>
      </Drawer>
    </>
  );
};

export default AddProgramEdit;