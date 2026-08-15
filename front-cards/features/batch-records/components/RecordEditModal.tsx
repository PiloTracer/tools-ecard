/**
 * RecordEditModal Component
 * Modal for editing record with all vCard fields grouped
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRecordEdit } from '../hooks/useRecordEdit';
import type { ContactRecord, RecordUpdateInput } from '../types';
import { Modal, Button } from '@/components/ui';
import { useTranslation } from '@/features/i18n';

interface RecordEditModalProps {
  record: ContactRecord;
  batchId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// InputField component defined outside to prevent re-creation on each render
const InputField: React.FC<{
  label: string;
  field: string;
  value: string;
  onChange: (field: string, value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}> = ({ label, field, value, onChange, error, type = 'text', placeholder = '' }) => (
  <div>
    <label htmlFor={field} className="block text-sm font-medium text-text-primary mb-1">
      {label}
    </label>
    <input
      type={type}
      id={field}
      value={value}
      onChange={(e) => onChange(field, e.target.value)}
      placeholder={placeholder}
      className={`block w-full px-3 py-2 border ${
        error ? 'border-status-error' : 'border-border-default'
      } rounded-md shadow-sm text-text-primary placeholder:text-text-muted bg-surface-inset focus:outline-none focus:ring-accent focus:border-accent sm:text-sm`}
    />
    {error && <p className="mt-1 text-xs text-status-error">{error}</p>}
  </div>
);

/**
 * Module-level form row — do NOT inline an equivalent inside RecordEditModal: a new
 * function component on each parent render changes React’s component type, unmounting
 * inputs and stealing focus after the first keystroke.
 */
const VCardField: React.FC<{
  label: string;
  field: string;
  type?: string;
  placeholder?: string;
  formData: RecordUpdateInput;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
}> = ({ label, field, type = 'text', placeholder = '', formData, errors, onChange }) => (
  <InputField
    label={label}
    field={field}
    value={formData[field] || ''}
    onChange={onChange}
    error={errors[field]}
    type={type}
    placeholder={placeholder}
  />
);

export const RecordEditModal: React.FC<RecordEditModalProps> = ({
  record,
  batchId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { updateRecordAsync, isUpdating, isSuccess, reset } = useRecordEdit({ batchId });

  const [formData, setFormData] = useState<RecordUpdateInput>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Avoid re-initializing (and unmounting inputs) when parent re-renders the same record. */
  const initializedRecordIdRef = useRef<string | null>(null);

  // Initialize form data when the modal opens for a record (not on every parent render)
  useEffect(() => {
    if (!isOpen) {
      initializedRecordIdRef.current = null;
      return;
    }
    if (!record) return;
    if (initializedRecordIdRef.current === record.batchRecordId) return;
    initializedRecordIdRef.current = record.batchRecordId;
    setFormData({
        fullName: record.fullName ?? '',
        firstName: record.firstName ?? '',
        lastName: record.lastName ?? '',
        workPhone: record.workPhone ?? '',
        workPhoneExt: record.workPhoneExt ?? '',
        mobilePhone: record.mobilePhone ?? '',
        email: record.email ?? '',
        addressStreet: record.addressStreet ?? '',
        addressCity: record.addressCity ?? '',
        addressState: record.addressState ?? '',
        addressPostal: record.addressPostal ?? '',
        addressCountry: record.addressCountry ?? '',
        socialInstagram: record.socialInstagram ?? '',
        socialTwitter: record.socialTwitter ?? '',
        socialFacebook: record.socialFacebook ?? '',
        businessName: record.businessName ?? '',
        businessTitle: record.businessTitle ?? '',
        businessDepartment: record.businessDepartment ?? '',
        businessUrl: record.businessUrl ?? '',
        businessHours: record.businessHours ?? '',
        businessAddressStreet: record.businessAddressStreet ?? '',
        businessAddressCity: record.businessAddressCity ?? '',
        businessAddressState: record.businessAddressState ?? '',
        businessAddressPostal: record.businessAddressPostal ?? '',
        businessAddressCountry: record.businessAddressCountry ?? '',
        businessLinkedin: record.businessLinkedin ?? '',
        businessTwitter: record.businessTwitter ?? '',
        personalUrl: record.personalUrl ?? '',
        personalBio: record.personalBio ?? '',
        personalBirthday: record.personalBirthday ?? '',
      });
    setErrors({});
  }, [isOpen, record]);

  // Reset on success
  useEffect(() => {
    if (isSuccess) {
      if (onSuccess) onSuccess();
      onClose();
      reset();
    }
  }, [isSuccess, onSuccess, onClose, reset]);

  const handleChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t('records.editTitle', { name: record.fullName || 'Unnamed' })}
      size="wide"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isUpdating}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isUpdating}>
            {isUpdating ? t('settings.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Full Name" field="fullName" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="First Name" field="firstName" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Last Name" field="lastName" />
            </div>
          </div>

          {/* Contact Methods */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Contact Methods</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Email" field="email" type="email" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Work Phone" field="workPhone" type="tel" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Work Phone Extension" field="workPhoneExt" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Mobile Phone" field="mobilePhone" type="tel" />
            </div>
          </div>

          {/* Personal Address */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Personal Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Street" field="addressStreet" />
              </div>
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="City" field="addressCity" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="State/Province" field="addressState" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Postal Code" field="addressPostal" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Country" field="addressCountry" />
            </div>
          </div>

          {/* Business Information */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Business Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Company" field="businessName" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Title" field="businessTitle" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Department" field="businessDepartment" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Business URL" field="businessUrl" type="url" />
              <div className="md:col-span-2">
                <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Business Hours" field="businessHours" />
              </div>
            </div>
          </div>

          {/* Business Address */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Business Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Street" field="businessAddressStreet" />
              </div>
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="City" field="businessAddressCity" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="State/Province" field="businessAddressState" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Postal Code" field="businessAddressPostal" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Country" field="businessAddressCountry" />
            </div>
          </div>

          {/* Social Profiles */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Social Profiles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Instagram" field="socialInstagram" placeholder="@username" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Twitter" field="socialTwitter" placeholder="@username" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Facebook" field="socialFacebook" />
            </div>
          </div>

          {/* Professional Profiles */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Professional Profiles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="LinkedIn" field="businessLinkedin" placeholder="linkedin.com/in/username" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Business Twitter" field="businessTwitter" placeholder="@company" />
            </div>
          </div>

          {/* Personal Details */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Personal Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Personal Website" field="personalUrl" type="url" />
              <VCardField
        formData={formData}
        errors={errors}
        onChange={handleChange} label="Birthday" field="personalBirthday" type="date" />
              <div className="md:col-span-2">
                <label htmlFor="personalBio" className="block text-sm font-medium text-text-primary mb-1">
                  Bio
                </label>
                <textarea
                  id="personalBio"
                  value={formData.personalBio || ''}
                  onChange={(e) => handleChange('personalBio', e.target.value)}
                  rows={3}
                  className="block w-full px-3 py-2 border border-border-default rounded-md shadow-sm text-text-primary placeholder:text-text-muted bg-surface-inset focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                />
              </div>
            </div>
          </div>
      </form>
    </Modal>
  );
};
