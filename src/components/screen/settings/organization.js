'use client'
import React, { useState } from 'react';
import { Modal, Form, Input, Upload, Button, message, Card, Tooltip } from 'antd';
import { FiImage, FiPlusCircle, FiEdit2, FiInfo } from 'react-icons/fi';
import { useAuth } from '@/lib/AuthProvider';
import { db, storage } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const { TextArea } = Input;

// Trust Data
export const TrsutData = {
    name: "श्री वासुदेव जनसेवा एजुकेशन एंड चैरिटेबल ट्रस्ट",
    cityState: "गुजरात-राजस्थान",
    address: "श्री कुलदेवी स्टील फर्नीचर शोरूम शॉपिंग में,मार्केटयार्ड के सामने,लाखणी-थराद हाईवे,लाखणी,तह. लाखणी, बनासकांठा(वाव-थराद)",
    contact: "9979627618 / 9724133283 / 9924663176",
    contactPerson: "उत्तमसिंह डी. राजपूत",
    trustPresident: "उत्तमसिंह डी. राजपूत",
    email: "",
    website: "",
    regNo: "Guj/7039/BK",
    logo: "/Images/logovjse.jpeg",
    RightLogo: null,
    headerImg: "/Images/headerImg.png",
    topTitle: [
        "॥ श्री गणेशाय नमः ॥",
        "|| जय माताजी ||"
    ]
};

const Organization = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [form] = Form.useForm();
    const { user } = useAuth();
    const [organizationData, setOrganizationData] = useState(TrsutData);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const beforeUpload = (file) => {
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
            message.error('You can only upload image files!');
            return false;
        }
        const isLt2M = file.size / 1024 / 1024 < 2;
        if (!isLt2M) {
            message.error('Image must be smaller than 2MB!');
            return false;
        }
        return false; // Return false to prevent auto upload, we'll handle it manually
    };

    const uploadFileToStorage = async (file, fieldName) => {
        if (!file || !file.originFileObj) return null;
        
        const fileObj = file.originFileObj;
        const storageRef = ref(storage, `organizations/${user.uid}/${fieldName}/${Date.now()}_${fileObj.name}`);
        
        try {
            await uploadBytes(storageRef, fileObj);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error(`Error uploading ${fieldName}:`, error);
            throw error;
        }
    };

    const handleSubmit = async (values) => {
        if (!user?.uid) {
            message.error("User not authenticated!");
            return;
        }
        
        setLoading(true);
        setUploading(true);
        
        try {
            // Process all file uploads
            const uploadPromises = [];
            let logoUrl = values.logo ? (values.logo[0]?.url || null) : null;
            let bannerUrl = values.banner ? (values.banner[0]?.url || null) : null;
            let trustStampUrl = values.trustStamp ? (values.trustStamp[0]?.url || null) : null;

            // Upload logo if it's a new file
            if (values.logo && values.logo[0]?.originFileObj) {
                uploadPromises.push(
                    uploadFileToStorage(values.logo[0], "logo").then(url => {
                        logoUrl = url;
                    })
                );
            }

            // Upload banner if it's a new file
            if (values.banner && values.banner[0]?.originFileObj) {
                uploadPromises.push(
                    uploadFileToStorage(values.banner[0], "banner").then(url => {
                        bannerUrl = url;
                    })
                );
            }

            // Upload trust stamp if it's a new file
            if (values.trustStamp && values.trustStamp[0]?.originFileObj) {
                uploadPromises.push(
                    uploadFileToStorage(values.trustStamp[0], "trustStamp").then(url => {
                        trustStampUrl = url;
                    })
                );
            }

            // Wait for all uploads to complete
            if (uploadPromises.length > 0) {
                await Promise.all(uploadPromises);
            }

            // Process topTitle (convert comma-separated string to array if needed)
            let topTitleArray = values.topTitle;
            if (typeof values.topTitle === 'string') {
                topTitleArray = values.topTitle.split(',').map(title => title.trim());
            }

            // Prepare organization data (ONLY Firestore-compatible data)
            const orgData = {
                name: values.name || TrsutData.name,
                about: values.about || "",
                govtRegNo: values.govtRegNo || "",
                cityState: values.cityState || TrsutData.cityState,
                address: values.address || TrsutData.address,
                contact: values.contact || TrsutData.contact,
                contactPerson: values.contactPerson || TrsutData.contactPerson,
                trustPresident: values.trustPresident || TrsutData.trustPresident,
                email: values.email || "",
                website: values.website || "",
                regNo: values.regNo || TrsutData.regNo,
                topTitle: topTitleArray || TrsutData.topTitle,
                logo: logoUrl || TrsutData.logo,
                banner: bannerUrl,
                trustStamp: trustStampUrl,
                headerImg: values.headerImg || TrsutData.headerImg,
                RightLogo: values.RightLogo || TrsutData.RightLogo,
                updatedAt: new Date().toISOString(),
                updatedBy: user.uid,
            };

            // Remove any undefined values
            Object.keys(orgData).forEach(key => {
                if (orgData[key] === undefined) {
                    delete orgData[key];
                }
            });

            // Save to Firestore
            const orgRef = doc(db, "users", user.uid, "organizations", "trustInfo");
            await setDoc(orgRef, orgData, { merge: true });
            
            // Update local state
            setOrganizationData(orgData);
            
            message.success('Organization details saved successfully!');
            setIsModalOpen(false);
            form.resetFields();
            setIsEditing(false);
        } catch (error) {
            console.error("Error saving organization:", error);
            message.error("Failed to save organization details: " + error.message);
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    const handleEdit = () => {
        // Set form fields with current organization data
        form.setFieldsValue({
            name: organizationData.name,
            about: organizationData.about,
            govtRegNo: organizationData.govtRegNo,
            cityState: organizationData.cityState,
            address: organizationData.address,
            contact: organizationData.contact,
            contactPerson: organizationData.contactPerson,
            trustPresident: organizationData.trustPresident,
            email: organizationData.email,
            website: organizationData.website,
            regNo: organizationData.regNo,
            topTitle: Array.isArray(organizationData.topTitle) 
                ? organizationData.topTitle.join(', ') 
                : organizationData.topTitle,
        });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const normFile = (e) => {
        if (Array.isArray(e)) {
            return e;
        }
        return e?.fileList;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Organization Settings</h1>
                    <p className="text-[var(--gray-300)] mt-1">Manage your organization's profile and information</p>
                </div>
                <Button 
                    type="primary"
                    size="large"
                    icon={<FiPlusCircle className="mr-2" />}
                    onClick={handleEdit}
                    className="bg-[var(--primary-blue)] hover:bg-[var(--primary-dark)]"
                    loading={loading}
                >
                    {organizationData.name === TrsutData.name ? 'Edit Organization Info' : 'Update Organization Info'}
                </Button>
            </div>

            {/* Organization Information Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Info Card */}
                <Card 
                    title={
                        <span className="flex items-center text-lg font-medium">
                            <FiInfo className="mr-2 text-[var(--primary-blue)]" /> Basic Information
                        </span>
                    }
                    extra={
                        <Tooltip title="Edit Organization Info">
                            <Button 
                                type="text" 
                                icon={<FiEdit2 />} 
                                onClick={handleEdit}
                                className="text-[var(--primary-blue)] hover:text-[var(--primary-dark)]"
                            />
                        </Tooltip>
                    }
                    className="shadow-sm hover:shadow-md transition-shadow"
                >
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">Organization Name</h4>
                            <p className="text-[var(--foreground)] text-lg">{organizationData.name}</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">Registration Number</h4>
                            <p className="text-[var(--foreground)]">{organizationData.regNo || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">Government Reg No</h4>
                            <p className="text-[var(--foreground)]">{organizationData.govtRegNo || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">City/State</h4>
                            <p className="text-[var(--foreground)]">{organizationData.cityState || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">Address</h4>
                            <p className="text-[var(--foreground)] text-sm">{organizationData.address || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">About</h4>
                            <p className="text-[var(--foreground)]">{organizationData.about || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">Top Titles</h4>
                            {organizationData.topTitle && Array.isArray(organizationData.topTitle) ? (
                                organizationData.topTitle.map((title, index) => (
                                    <p key={index} className="text-[var(--foreground)] text-sm">{title}</p>
                                ))
                            ) : (
                                <p className="text-[var(--foreground)] text-sm">{organizationData.topTitle}</p>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Contact & Media Card */}
                <Card 
                    title={
                        <span className="flex items-center text-lg font-medium">
                            <FiImage className="mr-2 text-[var(--primary-blue)]" /> Contact & Media Assets
                        </span>
                    }
                    extra={
                        <Tooltip title="Edit Media Assets">
                            <Button 
                                type="text" 
                                icon={<FiEdit2 />} 
                                onClick={handleEdit}
                                className="text-[var(--primary-blue)] hover:text-[var(--primary-dark)]"
                            />
                        </Tooltip>
                    }
                    className="shadow-sm hover:shadow-md transition-shadow"
                >
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">Contact Person</h4>
                            <p className="text-[var(--foreground)]">{organizationData.contactPerson || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">Trust President</h4>
                            <p className="text-[var(--foreground)]">{organizationData.trustPresident || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">Contact Number</h4>
                            <p className="text-[var(--foreground)]">{organizationData.contact || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">Email</h4>
                            <p className="text-[var(--foreground)]">{organizationData.email || "N/A"}</p>
                        </div>
                        <div>
                            <h4 className="font-medium text-[var(--gray-300)]">Website</h4>
                            <p className="text-[var(--foreground)]">{organizationData.website || "N/A"}</p>
                        </div>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-[var(--gray-200)]">
                        <h4 className="font-medium text-[var(--gray-300)] mb-3">Media Assets</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h4 className="text-sm text-[var(--gray-300)]">Logo</h4>
                                <div className="w-32 h-32 rounded-lg border-2 border-[var(--gray-200)] flex items-center justify-center bg-gray-50 overflow-hidden">
                                    <img 
                                        src={organizationData.logo || '/placeholder-logo.png'} 
                                        alt="Organization Logo"
                                        className="max-w-full max-h-full object-contain"
                                        onError={(e) => {
                                            e.target.src = 'https://via.placeholder.com/128?text=Logo';
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-sm text-[var(--gray-300)]">Header Banner</h4>
                                <div className="w-full h-32 rounded-lg border-2 border-[var(--gray-200)] flex items-center justify-center bg-gray-50 overflow-hidden">
                                    <img 
                                        src={organizationData.headerImg || organizationData.banner || '/placeholder-banner.png'} 
                                        alt="Organization Banner"
                                        className="max-w-full max-h-full object-cover rounded-lg"
                                        onError={(e) => {
                                            e.target.src = 'https://via.placeholder.com/400x128?text=Banner';
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Modal Form */}
            <Modal
                title={<h3 className="text-xl font-semibold text-[var(--foreground)]">{isEditing ? 'Edit Organization Details' : 'Add Organization Details'}</h3>}
                open={isModalOpen}
                onCancel={() => {
                    setIsModalOpen(false);
                    form.resetFields();
                    setIsEditing(false);
                }}
                footer={null}
                width={800}
                className="custom-modal"
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    className="mt-4"
                >
                    <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto px-2">
                        {/* Basic Info Section */}
                        <div className="bg-[var(--gray-50)] p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-[var(--gray-400)] mb-3">Basic Information</h4>
                            <div className="space-y-4">
                                <Form.Item
                                    label="Organization Name"
                                    name="name"
                                    rules={[{ required: true, message: 'Please enter organization name' }]}
                                >
                                    <Input placeholder="Enter organization name" className="h-10" />
                                </Form.Item>

                                <Form.Item
                                    label="Registration Number"
                                    name="regNo"
                                    rules={[{ required: true, message: 'Please enter registration number' }]}
                                >
                                    <Input placeholder="Enter registration number (e.g., Guj/7039/BK)" className="h-10" />
                                </Form.Item>

                                <Form.Item
                                    label="Government Registration Number"
                                    name="govtRegNo"
                                >
                                    <Input placeholder="Enter government registration number" className="h-10" />
                                </Form.Item>

                                <Form.Item
                                    label="City/State"
                                    name="cityState"
                                >
                                    <Input placeholder="Enter city and state" className="h-10" />
                                </Form.Item>

                                <Form.Item
                                    label="Address"
                                    name="address"
                                >
                                    <TextArea placeholder="Enter complete address" rows={2} className="resize-none" />
                                </Form.Item>

                                <Form.Item
                                    label="About Organization"
                                    name="about"
                                >
                                    <TextArea placeholder="Enter organization description" rows={3} className="resize-none" />
                                </Form.Item>

                                <Form.Item
                                    label="Top Titles (comma separated)"
                                    name="topTitle"
                                    tooltip="Enter titles separated by commas"
                                >
                                    <Input placeholder="Enter titles separated by commas" className="h-10" />
                                </Form.Item>
                            </div>
                        </div>

                        {/* Contact Info Section */}
                        <div className="bg-[var(--gray-50)] p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-[var(--gray-400)] mb-3">Contact Information</h4>
                            <div className="space-y-4">
                                <Form.Item
                                    label="Contact Person"
                                    name="contactPerson"
                                >
                                    <Input placeholder="Enter contact person name" className="h-10" />
                                </Form.Item>

                                <Form.Item
                                    label="Trust President"
                                    name="trustPresident"
                                >
                                    <Input placeholder="Enter trust president name" className="h-10" />
                                </Form.Item>

                                <Form.Item
                                    label="Contact Number"
                                    name="contact"
                                >
                                    <Input placeholder="Enter contact number" className="h-10" />
                                </Form.Item>

                                <Form.Item
                                    label="Email"
                                    name="email"
                                >
                                    <Input type="email" placeholder="Enter email address" className="h-10" />
                                </Form.Item>

                                <Form.Item
                                    label="Website"
                                    name="website"
                                >
                                    <Input placeholder="Enter website URL" className="h-10" />
                                </Form.Item>
                            </div>
                        </div>

                        {/* Media Section */}
                        <div className="bg-[var(--gray-50)] p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-[var(--gray-400)] mb-3">Media Assets</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Form.Item
                                    label="Logo"
                                    name="logo"
                                    valuePropName="fileList"
                                    getValueFromEvent={normFile}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        beforeUpload={beforeUpload}
                                        className="logo-uploader"
                                    >
                                        <div className="flex flex-col items-center">
                                            <FiImage size={20} className="text-[var(--gray-300)] mb-1" />
                                            <span className="text-xs text-[var(--gray-300)]">Upload Logo</span>
                                        </div>
                                    </Upload>
                                </Form.Item>

                                <Form.Item
                                    label="Banner"
                                    name="banner"
                                    valuePropName="fileList"
                                    getValueFromEvent={normFile}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        beforeUpload={beforeUpload}
                                        className="banner-uploader"
                                    >
                                        <div className="flex flex-col items-center">
                                            <FiImage size={20} className="text-[var(--gray-300)] mb-1" />
                                            <span className="text-xs text-[var(--gray-300)]">Upload Banner</span>
                                        </div>
                                    </Upload>
                                </Form.Item>

                                <Form.Item
                                    label="Trust Stamp"
                                    name="trustStamp"
                                    valuePropName="fileList"
                                    getValueFromEvent={normFile}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        beforeUpload={beforeUpload}
                                        className="stamp-uploader"
                                    >
                                        <div className="flex flex-col items-center">
                                            <FiImage size={20} className="text-[var(--gray-300)] mb-1" />
                                            <span className="text-xs text-[var(--gray-300)]">Upload Stamp</span>
                                        </div>
                                    </Upload>
                                </Form.Item>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[var(--gray-200)]">
                        <Button onClick={() => {
                            setIsModalOpen(false);
                            form.resetFields();
                            setIsEditing(false);
                        }}>
                            Cancel
                        </Button>
                        <Button 
                            type="primary" 
                            htmlType="submit"
                            className="bg-[var(--primary-blue)] hover:bg-[var(--primary-dark)]"
                            loading={loading || uploading}
                        >
                            {isEditing ? 'Update Changes' : 'Save Changes'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default Organization;