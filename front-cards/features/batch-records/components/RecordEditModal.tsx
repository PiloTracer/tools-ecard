/**
 * RecordEditModal Component
 * Modal for editing record with all vCard fields grouped
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRecordEdit } from '../hooks/useRecordEdit';
import type { ContactRecord, RecordUpdateInput } from '../types';

interface RecordEditModalProps {
  record: ContactRecord;
  batchId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RecordEditModal: React.FC<RecordEditModalProps> = ({
  record,
  batchId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { updateRecordAsync, isUpdating, isSuccess, reset } = useRecordEdit({ batchId });

  const [formData, setFormData] = useState<RecordUpdateInput>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when record changes
  useEffect(() => {
    if (record) {
      setFormData({
        fullName: record.fullName || '',
        firstName: record.firstName || '',
        lastName: record.lastName || '',
        workPhone: record.workPhone || '',
        workPhoneExt: record.workPhoneExt || '',
        mobilePhone: record.mobilePhone || '',
        email: record.email || '',
        addressStreet: record.addressStreet || '',
        addressCity: record.addressCity || '',
        addressState: record.addressState || '',
        addressPostal: record.addressPostal || '',
        addressCountry: record.addressCountry || '',
        socialInstagram: record.socialInstagram || '',
        socialTwitter: record.socialTwitter || '',
        socialFacebook: record.socialFacebook || '',
        businessName: record.businessName || '',
        businessTitle: record.businessTitle || '',
        businessDepartment: record.businessDepartment || '',
        businessUrl: record.businessUrl || '',
        businessHours: record.businessHours || '',
        businessAddressStreet: record.businessAddressStreet || '',
        businessAddressCity: record.businessAddressCity || '',
        businessAddressState: record.businessAddressState || '',
        businessAddressPostal: record.businessAddressPostal || '',
        businessAddressCountry: record.businessAddressCountry || '',
        businessLinkedin: record.businessLinkedin || '',
        businessTwitter: record.businessTwitter || '',
        personalUrl: record.personalUrl || '',
        personalBio: record.personalBio || '',
        personalBirthday: record.personalBirthday || '',
      });
    }
  }, [record]);

  // Reset on success
  useEffect(() => {
    if (isSuccess) {
      if (onSuccess) onSuccess();
      onClose();
      reset();
    }
  }, [isSuccess, onSuccess, onClose, reset]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // URL validation
    const validateUrl = (url: string) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    if (formData.businessUrl && !validateUrl(formData.businessUrl)) {
      newErrors.businessUrl = 'Invalid URL format';
    }

    if (formData.personalUrl && !validateUrl(formData.personalUrl)) {
      newErrors.personalUrl = 'Invalid URL format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Convert empty strings to null
    const updates: RecordUpdateInput = {};
    for (const [key, value] of Object.entries(formData)) {
      updates[key] = value === '' ? null : value;
    }

    try {
      await updateRecordAsync({ recordId: record.batchRecordId, updates });
    } catch (error) {
      console.error('Failed to update record:', error);
    }
  };

  if (!isOpen) return null;

  const InputField = ({
    label,
    field,
    type = 'text',
    placeholder = '',
  }: {
    label: string;
    field: string;
    type?: string;
    placeholder?: string;
  }) => (
    <div>
      <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        id={field}
        value={formData[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
        className={`block w-full px-3 py-2 border ${
          errors[field] ? 'border-red-300' : 'border-gray-300'
        } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
      />
      {errors[field] && <p className="mt-1 text-xs text-red-600">{errors[field]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit Contact - {record.fullName || 'Unnamed'}
          </h2>
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Full Name" field="fullName" />
              <InputField label="First Name" field="firstName" />
              <InputField label="Last Name" field="lastName" />
            </div>
          </div>

          {/* Contact Methods */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Methods</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Email" field="email" type="email" />
              <InputField label="Work Phone" field="workPhone" type="tel" />
              <InputField label="Work Phone Extension" field="workPhoneExt" />
              <InputField label="Mobile Phone" field="mobilePhone" type="tel" />
            </div>
          </div>

          {/* Personal Address */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <InputField label="Street" field="addressStreet" />
              </div>
              <InputField label="City" field="addressCity" />
              <InputField label="State/Province" field="addressState" />
              <InputField label="Postal Code" field="addressPostal" />
              <InputField label="Country" field="addressCountry" />
            </div>
          </div>

          {/* Business Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Business Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Company" field="businessName" />
              <InputField label="Title" field="businessTitle" />
              <InputField label="Department" field="businessDepartment" />
              <InputField label="Business URL" field="businessUrl" type="url" />
              <div className="md:col-span-2">
                <InputField label="Business Hours" field="businessHours" />
              </div>
            </div>
          </div>

          {/* Business Address */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Business Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <InputField label="Street" field="businessAddressStreet" />
              </div>
              <InputField label="City" field="businessAddressCity" />
              <InputField label="State/Province" field="businessAddressState" />
              <InputField label="Postal Code" field="businessAddressPostal" />
              <InputField label="Country" field="businessAddressCountry" />
            </div>
          </div>

          {/* Social Profiles */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Social Profiles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Instagram" field="socialInstagram" placeholder="@username" />
              <InputField label="Twitter" field="socialTwitter" placeholder="@username" />
              <InputField label="Facebook" field="socialFacebook" />
            </div>
          </div>

          {/* Professional Profiles */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Professional Profiles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="LinkedIn" field="businessLinkedin" placeholder="linkedin.com/in/username" />
              <InputField label="Business Twitter" field="businessTwitter" placeholder="@company" />
            </div>
          </div>

          {/* Personal Details */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Personal Website" field="personalUrl" type="url" />
              <InputField label="Birthday" field="personalBirthday" type="date" />
              <div className="md:col-span-2">
                <label htmlFor="personalBio" className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  id="personalBio"
                  value={formData.personalBio || ''}
                  onChange={(e) => handleChange('personalBio', e.target.value)}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isUpdating}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
