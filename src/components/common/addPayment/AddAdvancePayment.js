"use client";
import {
    Drawer, Form, Select, Input, InputNumber, DatePicker, Button,
    App, Tag, Divider, Card, Statistic, Row, Col, Space, Spin, Empty,
} from "antd";
import {
    DollarOutlined, WalletOutlined, CreditCardOutlined,
    UserOutlined, InfoCircleOutlined, CheckCircleOutlined,
    CloseOutlined, CalendarOutlined, TeamOutlined,
    ArrowUpOutlined, BankOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useAuth } from "@/lib/AuthProvider";
import { getData } from "@/lib/services/firebaseService";
import { getAdvanceBalance, addAdvanceCredit } from "@/lib/advancePayment";

const { Option } = Select;
const { TextArea } = Input;

const AddAdvancePayment = ({ open, onClose, onSuccess, preSelectedMember = null }) => {
    const { user } = useAuth();
    const { message } = App.useApp();
    const programList = useSelector((state) => state.data.programList);
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [members, setMembers] = useState([]);
    const [fetchingMembers, setFetchingMembers] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [selectedMember, setSelectedMember] = useState(null);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [success, setSuccess] = useState(false);

    const selectedProgramRedux = useSelector((state) => state.data.selectedProgram);

    const autoSelectPreset = async () => {
        if (!preSelectedMember || !user) return;
        const program = selectedProgramRedux;
        if (!program) return;
        setSelectedProgram(program);
        await getMemberData(program);
        setSelectedMember(preSelectedMember);
        const balance = await getAdvanceBalance(user.uid, program.id, preSelectedMember);
        setCurrentBalance(balance);
    };

    useEffect(() => {
        if (open) {
            form.resetFields();
            setPaymentMethod("cash");
            setSuccess(false);
            setCurrentBalance(0);
            if (!preSelectedMember) {
                setSelectedProgram(null);
                setSelectedMember(null);
                setMembers([]);
            } else {
                autoSelectPreset();
            }
        }
    }, [open, preSelectedMember]);

    const getMemberData = async (program) => {
        if (!user || !program) return;
        setFetchingMembers(true);
        try {
            const data = await getData(
                `/users/${user.uid}/programs/${program.id}/members`,
                [
                    { field: "active_flag", operator: "==", value: true },
                    { field: "delete_flag", operator: "==", value: false },
                    { field: "status", operator: "==", value: "accepted" },
                ],
                { field: "createdAt", direction: "desc" },
            );
            setMembers(data);
        } catch (e) {
            console.error(e);
            message.error("Failed to load members");
        } finally {
            setFetchingMembers(false);
        }
    };

    const handleProgramChange = (programId) => {
        const program = programList.find((p) => p.id === programId);
        setSelectedProgram(program);
        form.setFieldsValue({ member: undefined });
        setSelectedMember(null);
        setCurrentBalance(0);
        getMemberData(program);
    };

    const handleMemberChange = async (memberId) => {
        setSelectedMember(memberId);
        const member = members.find((m) => m.id === memberId);
        if (member) {
            form.setFieldsValue({
                amount: undefined,
                paymentMethod: "cash",
            });
            const balance = await getAdvanceBalance(user.uid, selectedProgram.id, memberId);
            setCurrentBalance(balance);
        }
    };

    const handleSubmit = async (values) => {
        if (!user || !selectedProgram || !selectedMember) {
            message.error("Please select program and member");
            return;
        }
        setLoading(true);
        try {
            const result = await addAdvanceCredit(user.uid, selectedProgram.id, selectedMember, {
                amount: values.amount,
                paymentMethod: values.paymentMethod,
                onlineReference: values.onlineReference || "",
                note: values.note || "",
                transactionDate: values.transactionDate?.toISOString() || new Date().toISOString(),
            });
            setSuccess(true);
            message.success(`Advance payment of ₹${values.amount} added successfully!`);
            const newBalance = await getAdvanceBalance(user.uid, selectedProgram.id, selectedMember);
            setCurrentBalance(newBalance);
            if (onSuccess) onSuccess(result);
            setTimeout(() => {
                form.resetFields();
                if (!preSelectedMember) {
                    setSelectedMember(null);
                    setSelectedProgram(null);
                    setMembers([]);
                }
                setSuccess(false);
                onClose();
            }, 1500);
        } catch (e) {
            console.error(e);
            message.error(e.message || "Failed to add advance payment");
        } finally {
            setLoading(false);
        }
    };

    const getMemberName = (id) => members.find((m) => m.id === id)?.displayName || "";

    return (
        <Drawer
            title={
                <Space>
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                        <WalletOutlined className="text-white text-sm" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold m-0">Add Advance Payment</h3>
                        <p className="text-xs text-gray-400 m-0">Credit to member wallet</p>
                    </div>
                </Space>
            }
            placement="right"
            onClose={() => { if (!loading) onClose(); }}
            open={open}
            width={480}
            closable={!loading}
            destroyOnClose
            footer={
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        onClick={() => form.submit()}
                        icon={<WalletOutlined />}
                        className="bg-purple-600"
                        disabled={success}
                    >
                        {loading ? "Adding..." : "Add Advance Payment"}
                    </Button>
                </div>
            }
        >
            {success ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircleOutlined className="text-green-500 text-2xl" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Advance Added!</h3>
                    <p className="text-gray-500 text-sm">Redirecting...</p>
                </div>
            ) : (
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ paymentDate: dayjs(), paymentMethod: "cash" }}
                    size="middle"
                >
                    {!preSelectedMember && (
                        <>
                            <Form.Item
                                name="program"
                                label="Program"
                                rules={[{ required: true, message: "Select program" }]}
                            >
                                <Select
                                    placeholder="Select program"
                                    size="large"
                                    onChange={handleProgramChange}
                                >
                                    {programList.map((p) => (
                                        <Option key={p.id} value={p.id}>{p.name}</Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="member"
                                label="Member"
                                rules={[{ required: true, message: "Select member" }]}
                            >
                                <Select
                                    placeholder="Search member..."
                                    size="large"
                                    showSearch
                                    loading={fetchingMembers}
                                    disabled={!selectedProgram}
                                    onChange={handleMemberChange}
                                    filterOption={(input, option) =>
                                        (option["data-search"] || "").toLowerCase().includes(input.toLowerCase())
                                    }
                                    notFoundContent={fetchingMembers ? <Spin size="small" /> : "No members found"}
                                >
                                    {members.map((m) => (
                                        <Option
                                            key={m.id}
                                            value={m.id}
                                            data-search={`${m.displayName} ${m.fatherName} ${m.registrationNumber} ${m.phone}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                    {m.displayName?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">{m.displayName}</div>
                                                    <div className="text-xs text-gray-500 truncate">{m.registrationNumber}</div>
                                                </div>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </>
                    )}

                    {selectedMember && (
                        <>
                            <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100 mb-3">
                                <Row gutter={12} align="middle">
                                    <Col span={12}>
                                        <Statistic
                                            title={<span className="text-xs text-purple-600">Current Wallet Balance</span>}
                                            value={currentBalance}
                                            prefix={<WalletOutlined />}
                                            valueStyle={{ color: "#7c3aed", fontSize: 22, fontWeight: 700 }}
                                            suffix={<span className="text-sm">₹</span>}
                                        />
                                    </Col>
                                    <Col span={12}>
                                        <div className="text-right">
                                            <Tag color="purple" className="text-xs">
                                                {getMemberName(selectedMember)}
                                            </Tag>
                                        </div>
                                    </Col>
                                </Row>
                            </Card>

                            <Divider>Payment Details</Divider>

                            <Form.Item
                                name="amount"
                                label="Advance Amount"
                                rules={[
                                    { required: true, message: "Enter amount" },
                                    { type: "number", min: 1, message: "Amount must be > 0" },
                                ]}
                            >
                                <InputNumber
                                    placeholder="Enter amount"
                                    className="w-full"
                                    size="large"
                                    prefix="₹"
                                    min={1}
                                    style={{ width: "100%" }}
                                />
                            </Form.Item>

                            <Form.Item
                                name="paymentMethod"
                                label="Payment Method"
                                rules={[{ required: true }]}
                            >
                                <Select onChange={setPaymentMethod} size="large">
                                    <Option value="cash">
                                        <Space><BankOutlined className="text-green-500" /><span>Cash</span></Space>
                                    </Option>
                                    <Option value="online">
                                        <Space><CreditCardOutlined className="text-blue-500" /><span>Online</span></Space>
                                    </Option>
                                </Select>
                            </Form.Item>

                            {paymentMethod === "online" && (
                                <Form.Item
                                    name="onlineReference"
                                    label="Transaction Reference / UTR"
                                    rules={[{ required: true, message: "Enter UTR number" }]}
                                >
                                    <Input placeholder="Enter UTR/Transaction ID" size="large" />
                                </Form.Item>
                            )}

                            <Form.Item
                                name="transactionDate"
                                label="Payment Date"
                                rules={[{ required: true, message: "Select date" }]}
                            >
                                <DatePicker className="w-full" format="DD/MM/YYYY" size="large" />
                            </Form.Item>

                            <Form.Item name="note" label="Note (Optional)">
                                <TextArea rows={3} placeholder="Add a note about this advance payment..." maxLength={300} showCount size="large" />
                            </Form.Item>

                            <Divider />

                            <Card className="bg-gray-50 border-gray-200" size="small">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Amount to credit:</span>
                                    <span className="text-lg font-bold text-purple-700">
                                        ₹{form.getFieldValue("amount") || 0}
                                    </span>
                                </div>
                                <Divider className="my-2" />
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Balance after credit:</span>
                                    <span className="text-lg font-bold text-green-600">
                                        ₹{(currentBalance + (Number(form.getFieldValue("amount")) || 0))}
                                    </span>
                                </div>
                            </Card>
                        </>
                    )}

                    {!selectedMember && !preSelectedMember && (
                        <div className="text-center py-12 text-gray-400">
                            <WalletOutlined style={{ fontSize: 40 }} />
                            <p className="mt-2">Select a program and member to continue</p>
                        </div>
                    )}
                </Form>
            )}
        </Drawer>
    );
};

export default AddAdvancePayment;
