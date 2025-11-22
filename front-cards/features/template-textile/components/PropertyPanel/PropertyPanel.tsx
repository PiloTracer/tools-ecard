'use client';

import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import { TextProperties } from './TextProperties';
import { ImageProperties } from './ImageProperties';
import { QRProperties } from './QRProperties';
import { ShapeProperties } from './ShapeProperties';
import { isTextElement, isImageElement, isQRElement, isShapeElement } from '../../types';

export function PropertyPanel() {
  const { selectedElementId, fabricCanvas } = useCanvasStore();
  const { elements, removeElement, updateElement, duplicateElement, bringToFront, sendToBack, bringForward, sendBackward, canvasWidth, canvasHeight } = useTemplateStore();

  const selectedElement = elements.find(el => el.id === selectedElementId);

  const handleDelete = () => {
    if (selectedElementId) {
      removeElement(selectedElementId);
    }
  };

  const handleDuplicate = () => {
    if (selectedElementId) {
      duplicateElement(selectedElementId);
    }
  };

  const handleGenerateQRs = () => {
    // Collect all text elements that have a fieldId (vCard fields)
    const fieldElements = elements.filter(el =>
      el.type === 'text' && (el as any).fieldId
    );

    if (fieldElements.length === 0) {
      alert('No vCard fields found. Please add some fields to the canvas first.');
      return;
    }

    // Build a map of field values
    const fieldValues: Record<string, string> = {};
    fieldElements.forEach(el => {
      const textEl = el as any;
      fieldValues[textEl.fieldId] = textEl.text || '';
    });

    // Build vCard data with proper structure (vCard 3.0)
    const vCardLines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

    // FN (Full Name) - required field
    if (fieldValues.full_name) {
      vCardLines.push(`FN:${fieldValues.full_name}`);
    }

    // N (Structured Name) - family;given;additional;prefix;suffix
    if (fieldValues.first_name || fieldValues.last_name) {
      const lastName = fieldValues.last_name || '';
      const firstName = fieldValues.first_name || '';
      vCardLines.push(`N:${lastName};${firstName};;;`);
    }

    // ORG (Organization) - using business_name or business_department
    if (fieldValues.business_name) {
      // If department exists, format as "Company;Department"
      if (fieldValues.business_department) {
        vCardLines.push(`ORG:${fieldValues.business_name};${fieldValues.business_department}`);
      } else {
        vCardLines.push(`ORG:${fieldValues.business_name}`);
      }
    }

    // TITLE (Job Title)
    if (fieldValues.business_title) {
      vCardLines.push(`TITLE:${fieldValues.business_title}`);
    }

    // TEL (Phone numbers) - All specific fields from vcardFields.ts
    if (fieldValues.work_phone) {
      // Add extension if present
      if (fieldValues.work_phone_ext) {
        vCardLines.push(`TEL;TYPE=WORK,VOICE:${fieldValues.work_phone} ext ${fieldValues.work_phone_ext}`);
      } else {
        vCardLines.push(`TEL;TYPE=WORK,VOICE:${fieldValues.work_phone}`);
      }
    }
    if (fieldValues.mobile_phone) {
      vCardLines.push(`TEL;TYPE=CELL:${fieldValues.mobile_phone}`);
    }

    // EMAIL
    if (fieldValues.email) {
      vCardLines.push(`EMAIL;TYPE=INTERNET,WORK:${fieldValues.email}`);
    }

    // ADR (Work Address) - Using specific address_* fields
    if (fieldValues.address_street || fieldValues.address_city || fieldValues.address_state ||
        fieldValues.address_postal || fieldValues.address_country) {
      const street = fieldValues.address_street || '';
      const city = fieldValues.address_city || '';
      const state = fieldValues.address_state || '';
      const postal = fieldValues.address_postal || '';
      const country = fieldValues.address_country || '';
      vCardLines.push(`ADR;TYPE=WORK:;;${street};${city};${state};${postal};${country}`);
    }

    // Business Address (if different from main address)
    if (fieldValues.business_address_street || fieldValues.business_address_city ||
        fieldValues.business_address_state || fieldValues.business_address_postal ||
        fieldValues.business_address_country) {
      const street = fieldValues.business_address_street || '';
      const city = fieldValues.business_address_city || '';
      const state = fieldValues.business_address_state || '';
      const postal = fieldValues.business_address_postal || '';
      const country = fieldValues.business_address_country || '';
      vCardLines.push(`ADR;TYPE=WORK:;;${street};${city};${state};${postal};${country}`);
    }

    // URL (Business website)
    if (fieldValues.business_url) {
      vCardLines.push(`URL;TYPE=WORK:${fieldValues.business_url}`);
    }

    // Personal URL
    if (fieldValues.personal_url) {
      vCardLines.push(`URL;TYPE=HOME:${fieldValues.personal_url}`);
    }

    // Social media profiles - LinkedIn
    if (fieldValues.business_linkedin) {
      // Normalize LinkedIn URL
      let linkedinUrl = fieldValues.business_linkedin;
      if (!linkedinUrl.startsWith('http')) {
        linkedinUrl = linkedinUrl.startsWith('linkedin.com')
          ? `https://${linkedinUrl}`
          : `https://linkedin.com/in/${linkedinUrl}`;
      }
      vCardLines.push(`URL;TYPE=LinkedIn:${linkedinUrl}`);
    }

    // Social media - Instagram
    if (fieldValues.social_instagram) {
      const username = fieldValues.social_instagram.replace('@', '');
      vCardLines.push(`URL;TYPE=Instagram:https://instagram.com/${username}`);
    }

    // Social media - Twitter (business and personal)
    if (fieldValues.business_twitter) {
      const username = fieldValues.business_twitter.replace('@', '');
      vCardLines.push(`URL;TYPE=Twitter:https://twitter.com/${username}`);
    } else if (fieldValues.social_twitter) {
      const username = fieldValues.social_twitter.replace('@', '');
      vCardLines.push(`URL;TYPE=Twitter:https://twitter.com/${username}`);
    }

    // Social media - Facebook
    if (fieldValues.social_facebook) {
      vCardLines.push(`URL;TYPE=Facebook:https://facebook.com/${fieldValues.social_facebook}`);
    }

    // BDAY (Birthday) - ISO 8601 format
    if (fieldValues.personal_birthday) {
      vCardLines.push(`BDAY:${fieldValues.personal_birthday}`);
    }

    // NOTE (Additional information)
    const noteItems: string[] = [];

    if (fieldValues.business_hours) {
      noteItems.push(`Business Hours: ${fieldValues.business_hours}`);
    }

    if (fieldValues.personal_bio) {
      noteItems.push(fieldValues.personal_bio);
    }

    if (noteItems.length > 0) {
      vCardLines.push(`NOTE:${noteItems.join(' | ')}`);
    }

    vCardLines.push('END:VCARD');
    const vCardData = vCardLines.join('\r\n'); // Use \r\n for proper vCard format

    console.log('[QR Generation] Generated vCard:', vCardData);

    // Update all QR elements with the vCard data
    const qrElements = elements.filter(el => el.type === 'qr');

    if (qrElements.length === 0) {
      alert('No QR code elements found on the canvas.');
      return;
    }

    qrElements.forEach(qrEl => {
      updateElement(qrEl.id, {
        data: vCardData,
        qrType: 'vcard'
      });
    });

    console.log(`[QR Generation] Updated ${qrElements.length} QR code(s) with vCard data`);
  };

  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'cover' | 'contain') => {
    if (!selectedElementId || !fabricCanvas || !selectedElement) return;

    const fabricObj = fabricCanvas.getObjects().find((obj: any) => obj.elementId === selectedElementId);
    if (!fabricObj) return;

    const objWidth = (fabricObj.width || 0) * (fabricObj.scaleX || 1);
    const objHeight = (fabricObj.height || 0) * (fabricObj.scaleY || 1);

    let newX = selectedElement.x;
    let newY = selectedElement.y;
    let newWidth = selectedElement.width;
    let newHeight = selectedElement.height;

    switch (type) {
      case 'left':
        newX = 0;
        break;
      case 'center':
        newX = (canvasWidth - objWidth) / 2;
        break;
      case 'right':
        newX = canvasWidth - objWidth;
        break;
      case 'top':
        newY = 0;
        break;
      case 'middle':
        newY = (canvasHeight - objHeight) / 2;
        break;
      case 'bottom':
        newY = canvasHeight - objHeight;
        break;
      case 'cover':
        // Stretch to fill entire canvas
        newX = 0;
        newY = 0;
        newWidth = canvasWidth;
        newHeight = canvasHeight;
        break;
      case 'contain':
        // Fit within canvas maintaining aspect ratio
        const aspectRatio = objWidth / objHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        if (aspectRatio > canvasAspectRatio) {
          // Fit to width
          newWidth = canvasWidth;
          newHeight = canvasWidth / aspectRatio;
        } else {
          // Fit to height
          newHeight = canvasHeight;
          newWidth = canvasHeight * aspectRatio;
        }
        newX = (canvasWidth - newWidth) / 2;
        newY = (canvasHeight - newHeight) / 2;
        break;
    }

    const updates: any = { x: newX, y: newY };
    if (newWidth !== selectedElement.width) updates.width = newWidth;
    if (newHeight !== selectedElement.height) updates.height = newHeight;

    console.log(`Align ${type}:`, {
      oldX: selectedElement.x,
      oldY: selectedElement.y,
      newX,
      newY,
      objWidth,
      objHeight,
      canvasWidth,
      canvasHeight,
      updates
    });

    updateElement(selectedElementId, updates);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-gray-200 bg-gradient-to-r from-white to-slate-50 p-4">
        <h2 className="text-lg font-bold text-slate-800">Properties</h2>
        <p className="text-xs text-slate-500 mt-0.5">Element settings</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!selectedElement ? (
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-500 mt-8">
              Select an element to view its properties
            </div>

            {/* Show Generate QRs button if there are QR elements */}
            {elements.some(el => el.type === 'qr') && (
              <div className="mt-8">
                <button
                  onClick={handleGenerateQRs}
                  className="w-full rounded-lg border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100 px-4 py-3 text-sm font-semibold text-amber-800 hover:from-amber-100 hover:to-amber-200 hover:border-amber-400 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Generate QRs
                  </div>
                  <div className="text-xs text-amber-700 mt-1 opacity-75">
                    Create vCard from field elements
                  </div>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Element Type Badge */}
            <div className="flex items-center justify-between">
              <div className="rounded bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 capitalize">
                {selectedElement.type}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDuplicate}
                  className="rounded bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-100"
                >
                  Duplicate
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded bg-red-50 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Lock Toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-semibold text-gray-700">Lock</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={selectedElement.locked || false}
                    onChange={(e) => updateElement(selectedElementId!, { locked: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition ${selectedElement.locked ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${selectedElement.locked ? 'translate-x-5' : ''}`}></div>
                  </div>
                </div>
              </label>
              <p className="text-xs text-gray-500 mt-1">Prevent moving and resizing</p>
            </div>

            {/* Position */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Position</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">X</label>
                  <div className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium">
                    {Math.round(selectedElement.x)}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Y</label>
                  <div className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium">
                    {Math.round(selectedElement.y)}
                  </div>
                </div>
              </div>
            </div>

            {/* Rotation */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Rotation</h3>
              <div className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium">
                {Math.round(selectedElement.rotation || 0)}°
              </div>
            </div>

            {/* Layering */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Layering</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => bringToFront(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  To Front
                </button>
                <button
                  onClick={() => sendToBack(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  To Back
                </button>
                <button
                  onClick={() => bringForward(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  Forward
                </button>
                <button
                  onClick={() => sendBackward(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  Backward
                </button>
              </div>
            </div>

            {/* Alignment */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Align</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleAlign('left')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Left
                  </button>
                  <button
                    onClick={() => handleAlign('center')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Center
                  </button>
                  <button
                    onClick={() => handleAlign('right')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Right
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleAlign('top')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Top
                  </button>
                  <button
                    onClick={() => handleAlign('middle')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Middle
                  </button>
                  <button
                    onClick={() => handleAlign('bottom')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Bottom
                  </button>
                </div>
              </div>

              {/* Coverage */}
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-semibold text-gray-600 uppercase">Coverage</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAlign('cover')}
                    className="rounded border border-purple-300 bg-purple-50 px-2 py-1.5 text-xs text-purple-800 hover:bg-purple-100 font-medium"
                  >
                    Cover
                  </button>
                  <button
                    onClick={() => handleAlign('contain')}
                    className="rounded border border-purple-300 bg-purple-50 px-2 py-1.5 text-xs text-purple-800 hover:bg-purple-100 font-medium"
                  >
                    Contain
                  </button>
                </div>
              </div>
            </div>

            {/* Element-specific properties */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Properties</h3>
              {isTextElement(selectedElement) && <TextProperties element={selectedElement} />}
              {isImageElement(selectedElement) && <ImageProperties element={selectedElement} />}
              {isQRElement(selectedElement) && <QRProperties element={selectedElement} />}
              {isShapeElement(selectedElement) && <ShapeProperties element={selectedElement} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
