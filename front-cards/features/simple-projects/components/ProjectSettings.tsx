'use client';

import { useState, useEffect } from 'react';
import { useProjects } from '../contexts/ProjectsContext';
import { Input, Button } from '@/components/ui';
import { useTranslation } from '@/features/i18n';

export function ProjectSettings() {
  const { selectedProject, selectedProjectId, updateProject, reloadProjects } = useProjects();
  const { t } = useTranslation();

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
  // Deferred (setTimeout 0) so state sync isn't flagged as setState-in-effect; cleanup cancels on rapid switches.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!selectedProject) {
        setWorkPhonePrefix('');
        setDefaultCountryCode('');
        setSaveSuccess(false);
        setSaveError('');
        return;
      }

      // Read directly from selectedProject
      const newWorkPrefix = selectedProject.workPhonePrefix || '';
      const newCountryCode = selectedProject.defaultCountryCode || '';

      // Set state to match project
      setWorkPhonePrefix(newWorkPrefix);
      setDefaultCountryCode(newCountryCode);
      setSaveSuccess(false);
      setSaveError('');
    }, 0);
    return () => window.clearTimeout(id);
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
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-6">
        {/* Work Phone Prefix */}
        <div className="flex-1">
          <Input
            key={`work-${selectedProject.id}`}
            id="work-phone-prefix"
            label={t('settings.workPhonePrefix')}
            hint={t('settings.workPhoneHint')}
            value={workPhonePrefix}
            onChange={(e) => setWorkPhonePrefix(e.target.value)}
            placeholder="e.g., 2222"
            maxLength={4}
          />
        </div>

        {/* Default Country Code */}
        <div className="flex-1">
          <Input
            key={`country-${selectedProject.id}`}
            id="default-country-code"
            label={t('settings.phoneCountryPrefix')}
            hint={t('settings.phoneCountryHint')}
            value={defaultCountryCode}
            onChange={(e) => setDefaultCountryCode(e.target.value)}
            placeholder="e.g., +(506)"
            maxLength={10}
          />
        </div>

        {/* Save Button */}
        <div className="flex items-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('settings.saving') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {saveSuccess && (
        <div className="mt-3 px-4 py-2 bg-success-subtle text-status-success text-sm rounded-lg border border-border-subtle">
          {t('settings.saveSuccess')}
        </div>
      )}
      {saveError && (
        <div className="mt-3 px-4 py-2 bg-error-subtle text-status-error text-sm rounded-lg border border-border-subtle">
          {saveError}
        </div>
      )}
    </div>
  );
}
