"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Card, Tooltip, Divider, App } from 'antd';
import { FiPlusCircle, FiPhone, FiMail, FiMapPin, FiGlobe, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin, FaYoutube } from 'react-icons/fa';
import { collection, addDoc, getDocs, query, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from '@/lib/AuthProvider';

const dummyData = {
  phones: [
    { personName: 'John Doe', phone: '+1 (555) 123-4567', designation: 'Trust Manager' },
    { personName: 'Jane Smith', phone: '+1 (555) 987-6543', designation: 'Administrative Head' },
  ],
  emails: [
    { email: 'info@trustorg.com' },
    { email: 'support@trustorg.com' },
  ],
  address: '123 Trust Avenue, Financial District, New York, NY 10004',
  website: 'https://www.trustorg.com',
  socialLinks: {
    facebook: 'https://facebook.com/trustorg',
    twitter: 'https://twitter.com/trustorg',
    instagram: 'https://instagram.com/trustorg',
    linkedin: 'https://linkedin.com/company/trustorg',
    youtube: 'https://youtube.com/trustorg'
  }
};

const Contact = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const { user } = useAuth();
  const [contactData, setContactData] = useState(null);
  const [loading, setLoading] = useState(true);
  const {message}=App.useApp();
  const [contactId, setContactId] = useState(null);

  const fetchContactData = async () => {
    if (!user?.uid) return;
    try {
      const contactRef = collection(db, "users", user.uid, "contact");
      const querySnapshot = await getDocs(query(contactRef));
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        setContactId(doc.id);
        setContactData(doc.data());
      }
    } catch (error) {
      console.error("Error fetching contact data:", error);
      message.error("Failed to load contact information");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchContactData();
  }, [user]);

  const handleSubmit = async (values) => {
    if (!user?.uid) {
      message.error("User not authenticated!");
      return;
    }
    
    try {
      setLoading(true);
      const contactData = {
        phones: values.phones || [],
        emails: values.emails || [],
        address: values.address,
        website: values.website,
        socialLinks: {
          facebook: values.facebook,
          twitter: values.twitter,
          instagram: values.instagram,
          linkedin: values.linkedin,
          youtube: values.youtube
        },
        updatedAt: new Date(),
      };

      if (contactId) {
        // Update existing document
        const docRef = doc(db, "users", user.uid, "contact", contactId);
        await updateDoc(docRef, contactData);
      } else {
        // Create new document
        const contactRef = collection(db, "users", user.uid, "contact");
        await addDoc(contactRef, {
          ...contactData,
          createdAt: new Date(),
          createdBy: user.uid
        });
      }

      message.success('Contact information updated successfully!');
      setIsModalOpen(false);
      fetchContactData(); // Refresh the data
    } catch (error) {
      console.error("Error saving contact:", error);
      message.error('Failed to update contact information');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    form.setFieldsValue({
      phones: contactData?.phones || [],
      emails: contactData?.emails || [],
      address: contactData?.address,
      website: contactData?.website,
      ...contactData?.socialLinks
    });
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    form.resetFields();
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Contact Information</h1>
          <p className="text-[var(--gray-300)] mt-1">Manage your organization's contact details</p>
        </div>
        <Button 
          type="primary"
          size="large"
          icon={<FiPlusCircle className="mr-2" />}
          onClick={() => setIsModalOpen(true)}
          className="bg-[var(--primary-blue)] hover:bg-[var(--primary-dark)]"
        >
          Add Contact Info
        </Button>
      </div>

      {/* Contact Information Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Phone Numbers Card */}
        <Card 
          loading={loading}
          title={
            <span className="flex items-center text-lg font-medium">
              <FiPhone className="mr-2 text-[var(--primary-blue)]" /> Contact Numbers
            </span>
          }
          extra={
            <Tooltip title="Edit Phone Numbers">
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
            {(contactData?.phones || []).map((phone, index) => (
              <div key={index} className="pb-3 border-b last:border-0 border-[var(--gray-200)]">
                <h4 className="font-medium text-[var(--foreground)]">{phone.personName}</h4>
                <p className="text-[var(--gray-300)] text-sm">{phone.designation}</p>
                <p className="text-[var(--primary-blue)] mt-1">{phone.phone}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Email & Website Card */}
        <Card 
          loading={loading}
          title={
            <span className="flex items-center text-lg font-medium">
              <FiMail className="mr-2 text-[var(--primary-blue)]" /> Email & Web
            </span>
          }
          extra={
            <Tooltip title="Edit Contact Info">
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
            {(contactData?.emails || []).map((email, index) => (
              <p key={index} className="text-[var(--foreground)]">{email.email}</p>
            ))}
            <Divider className="my-3" />
            <div className="flex items-center gap-2">
              <FiGlobe className="text-[var(--primary-blue)]" />
              <a 
                href={contactData?.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--primary-blue)] hover:underline"
              >
                {contactData?.website?.replace('https://', '') || 'Not set'}
              </a>
            </div>
          </div>
        </Card>

        {/* Address Card */}
        <Card 
          loading={loading}
          title={
            <span className="flex items-center text-lg font-medium">
              <FiMapPin className="mr-2 text-[var(--primary-blue)]" /> Address
            </span>
          }
          extra={
            <Tooltip title="Edit Address">
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
          <p className="text-[var(--foreground)] whitespace-pre-line">
            {contactData?.address || 'No address set'}
          </p>
        </Card>

        {/* Social Links Card */}
        <Card 
          loading={loading}
          title={
            <span className="flex items-center text-lg font-medium">
              <FiGlobe className="mr-2 text-[var(--primary-blue)]" /> Social Media
            </span>
          }
          extra={
            <Tooltip title="Edit Social Links">
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
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(contactData?.socialLinks || {}).map(([platform, url]) => (
              url && (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[var(--foreground)] hover:text-[var(--primary-blue)]"
                >
                  {platform === 'facebook' && <FaFacebook />}
                  {platform === 'twitter' && <FaTwitter />}
                  {platform === 'instagram' && <FaInstagram />}
                  {platform === 'linkedin' && <FaLinkedin />}
                  {platform === 'youtube' && <FaYoutube />}
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </a>
              )
            ))}
          </div>
        </Card>
      </div>

      <Modal
        title={<h3 className="text-xl font-semibold text-[var(--foreground)]">Contact Details</h3>}
        open={isModalOpen}
        onCancel={handleCancel}
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
          {/* Phone Numbers Section */}
          <div className="border border-[var(--gray-200)] rounded-lg p-4 mb-6">
            <h4 className="text-lg font-medium mb-4 flex items-center">
              <FiPhone className="mr-2" /> Phone Numbers
            </h4>
            <Form.List name="phones">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name }) => (
                    <Space key={key} className="flex items-start mb-2 w-full" align="baseline">
                      <Form.Item
                        name={[name, 'personName']}
                        rules={[{ required: true, message: 'Name required' }]}
                      >
                        <Input placeholder="Contact Person Name" className="w-48" />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'phone']}
                        rules={[{ required: true, message: 'Phone number required' }]}
                      >
                        <Input placeholder="Enter phone number" className="w-48" />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'designation']}
                      >
                        <Input placeholder="Designation (optional)" className="w-48" />
                      </Form.Item>
                      <Button 
                        type="text" 
                        onClick={() => remove(name)}
                        icon={<FiTrash2 className="text-[var(--error)]" />} 
                      />
                    </Space>
                  ))}
                  <Button 
                    type="dashed" 
                    onClick={() => add()} 
                    className="w-full"
                    icon={<FiPlusCircle className="mr-2" />}
                  >
                    Add Contact Person
                  </Button>
                </>
              )}
            </Form.List>
          </div>

          {/* Email Addresses Section */}
          <div className="border border-[var(--gray-200)] rounded-lg p-4 mb-6">
            <h4 className="text-lg font-medium mb-4 flex items-center">
              <FiMail className="mr-2" /> Email Addresses
            </h4>
            <Form.List name="emails">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name }) => (
                    <Space key={key} className="flex items-start mb-2">
                      <Form.Item
                        name={[name, 'email']}
                        rules={[
                          { required: true, message: 'Email required' },
                          { type: 'email', message: 'Invalid email' }
                        ]}
                      >
                        <Input placeholder="Enter email address" className="w-64" />
                      </Form.Item>
                      <Button 
                        type="text" 
                        onClick={() => remove(name)}
                        icon={<FiTrash2 className="text-[var(--error)]" />} 
                      />
                    </Space>
                  ))}
                  <Button 
                    type="dashed" 
                    onClick={() => add()} 
                    className="w-full"
                    icon={<FiPlusCircle className="mr-2" />}
                  >
                    Add Email Address
                  </Button>
                </>
              )}
            </Form.List>
          </div>

          {/* Address Section */}
          <div className="border border-[var(--gray-200)] rounded-lg p-4 mb-6">
            <h4 className="text-lg font-medium mb-4 flex items-center">
              <FiMapPin className="mr-2" /> Address
            </h4>
            <Form.Item
              name="address"
              rules={[{ required: true, message: 'Address required' }]}
            >
              <Input.TextArea 
                rows={3} 
                placeholder="Enter complete address"
              />
            </Form.Item>
          </div>

          {/* Website & Social Links */}
          <div className="border border-[var(--gray-200)] rounded-lg p-4 mb-6">
            <h4 className="text-lg font-medium mb-4 flex items-center">
              <FiGlobe className="mr-2" /> Website & Social Media
            </h4>
            
            <Form.Item
              name="website"
              label="Website URL"
            >
              <Input placeholder="https://www.example.com" />
            </Form.Item>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="facebook" label={<span className="flex items-center"><FaFacebook className="mr-2" /> Facebook</span>}>
                <Input placeholder="Facebook profile URL" />
              </Form.Item>
              
              <Form.Item name="twitter" label={<span className="flex items-center"><FaTwitter className="mr-2" /> Twitter</span>}>
                <Input placeholder="Twitter profile URL" />
              </Form.Item>
              
              <Form.Item name="instagram" label={<span className="flex items-center"><FaInstagram className="mr-2" /> Instagram</span>}>
                <Input placeholder="Instagram profile URL" />
              </Form.Item>
              
              <Form.Item name="linkedin" label={<span className="flex items-center"><FaLinkedin className="mr-2" /> LinkedIn</span>}>
                <Input placeholder="LinkedIn profile URL" />
              </Form.Item>
              
              <Form.Item 
                name="youtube" 
                label={
                  <span className="flex items-center">
                    <FaYoutube className="mr-2 text-[var(--error)]" /> 
                    YouTube
                  </span>
                }
              >
                <Input placeholder="YouTube channel URL" />
              </Form.Item>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button 
              onClick={handleCancel}
              className="hover:bg-[var(--gray-100)]"
            >
              Cancel
            </Button>
            <Button 
              type="primary" 
              htmlType="submit"
              loading={loading}
              className="bg-[var(--primary-blue)] hover:bg-[var(--primary-dark)]"
            >
              Save Changes
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Contact;