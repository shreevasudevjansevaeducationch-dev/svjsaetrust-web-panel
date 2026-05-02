import { useAuth } from '@/lib/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  RowStyleModule,
  CellStyleModule
} from 'ag-grid-community';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import AllPaymentPdf from './AllPaymentPdf';
import { Button, Drawer, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from "dayjs"
import { getData } from '@/lib/services/firebaseService';

ModuleRegistry.registerModules([
  NumberEditorModule,
  TextEditorModule,
  TextFilterModule,
  NumberFilterModule,
  RowSelectionModule,
  PaginationModule,
  ClientSideRowModelModule,
  ValidationModule,
  RowStyleModule,
  CellStyleModule
]);

const AllPaymentStatus = ({agentId, agentInfo}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [rowData, setRowData] = useState([]);
  const [aggregatedData, setAggregatedData] = useState([]); // New state for aggregated data
  const gridRef = useRef();
  const [open, setOpen] = useState(false);

  // Status badge renderer
  const StatusRenderer = (props) => {
    if (!props.value) return null;
    
    let statusText = '';
    let bgColor = '';
    let textColor = '';
    
    if (props.value === 'paid') {
      statusText = 'Paid';
      bgColor = 'bg-green-100';
      textColor = 'text-green-800';
    } else if (props.value === 'pending') {
      statusText = 'Pending';
      bgColor = 'bg-yellow-100';
      textColor = 'text-yellow-800';
    } else if (props.value === 'both') {
      statusText = 'Both';
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-800';
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>
        {statusText}
      </span>
    );
  };

  // Currency formatter
  const CurrencyRenderer = (props) => {
    return props.value ? `₹${props.value.toLocaleString('en-IN')}` : '₹0';
  };

  const COL_DEFS = [
    {
      headerName: 'Sr.No',
      field: 'index',
      width: 70,
      pinned: 'left',
      cellStyle: { fontWeight: '600' }
    },
    {
      headerName: 'Reg. No.',
      field: 'registrationNumber',
      width: 120,
      pinned: 'left',
    },
    {
      headerName: 'Member Name',
      field: 'memberName',
      minWidth: 180,
      cellStyle: { fontWeight: '500' }
    },
    {
      headerName: 'Father Name',
      field: 'fatherName',
      minWidth: 150
    },
    {
      headerName: 'Phone',
      field: 'phone',
      width: 130
    },
    {
      headerName: 'Village',
      field: 'village',
      minWidth: 120
    },
    {
      headerName: 'Program',
      field: 'programName',
      minWidth: 200,
      cellStyle: { fontWeight: '600' }
    },
    {
      headerName: 'Pending Amount',
      field: 'totalPending',
      width: 140,
      cellRenderer: CurrencyRenderer,
      type: 'numericColumn',
      cellStyle: { fontWeight: '600', color: '#dc2626' }
    },
    {
      headerName: 'Paid Amount',
      field: 'totalPaid',
      width: 130,
      cellRenderer: CurrencyRenderer,
      type: 'numericColumn',
      cellStyle: { fontWeight: '600', color: '#059669' }
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 110,
      cellRenderer: StatusRenderer
    },
    {
      headerName: 'Pending Count',
      field: 'pendingCount',
      width: 120,
      type: 'numericColumn',
      cellStyle: { backgroundColor: '#fef3c7', fontWeight: '600' }
    },
    {
      headerName: 'Paid Count',
      field: 'paidCount',
      width: 110,
      type: 'numericColumn',
      cellStyle: { backgroundColor: '#dcfce7', fontWeight: '600' }
    }
  ];

  const defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 100,
  };

const getAllProgramsMemberPaymentSummary = async () => {
  console.log("Fetching payment data...");
  const uid = user.uid;
  setIsLoading(true);

  try {
    const programsSnap = await getDocs(
      collection(db, `users/${uid}/programs`)
    );

    const flattenedRows = [];
    const aggregatedMap = {}; // For aggregated data

    for (const programDoc of programsSnap.docs) {
      const programId = programDoc.id;
      const programData = programDoc.data();

      const paymentsRef = collection(
        db,
        `users/${uid}/programs/${programId}/payment_pending`
      );

      const memberData = await getData(
        `/users/${user.uid}/programs/${programId}/members`,
        [
          {
            field: 'agentId',
            operator: '==',
            value: agentId
          },
          {
            field: 'active_flag',
            operator: '==',
            value: true
          },
          {
            field: 'delete_flag',
            operator: '==',
            value: false
          },
          {
            field: 'status',
            operator: '==',
            value: 'accepted'
          }
        ],
        {
          field: 'createdAt',
          direction: 'desc'
        }
      );

      const paymentsSnap = await getDocs(paymentsRef);

      for (const memberDoc of memberData) {
        const memberId = memberDoc.id;
        const memberData = memberDoc;

        const marriageMap = {};
        let memberTotalPaid = 0;
        let memberTotalPending = 0;
        let hasAnyPayment = false; // Flag to check if member has any payments

        paymentsSnap.forEach((pDoc) => {
          const p = pDoc.data();
          if (p.memberId !== memberId) return;

          hasAnyPayment = true; // Member has at least one payment

          const marriageId = p.closingMemberId;
          const amount = Number(p.payAmount || 0);

          if (!marriageMap[marriageId]) {
            marriageMap[marriageId] = {
              closingMemberId: marriageId,
              closingRegNo: p.closingRegNo,
              paidList: [],
              pendingList: [],
              totalPaid: 0,
              totalPending: 0
            };
          }

          const paymentItem = {
            id: pDoc.id,
            amount,
            status: p.status,
            dueDate: p.dueDate
          };

          if (p.status === "paid") {
            marriageMap[marriageId].paidList.push(paymentItem);
            marriageMap[marriageId].totalPaid += amount;
            memberTotalPaid += amount;
          } else {
            marriageMap[marriageId].pendingList.push(paymentItem);
            marriageMap[marriageId].totalPending += amount;
            memberTotalPending += amount;
          }
        });

        // SKIP MEMBER IF NO PAYMENTS FOUND
        if (!hasAnyPayment) {
          console.log(`Skipping member ${memberData.registrationNumber} - No payment transactions found`);
          continue; // Skip to next member
        }

        // Flatten the data structure for AG Grid (detailed view)
        const marriages = Object.values(marriageMap);
        
        // Member with payments - create row for each payment
        marriages.forEach(marriage => {
          const allPayments = [...marriage.paidList, ...marriage.pendingList];
          
          allPayments.forEach(payment => {
            flattenedRows.push({
              programName: programData.name,
              programId,
              memberId,
              memberName: memberData.displayName,
              photoUrl: memberData.photoURL,
              fatherName: memberData.fatherName,
              registrationNumber: memberData.registrationNumber,
              phone: memberData.phone,
              village: memberData.village,
              closingMemberName: `Marriage ID: ${marriage.closingMemberId.substring(0, 8)}...`,
              closingRegNo: marriage.closingRegNo,
              paymentId: payment.id,
              amount: payment.amount,
              status: payment.status,
              dueDate: payment.dueDate,
              memberTotalPaid,
              memberTotalPending
            });
          });
        });

        // Create aggregated data for each member-program combination
        const aggregatedKey = `${memberData.registrationNumber}-${programData.name}`;
        
        if (!aggregatedMap[aggregatedKey]) {
          aggregatedMap[aggregatedKey] = {
            registrationNumber: memberData.registrationNumber,
            memberName: memberData.displayName,
            fatherName: memberData.fatherName,
            phone: memberData.phone,
            village: memberData.village,
            programName: programData.name,
            programId,
            memberId,
            totalPaid: 0,
            totalPending: 0,
            paidCount: 0,
            pendingCount: 0
          };
        }

        // Aggregate payments for this member-program
        marriages.forEach(marriage => {
          aggregatedMap[aggregatedKey].totalPaid += marriage.totalPaid;
          aggregatedMap[aggregatedKey].totalPending += marriage.totalPending;
          aggregatedMap[aggregatedKey].paidCount += marriage.paidList.length;
          aggregatedMap[aggregatedKey].pendingCount += marriage.pendingList.length;
        });
      }
    }

    // Convert aggregated map to array and add status
    const aggregatedArray = Object.values(aggregatedMap).map((item, index) => ({
      ...item,
      index: index + 1,
      status: item.paidCount > 0 && item.pendingCount > 0 
        ? 'both' 
        : item.paidCount > 0 
          ? 'paid' 
          : 'pending'
    }));

    setRowData(flattenedRows);
    setAggregatedData(aggregatedArray); // Set aggregated data
    console.log("✅ Data loaded successfully:", {
      detailedRows: flattenedRows.length,
      aggregatedRows: aggregatedArray.length
    });
  } catch (error) {
    console.error("Error fetching data:", error);
  } finally {
    setIsLoading(false);
  }
};

  useEffect(() => {
    if (user?.uid) {
      getAllProgramsMemberPaymentSummary();
    }
  }, [user]);

  const onGridReady = useCallback((params) => {
    // Grid is ready
  }, []);

  // Export to CSV
  const onExportCSV = () => {
    gridRef.current.api.exportDataAsCsv({
      fileName: 'payment_status_report.csv'
    });
  };

  const getFileName = () => {
    const agentName = agentInfo?.displayName?.replace(/\s+/g, '_') || 'Agent';
    const date = dayjs().format('DDMMYYYY');
    return `${agentName}_Payment_Report_all_yojna_${date}.pdf`;
  };

  // Calculate totals for aggregated data
  const calculateTotals = () => {
    if (aggregatedData.length === 0) return { totalPaid: 0, totalPending: 0, paidCount: 0, pendingCount: 0 };
    
    return {
      totalPaid: aggregatedData.reduce((sum, r) => sum + (r.totalPaid || 0), 0),
      totalPending: aggregatedData.reduce((sum, r) => sum + (r.totalPending || 0), 0),
      paidCount: aggregatedData.reduce((sum, r) => sum + (r.paidCount || 0), 0),
      pendingCount: aggregatedData.reduce((sum, r) => sum + (r.pendingCount || 0), 0),
      totalMembers: new Set(aggregatedData.map(r => r.registrationNumber)).size,
      totalPrograms: new Set(aggregatedData.map(r => r.programName)).size
    };
  };

  const totals = calculateTotals();

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">All Programs Payment Status (Aggregated)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Total Records: {aggregatedData.length} | 
            Unique Members: {totals.totalMembers} | 
            Unique Programs: {totals.totalPrograms}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onExportCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              setOpen(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="ag-theme-alpine h-[calc(100vh-200px)] rounded-lg shadow-lg">
        <AgGridReact
          ref={gridRef}
          rowData={aggregatedData} // Use aggregated data
          loading={isLoading}
          defaultColDef={defaultColDef}
          columnDefs={COL_DEFS}
          pagination={true}
          paginationPageSize={50}
          paginationPageSizeSelector={[20, 50, 100, 200]}
          onGridReady={onGridReady}
          overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Loading payment data...</span>'}
          overlayNoRowsTemplate={'<span class="ag-overlay-loading-center">No payment records found</span>'}
          enableCellTextSelection={true}
          ensureDomOrder={true}
          rowSelection="multiple"
          enableClickSelection={true}
          animateRows={true}
        />
      </div>

      {/* Summary Cards */}
      {!isLoading && aggregatedData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">
              ₹{totals.totalPaid.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              ₹{totals.totalPending.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Paid Payments</p>
            <p className="text-2xl font-bold text-green-600">
              {totals.paidCount}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Pending Payments</p>
            <p className="text-2xl font-bold text-yellow-600">
              {totals.pendingCount}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Unique Members</p>
            <p className="text-2xl font-bold text-blue-600">
              {totals.totalMembers}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Unique Programs</p>
            <p className="text-2xl font-bold text-purple-600">
              {totals.totalPrograms}
            </p>
          </div>
        </div>
      )}

      <Drawer
        title={getFileName()}
        width={800}
        placement="right"
        onClose={() => setOpen(false)}
        open={open}
        maskClosable={false}
        destroyOnHidden={true}
        keyboard={false}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setOpen(false)} size="large">
              Cancel
            </Button>
            <PDFDownloadLink
              document={
                <AllPaymentPdf
                  rowData={aggregatedData} // Pass aggregated data to PDF
                  agentInfo={{
                    ...agentInfo,
                    uid: user?.uid,
                    displayName: agentInfo?.displayName || user?.displayName,
                    phone: agentInfo?.phone || user?.phoneNumber
                  }}
                />
              }
              fileName={getFileName()}
            >
              {({ loading }) => (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  size="large"
                  loading={loading}
                >
                  Export PDF
                </Button>
              )}
            </PDFDownloadLink>
          </Space>
        }
      >
        <PDFViewer style={{ width: '100%', height: '100vh', border: 'none' }}>
          <AllPaymentPdf
            rowData={aggregatedData} // Pass aggregated data to PDF
            agentInfo={{
              ...agentInfo,
              uid: user?.uid,
              displayName: agentInfo?.displayName || user?.displayName,
              phone: agentInfo?.phone || user?.phoneNumber
            }}
          />
        </PDFViewer>
      </Drawer>
    </div>
  );
};

export default AllPaymentStatus;
