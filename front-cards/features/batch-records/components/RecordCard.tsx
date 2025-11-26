/**
 * RecordCard Component
 * Individual record display with expand/collapse and actions
 */

'use client';

import React, { useState } from 'react';
import type { ContactRecord } from '../types';

interface RecordCardProps {
  record: ContactRecord;
  onEdit: (record: ContactRecord) => void;
  onDelete: (recordId: string) => void;
  isDeleting?: boolean;
}

export const RecordCard: React.FC<RecordCardProps> = ({
  record,
  onEdit,
  onDelete,
  isDeleting = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasField = (value: any) => value !== null && value !== undefined && value !== '';

  const renderField = (label: string, value: any) => {
    if (!hasField(value)) return null;
    return (
      <div>
        <span className="text-xs font-medium text-gray-500">{label}:</span>{' '}
        <span className="text-sm text-gray-900">{value}</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header - Always Visible */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">
            {record.fullName || `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'Unnamed Contact'}
          </h3>
          <div className="mt-1 space-y-0.5">
            {hasField(record.email) && (
              <p className="text-sm text-blue-600 truncate">{record.email}</p>
            )}
            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
              {hasField(record.workPhone) && (
                <span>Work: {record.workPhone}{record.workPhoneExt ? ` ext. ${record.workPhoneExt}` : ''}</span>
              )}
              {hasField(record.mobilePhone) && <span>Mobile: {record.mobilePhone}</span>}
            </div>
            {hasField(record.businessTitle) && hasField(record.businessName) && (
              <p className="text-sm text-gray-600">
                {record.businessTitle} at {record.businessName}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onEdit(record)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={() => onDelete(record.batchRecordId)}
            disabled={isDeleting}
            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-center py-2 text-sm text-gray-600 hover:text-gray-900 border-t border-gray-100"
      >
        {isExpanded ? (
          <>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            Hide details
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Show all fields
          </>
        )}
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
          {/* Personal Address */}
          {(hasField(record.addressStreet) || hasField(record.addressCity)) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Personal Address</h4>
              <div className="space-y-1">
                {renderField('Street', record.addressStreet)}
                {renderField('City', record.addressCity)}
                {renderField('State', record.addressState)}
                {renderField('Postal Code', record.addressPostal)}
                {renderField('Country', record.addressCountry)}
              </div>
            </div>
          )}

          {/* Business Info */}
          {(hasField(record.businessName) || hasField(record.businessTitle) || hasField(record.businessDepartment)) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Business Information</h4>
              <div className="space-y-1">
                {renderField('Company', record.businessName)}
                {renderField('Title', record.businessTitle)}
                {renderField('Department', record.businessDepartment)}
                {renderField('URL', record.businessUrl)}
                {renderField('Hours', record.businessHours)}
              </div>
            </div>
          )}

          {/* Business Address */}
          {(hasField(record.businessAddressStreet) || hasField(record.businessAddressCity)) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Business Address</h4>
              <div className="space-y-1">
                {renderField('Street', record.businessAddressStreet)}
                {renderField('City', record.businessAddressCity)}
                {renderField('State', record.businessAddressState)}
                {renderField('Postal Code', record.businessAddressPostal)}
                {renderField('Country', record.businessAddressCountry)}
              </div>
            </div>
          )}

          {/* Social Profiles */}
          {(hasField(record.socialInstagram) || hasField(record.socialTwitter) || hasField(record.socialFacebook)) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Social Profiles</h4>
              <div className="space-y-1">
                {renderField('Instagram', record.socialInstagram)}
                {renderField('Twitter', record.socialTwitter)}
                {renderField('Facebook', record.socialFacebook)}
              </div>
            </div>
          )}

          {/* Professional Profiles */}
          {(hasField(record.businessLinkedin) || hasField(record.businessTwitter)) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Professional Profiles</h4>
              <div className="space-y-1">
                {renderField('LinkedIn', record.businessLinkedin)}
                {renderField('Twitter', record.businessTwitter)}
              </div>
            </div>
          )}

          {/* Personal Info */}
          {(hasField(record.personalUrl) || hasField(record.personalBio) || hasField(record.personalBirthday)) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Personal Information</h4>
              <div className="space-y-1">
                {renderField('Website', record.personalUrl)}
                {renderField('Bio', record.personalBio)}
                {renderField('Birthday', record.personalBirthday)}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Metadata</h4>
            <div className="space-y-1 text-xs text-gray-500">
              <div>Created: {new Date(record.createdAt).toLocaleString()}</div>
              <div>Updated: {new Date(record.updatedAt).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
