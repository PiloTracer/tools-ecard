'use client';

import { useState, useEffect } from 'react';
import { useProjects } from '../contexts/ProjectsContext';

export function ProjectSettings() {
  const { selectedProject, selectedProjectId, updateProject, reloadProjects } = useProjects();

  const [workPhonePrefix, setWorkPhonePrefix] = useState('');
  const [defaultCountryCode, setDefaultCountryCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Log component mount/unmount
  useEffect(() => {
    console.log('[ProjectSettings] COMPONENT MOUNTED for project:', selectedProject?.id, selectedProject?.name);
    return () => {
      console.log('[ProjectSettings] COMPONENT UNMOUNTING');
    };
  }, []);

  // ULTIMATE FIX: Watch selectedProjectId which DOES change when user selects different project
  useEffect(() => {
    console.log('[ProjectSettings] useEffect triggered - selectedProjectId changed to:', selectedProjectId);

    if (!selectedProject) {
      console.log('[ProjectSettings] No project, clearing fields');
      setWorkPhonePrefix('');
      setDefaultCountryCode('');
      setSaveSuccess(false);
      setSaveError('');
      return;
    }

    // Read directly from selectedProject
    const newWorkPrefix = selectedProject.workPhonePrefix || '';
    const newCountryCode = selectedProject.defaultCountryCode || '';

    console.log('[ProjectSettings] Setting fields for project:', {
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      newWorkPrefix,
      newCountryCode
    });

    // Set state to match project
    setWorkPhonePrefix(newWorkPrefix);
    setDefaultCountryCode(newCountryCode);
    setSaveSuccess(false);
    setSaveError('');
  }, [selectedProjectId, selectedProject]); // Watch selectedProjectId which CHANGES when user switches projects

  const handleSave = async () => {
    if (!selectedProject) return;

    console.log('[ProjectSettings] Saving:', {
      projectId: selectedProject.id,
      workPhonePrefix: workPhonePrefix.trim() || null,
      defaultCountryCode: defaultCountryCode.trim() || null
    });

    setSaving(true);
    setSaveSuccess(false);
    setSaveError('');

    const result = await updateProject(selectedProject.id, {
      workPhonePrefix: workPhonePrefix.trim() || null,
      defaultCountryCode: defaultCountryCode.trim() || null,
    });

    if (result) {
      console.log('[ProjectSettings] Save successful, reloading');
      await reloadProjects();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      console.error('[ProjectSettings] Save failed');
      setSaveError('Failed to save settings');
    }

    setSaving(false);
  };

  if (!selectedProject) {
    return null;
  }

  return (
    <div className="mb-6 border-t pt-4">
      <div className="flex items-start space-x-6">
        {/* Work Phone Prefix */}
        <div className="flex-1">
          <label htmlFor="work-phone-prefix" className="block text-sm font-medium text-gray-700 mb-1">
            Work Phone Prefix
            <span className="text-gray-400 ml-1">(optional)</span>
          </label>
          <input
            key={`work-${selectedProject.id}`}
            id="work-phone-prefix"
            type="text"
            value={workPhonePrefix}
            onChange={(e) => setWorkPhonePrefix(e.target.value)}
            placeholder="e.g., 2222"
            maxLength={4}
            className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     transition-colors duration-150"
          />
          <p className="mt-1 text-xs text-gray-500">
            Prefix for 4-digit work phone numbers (e.g., "2222" for landlines)
          </p>
        </div>

        {/* Default Country Code */}
        <div className="flex-1">
          <label htmlFor="default-country-code" className="block text-sm font-medium text-gray-700 mb-1">
            Phone Country Prefix
            <span className="text-gray-400 ml-1">(optional)</span>
          </label>
          <input
            key={`country-${selectedProject.id}`}
            id="default-country-code"
            type="text"
            value={defaultCountryCode}
            onChange={(e) => setDefaultCountryCode(e.target.value)}
            placeholder="e.g., +(506)"
            maxLength={10}
            className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     transition-colors duration-150"
          />
          <p className="mt-1 text-xs text-gray-500">
            Country code for 8-digit phone numbers (e.g., "+(506)" for Costa Rica)
          </p>
        </div>

        {/* Save Button */}
        <div className="flex items-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg
                     hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors duration-150"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {saveSuccess && (
        <div className="mt-3 px-4 py-2 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
          Phone settings saved successfully!
        </div>
      )}
      {saveError && (
        <div className="mt-3 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {saveError}
        </div>
      )}
    </div>
  );
}
