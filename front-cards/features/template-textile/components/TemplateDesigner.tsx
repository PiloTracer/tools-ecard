'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/features/simple-projects';
import { useTranslation } from '@/features/i18n';
import { DesignCanvas } from './Canvas/DesignCanvas';
import { CanvasControls } from './Canvas/CanvasControls';
import { CanvasSettings } from './CanvasSettings';
import { ElementToolbox } from './Toolbox/ElementToolbox';
import { PropertyPanel } from './PropertyPanel/PropertyPanel';
import { useTemplateStore } from '../stores/templateStore';
import { useCanvasStore } from '../stores/canvasStore';
import { Modal, Button, IconButton } from '@/components/ui';
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
} from '../constants/canvasDefaults';

export function TemplateDesigner() {
  const router = useRouter();
  const { t } = useTranslation();
  const { selectedProject } = useProjects();
  const { currentTemplate, createTemplate, hasUnsavedChanges } = useTemplateStore();
  const setSaveMetadata = useTemplateStore((s) => s.setSaveMetadata);
  const { setDimensions } = useCanvasStore();

  const [toolboxOpen, setToolboxOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // S4 decision 2: warn before leaving the tab with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Keep toolbar project in sync with the project selected on the dashboard (localStorage + API)
  useEffect(() => {
    if (!selectedProject?.name) {
      return;
    }
    const s = useTemplateStore.getState();
    const templateLabel =
      (s.currentTemplateName && s.currentTemplateName.length > 0
        ? s.currentTemplateName
        : s.currentTemplate?.name) ?? '';
    setSaveMetadata(selectedProject.name, templateLabel);
  }, [selectedProject?.id, selectedProject?.name, setSaveMetadata]);

  // S4 decision 3: Back with unsaved changes → Modal confirm (no window.confirm)
  const goToDashboard = () => {
    if (hasUnsavedChanges) {
      setShowLeaveConfirm(true);
      return;
    }
    router.push('/dashboard');
  };

  // Initialize with a default template if none exists
  useEffect(() => {
    if (!currentTemplate) {
      createTemplate(t('designer.untitledTemplate'), DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT);
      setDimensions(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT);
    }
  }, [currentTemplate, createTemplate, setDimensions, t]);

  const dashboardButton = (
    <button
      type="button"
      onClick={goToDashboard}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-slate-600/80 bg-slate-700/80 px-2 py-1 text-left text-slate-200 transition hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent sm:px-2.5 sm:py-1.5"
      aria-label={t('common.back')}
    >
      <svg className="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span className="whitespace-nowrap text-xs font-medium sm:text-sm">{t('designer.backToDashboard')}</span>
    </button>
  );

  const appTitle = (
    <p className="min-w-0 select-none truncate text-xs text-slate-400 sm:text-sm">
      <span className="text-slate-200">{t('designer.appTitle')}</span>
      <span className="text-slate-500"> | {t('designer.appSubtitle')}</span>
    </p>
  );

  const drawerBackdrop = (open: boolean, onClose: () => void) =>
    open ? (
      <div
        className="fixed inset-0 z-30 lg:hidden"
        style={{ backgroundColor: 'var(--scrim)' }}
        onClick={onClose}
        aria-hidden="true"
      />
    ) : null;

  return (
    <div className="flex h-screen w-full flex-col bg-slate-600">
      <div className="flex min-h-0 flex-1 w-full">
        {drawerBackdrop(toolboxOpen, () => setToolboxOpen(false))}
        {drawerBackdrop(panelOpen, () => setPanelOpen(false))}

        {/* Left Toolbox — slide-in drawer on mobile, static on lg+ (S4 decision 1) */}
        <div
          className={`fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 border-r border-slate-700 bg-surface-base shadow-lg transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
            toolboxOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <ElementToolbox onCloseDrawer={() => setToolboxOpen(false)} />
        </div>

        {/* Center Canvas Area */}
        <div className="flex min-w-0 flex-1 flex-col bg-slate-700">
          {/* Mobile-only drawer toggles */}
          <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800 px-2 py-1 lg:hidden">
            <IconButton
              aria-label={t('designer.elements')}
              size="sm"
              onClick={() => setToolboxOpen(true)}
              className="text-slate-200 hover:bg-slate-700 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </IconButton>
            <IconButton
              aria-label={t('designer.properties')}
              size="sm"
              onClick={() => setPanelOpen(true)}
              className="text-slate-200 hover:bg-slate-700 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </IconButton>
            <span className="ml-auto min-w-0 flex-1 truncate text-xs text-slate-400">
              {currentTemplate?.name ?? t('designer.untitledTemplate')}
            </span>
          </div>

          <CanvasSettings leadingContent={dashboardButton} titleContent={appTitle} />
          <CanvasControls />
          <DesignCanvas />
        </div>

        {/* Right Property Panel — slide-in drawer on mobile, static on lg+ */}
        <div
          className={`fixed inset-y-0 right-0 z-40 w-80 flex-shrink-0 border-l border-slate-700 bg-surface-base shadow-lg transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
            panelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <PropertyPanel onCloseDrawer={() => setPanelOpen(false)} />
        </div>
      </div>

      {/* Back-with-unsaved-changes confirm (S4 decision 3 — no window.confirm) */}
      <Modal
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title={t('designer.unsavedChangesTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLeaveConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => router.push('/dashboard')}>
              {t('designer.leaveAnyway')}
            </Button>
          </>
        }
      >
        <p>{t('designer.unsavedChanges')}</p>
      </Modal>
    </div>
  );
}
