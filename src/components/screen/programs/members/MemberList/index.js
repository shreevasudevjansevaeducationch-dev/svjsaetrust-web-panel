'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react';
import { 
    ClientSideRowModelModule,
    ModuleRegistry,
    NumberEditorModule,
    NumberFilterModule,
    PaginationModule,
    RowSelectionModule,
    TextEditorModule,
    TextFilterModule,
    ValidationModule,
    RowStyleModule
} from 'ag-grid-community';
import { EyeOutlined, EditOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { MdOutlinePendingActions } from "react-icons/md";
import { GrCertificate } from 'react-icons/gr';
import { Avatar, Button, Dropdown, Tag, Tooltip, Select, Space } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { getData } from '@/lib/services/firebaseService';
import { useAuth } from '@/lib/AuthProvider';
import { BsThreeDots } from 'react-icons/bs';
import MemberDetailsView from '../MemberDetailsView';
import EditMember from '../EditMember';
import MemberCertificateCom from '../MemberCertificates';
import { FaFile } from 'react-icons/fa';
import MemberRegForm from '../MemberRegForm';
import { setgetMemberDataChange } from '@/redux/slices/commonSlice';
import ClosingForm from './ClosingForm';
import dayjs from 'dayjs';
import { fetchSingleMemberMarriageReport, getAgentMemberPaystatus } from '@/lib/helper';
import MemberPaymentDetails from './MemberPaymentDetails';

const { Option } = Select;

ModuleRegistry.registerModules([
    NumberEditorModule,
    TextEditorModule,
    TextFilterModule,
    NumberFilterModule,
    RowSelectionModule,
    PaginationModule,
    ClientSideRowModelModule,
    ValidationModule /* Development Only */,
    RowStyleModule
]);

const MemberList = () => {
    const [allMembersData, setAllMembersData] = useState([]);
    const [filteredMembersData, setFilteredMembersData] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [isDetailsView, setIsDetailsView] = useState(false);
    const [isEditmemberOpen, setIsEditmemberOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isOpenRegModal, setIsOpenRegModal] = useState(false);
    const [isOpenClosingForm, setIsOpenClosingForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Filter states
    const [statusFilter, setStatusFilter] = useState('active');
    const [genderFilter, setGenderFilter] = useState('all');

    const dispatch = useDispatch();
    const memberStatusChange = useSelector((state) => state.data.getMemberDataChange);
    const selectedProgram = useSelector((state) => state.data.selectedProgram);
    const agentList = useSelector((state) => state.data.agentList);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    

    const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);
const [paymentReport, setPaymentReport] = useState(null);
const [loadingReport, setLoadingReport] = useState(false);

    const defaultColDef = {
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1,
        minWidth: 100,
    };

    const { user } = useAuth();
    const gridRef = useRef();

    // Filter options
    const statusFilterOptions = [
        { value: 'active', label: 'Active Members', color: 'green' },
        { value: 'blocked', label: 'Blocked Members', color: 'red' }
    ];

    const genderFilterOptions = [
        { value: 'all', label: 'All Gender', color: 'blue' },
        { value: 'male', label: 'Male', color: 'blue' },
        { value: 'female', label: 'Female', color: 'pink' }
    ];

    const downloadPdf = async (data) => {
    try {
        const res = await fetch(
        "/api/certificate-send",
        {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            },
            body: JSON.stringify({
            memberData: data,
            selectedProgram,
            }),
        }
        );
    console.log(res,"res")
        if (!res.ok) {
        throw new Error("Failed to generate PDF");
        }

        const { base64 } = await res.json();
    console.log(base64,"base64")
        // 🔹 base64 → Blob
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
        type: "application/pdf",
        });

        // 🔹 download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "member-report.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Browser PDF error:", error);
        alert("Failed to download PDF");
    }
    };

    const handleShowPaymentDetails = async (data) => {
    setSelectedMember(data);
    setLoadingReport(true);
    setIsPaymentDetailsOpen(true);
    
    try {
        const res = await fetchSingleMemberMarriageReport({
            userId: user.uid,
            programId: selectedProgram.id,
            memberId: data.id
        });
        
        setPaymentReport(res);
    } catch (error) {
        console.error('Error fetching payment report:', error);
        message.error('Failed to load payment details');
    } finally {
        setLoadingReport(false);
    }
};

       async function loadAgentList(dataM) {
        console.log(dataM,'dataM')
      try {
        const data = await getAgentMemberPaystatus({
          userId: user.uid,
          programId: selectedProgram.id,
          agentId: dataM.agentId,
        });
    console.log(data,"data")
      } catch (err) {
      console.log(err,"err")
      }
    }
    const COL_DEFS = [  
        { 
            field: "displayName",   
            cellDataType: 'text', 
            headerName: "Name", 
            pinned: 'left', 
            cellRenderer: (props) => {
                let statusBadge = null;
                let statusClass = 'bg-white';
                
                // Determine status badge
                if (props.data.status === 'blocked') {
                    statusBadge = <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>;
                    statusClass = 'bg-red-50';
                } 

                return (
                    <div className={`flex items-center gap-2 relative ${statusClass}`}>
                        <div className={`absolute -left-2.5 top-[50%] ${!props.data.joinFeesDone?'bg-red-500':'bg-green-500'} h-2 w-2 rounded-full translate-y-[-50%]`}></div>
                        <Avatar
                            src={props.data.photoURL}
                            alt={props.data.displayName}
                            size={30}
                        />
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                           
                                <h1 className="font-medium">{props.data.displayName}</h1>
                            </div>
                            <span className="text-xs text-gray-500">
                                {props.data.status === 'blocked' ? 'Blocked' : 
                                 props.data.delete_flag === true ? 'Deleted' : 
                                 props.data.status === 'closed' ? 'Closed' : 
                                 props.data.status === 'accepted' ? 'Active' : 
                                 'Pending'}
                            </span>
                        </div>
                    </div>
                );
            }
        },
        { field: "fatherName", headerName: "Father Name", width: 150, cellDataType: "text" },
        { field: "jati", headerName: "Surname", width: 150, cellDataType: "text" },
        { 
            field: "registrationNumber", 
            headerName: "Registration Number", 
            cellDataType: "text",
            cellRenderer: (props) => {
                const regNo = props.data.registrationNumber;
                return <div className="font-semibold">{regNo || '-'}</div>;
            }
        },
        { field: "phone", headerName: "Phone", width: 120, cellDataType: "text" },
        { 
            field: "gender", 
            headerName: "Gender", 
            width: 100, 
            cellDataType: "text",
            cellRenderer: (props) => {
                const gender = props.data.gender;
                if (!gender) return '-';
                
                return (
                    <Tag color={gender === 'male' ? 'blue' : gender === 'female' ? 'pink' : 'default'}>
                        {gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender}
                    </Tag>
                );
            }
        },
        { field: "state", headerName: "State", width: 100, cellDataType: "text" },
        { 
            field: "addedByName", 
            headerName: "Created By",
            cellRenderer: (props) => {
                return <div>{props.data.addedByName}</div>;
            }
        },
        { field: "aadhaarNo", headerName: "Aadhaar Card Number", cellDataType: 'text' },
        { 
            field: "payAmount", 
            headerName: "D Amount", 
            cellRenderer: (props) => (
                <div className="flex items-center gap-2">
                    <div title={props.data.processedTooltipText} className={`h-2 w-2 rounded-full ${props.data.processedColorClass}`} />
                    <div>{props.data.payAmount}</div>
                </div>
            )
        },
        { field: "ageGroupRange", headerName: "Age Group", cellDataType: "text", width: 130 },
        { 
            field: "createdAt", 
            headerName: "Created Date", 
            width: 150,
            cellRenderer: (props) => {
                return props.data.dateJoin ? props.data.dateJoin : '-';
            }
        },
        {
            field: "Action",
            headerName: "Action",
            pinned: 'right',
            width: 150,
            filter: false,
            cellRenderer: (props) => {
                const { data } = props;
                
                // Disable actions for deleted members
                const isDeleted = data.delete_flag === true;
                const isBlocked = data.status === 'blocked';
                const isClosed = data.status === 'closed' && data.marriage_flag === true;
                
                const items = [
                    {
                        label: (
                            <div>
                                <Button 
                                    title='Close Form' 
                                    type="default"  
                                    onClick={() => {
                                        setSelectedMember(data);
                                        setIsOpenClosingForm(true);
                                    }} 
                                    className="flex items-center justify-center w-auto h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border-blue-200 hover:scale-105 transition-transform" 
                                    disabled={isDeleted || isBlocked || isClosed}
                                >
                                    <PlusCircleOutlined/> Close Form
                                </Button>
                            </div>
                        ),
                        key: '0',
                        disabled: isDeleted || isBlocked || isClosed,
                    },
                    {
                        label: (
                            <Tooltip title={data?.displayName ? `View ${data.displayName}'s Certificate` : 'Generate Certificate'}>
                                <Button
                                    type="default"
                                    onClick={() => {
                                        setSelectedMember(data);
                                        setIsModalOpen(true);
                                    }}
                                    className="flex items-center justify-center w-auto h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border-blue-200 hover:scale-105 transition-transform" 
                                    disabled={isDeleted}
                                >
                                    <GrCertificate className="text-red-500" /> Member Certificate
                                </Button>
                            </Tooltip>
                        ),
                        key: '1',
                        disabled: isDeleted,
                    }, 
                    {
                         label: (
        <Tooltip title={data?.displayName ? `${data.displayName}'s payment details` : 'View Payment Details'}>
            <Button
                type="default"
                onClick={() => handleShowPaymentDetails(data)}
                className="flex items-center justify-center w-auto h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border-blue-200 hover:scale-105 transition-transform" 
                disabled={isDeleted || isBlocked || isClosed}
            >
                <MdOutlinePendingActions className="text-red-500" /> Payment Details
            </Button>
        </Tooltip>
    ),
    key: '2',
    disabled: isDeleted || isBlocked || isClosed,
                    },
                    {
                        label: (
                            <Tooltip title={data?.displayName ? `View ${data.displayName}'s Reg Form` : 'Generate Reg Form'}>
                                <Button
                                    type="default"
                                    onClick={() => {
                                        setSelectedMember(data);
                                        setIsOpenRegModal(true);
                                    }}
                                    className="flex items-center justify-center w-auto h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border-blue-200 hover:scale-105 transition-transform" 
                                    disabled={isDeleted}
                                >
                                    <FaFile className="text-red-500" /> 
                                    Member Reg Form
                                </Button>
                            </Tooltip>
                        ),
                        key: '3',
                        disabled: isDeleted,
                    }, 
                ];

                return (
                    <div>
                        <div className="flex items-center justify-start gap-2">
                            <Tooltip title="View Details">
                                <Button
                                    type="primary"
                                    icon={<EyeOutlined />}
                                    onClick={() => {
                                        // downloadPdf(data)
                                        setSelectedMember(data);
                                        setIsDetailsView(true);
                                    
                                    }}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg hover:scale-105 transition-transform"
                                />
                            </Tooltip>
                            
                            <Tooltip title="Edit Member">
                                <Button
                                    type="default"
                                    icon={<EditOutlined />}
                                    onClick={async() => {
                                    
                                        setSelectedMember(data);
                                        setIsEditmemberOpen(true);
                                    }}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border-blue-200 hover:scale-105 transition-transform"
                                    disabled={isDeleted || isBlocked || isClosed}
                                />
                            </Tooltip>
                            <Tooltip title="More Actions">
                                <Dropdown  
                                    menu={{
                                        items: items.filter(item => !item.disabled)
                                    }} 
                                    trigger={['click']}
                                >
                                    <Button
                                        type="default"
                                        icon={<BsThreeDots />}
                                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border-blue-200 hover:scale-105 transition-transform"
                                        disabled={isDeleted}
                                    />
                                </Dropdown>
                            </Tooltip>
                        </div>
                    </div>
                );
            }
        },
    ];

    // Apply all filters
    const applyFilters = (data) => {
        if (!data || data.length === 0) return data;

        let filteredData = [...data];

        // Apply status filter
        if (statusFilter === 'active') {
            filteredData = filteredData.filter(member => 
                member.status === 'accepted' && 
                member.active_flag === true &&
                !member.delete_flag
            );
        } else if (statusFilter === 'blocked') {
            filteredData = filteredData.filter(member => 
                member.status === 'blocked' && 
                member.active_flag === false &&
                !member.delete_flag
            );
        }

        // Apply gender filter
        if (genderFilter !== 'all') {
            filteredData = filteredData.filter(member => 
                member.gender?.toLowerCase() === genderFilter.toLowerCase()
            );
        }

        return filteredData;
    };

    const onGridReady = useCallback(async (params) => {
        setIsLoading(true);
        try {
            const memberData = await getData(
                `/users/${user.uid}/programs/${selectedProgram?.id}/members`,
                [
                    {
                        field: 'delete_flag',
                        operator: '==',
                        value: false
                    }
                ],
                {
                    field: 'createdAt',
                    direction: 'desc'
                }
            );
            
            dispatch(setgetMemberDataChange(false));
            setAllMembersData(memberData);
            
            // Apply initial filters
            const filteredData = applyFilters(memberData);
            setFilteredMembersData(filteredData);
            
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedProgram, agentList, memberStatusChange, statusFilter, genderFilter]);

    // Handle filter changes
    const handleStatusFilterChange = (value) => {
        setStatusFilter(value);
    };

    const handleGenderFilterChange = (value) => {
        setGenderFilter(value);
    };

    // Update filtered data when filters change
    useEffect(() => {
        if (allMembersData.length > 0) {
            const filteredData = applyFilters(allMembersData);
            setFilteredMembersData(filteredData);
        }
    }, [statusFilter, genderFilter, allMembersData]);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };
       
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    useEffect(() => {
        if(selectedProgram){
            onGridReady();
        }
    }, [selectedProgram,memberStatusChange]);

    return (
        <div>
            {/* Filter Controls */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <Space wrap className="w-full justify-between">
                    <Space wrap>
                        <Select
                            value={statusFilter}
                            onChange={handleStatusFilterChange}
                            style={{ width: 180 }}
                            size="middle"
                        >
                            {statusFilterOptions.map(option => (
                                <Option key={option.value} value={option.value}>
                                    <Tag color={option.color} style={{ marginRight: 8 }}>{option.label}</Tag>
                                </Option>
                            ))}
                        </Select>
                        
                        <Select
                            value={genderFilter}
                            onChange={handleGenderFilterChange}
                            style={{ width: 150 }}
                            size="middle"
                        >
                            {genderFilterOptions.map(option => (
                                <Option key={option.value} value={option.value}>
                                    <Tag color={option.color} style={{ marginRight: 8 }}>{option.label}</Tag>
                                </Option>
                            ))}
                        </Select>
                    </Space>
                    
                    <Tag color="blue" className="text-sm">
                        Showing: {filteredMembersData.length} members
                    </Tag>
                </Space>
            </div>

            {/* AG Grid */}
            <div style={{ height: windowWidth < 768 ? '70vh' : '65vh' }}>
                <AgGridReact
                    ref={gridRef}
                    style={{ height: '100%' }}
                    rowData={filteredMembersData}
                    loading={isLoading}
                    defaultColDef={defaultColDef}
                    overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Loading...</span>'}
                    overlayNoRowsTemplate={'<span class="ag-overlay-loading-center">No Data Available</span>'}
                    columnDefs={COL_DEFS}
                    pagination={true}
                    onGridReady={onGridReady}
                />
            </div>

            {/* Modals */}
            <MemberDetailsView 
                isModalVisible={isDetailsView}
                handleCloseModal={() => setIsDetailsView(false)}
                showDeleteConfirm={false}
                selectedMember={selectedMember}
            />
            
            <EditMember 
                open={isEditmemberOpen} 
                setOpen={setIsEditmemberOpen} 
                memberData={selectedMember} 
                programId={selectedProgram?.id} 
                onSuccess={onGridReady} 
            />
            
            <MemberCertificateCom 
                open={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                memberData={selectedMember}
            />
            
            <MemberRegForm 
                open={isOpenRegModal} 
                onClose={() => setIsOpenRegModal(false)} 
                memberData={selectedMember}
            />
            
            {isOpenClosingForm && (
                <ClosingForm 
                    open={isOpenClosingForm} 
                    onClose={() => setIsOpenClosingForm(false)} 
                    memberData={selectedMember} 
                    user={user} 
                    selectedProgram={selectedProgram} 
                    onSuccess={onGridReady}
                />
            )}

<MemberPaymentDetails
    visible={isPaymentDetailsOpen}
    onClose={() => {
        setIsPaymentDetailsOpen(false);
        setPaymentReport(null);
    }}
    memberData={selectedMember}
    paymentReport={paymentReport}
    loading={loadingReport}
/>
               
        </div>
    );
}

export default MemberList;