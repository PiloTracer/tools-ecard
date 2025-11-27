'use client';

import { useState, useEffect } from 'react';
import { fontService, type Font, type FontFamily } from '../../services/fontService';

interface FontSelectorProps {
  value: string; // current font family
  onChange: (fontFamily: string) => void;
  onFontLoad?: (font: Font) => void;
}

export function FontSelector({ value, onChange, onFontLoad }: FontSelectorProps) {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [fontFamilies, setFontFamilies] = useState<FontFamily[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [scope, setScope] = useState<'all' | 'global' | 'user'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredFont, setHoveredFont] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Load fonts on mount
  useEffect(() => {
    loadFonts();
  }, [scope]);

  const loadFonts = async () => {
    setIsLoading(true);
    try {
      const loadedFonts = await fontService.listFonts(scope);
      setFonts(loadedFonts);
      setFontFamilies(fontService.getFontFamilies(loadedFonts));
    } catch (error) {
      console.error('Failed to load fonts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Lazy load font on hover
  const handleFontHover = async (family: string) => {
    setHoveredFont(family);

    const familyFonts = fontFamilies.find(f => f.family === family);
    if (!familyFonts) return;

    // Load regular variant for preview
    const regularFont = familyFonts.variants.find(v => v.fontVariant === 'regular') || familyFonts.variants[0];

    try {
      await fontService.loadFont(regularFont);
      if (onFontLoad) onFontLoad(regularFont);
    } catch (error) {
      console.error('Failed to load font:', error);
    }
  };

  // Filter fonts
  const filteredFamilies = fontFamilies.filter(({ family, category }) => {
    const matchesSearch = searchQuery === '' ||
      family.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort: selected first, then alphabetically
  const sortedFamilies = [...filteredFamilies].sort((a, b) => {
    if (a.family === value) return -1;
    if (b.family === value) return 1;
    return a.family.localeCompare(b.family);
  });

  return (
    <div className="font-selector space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search fonts..."
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
        />
        <svg className="absolute right-2 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Scope Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setScope('all')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            scope === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Fonts
        </button>
        <button
          onClick={() => setScope('global')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            scope === 'global'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          System
        </button>
        <button
          onClick={() => setScope('user')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            scope === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          My Fonts
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {['all', 'serif', 'sans-serif', 'display', 'handwriting', 'monospace'].map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Font List with Live Previews */}
      <div className="max-h-96 space-y-1 overflow-y-auto rounded border border-gray-300 bg-white p-2">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading fonts...</div>
        ) : sortedFamilies.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No fonts found</div>
        ) : (
          sortedFamilies.map(({ family, category, variants }) => (
            <button
              key={family}
              onClick={() => {
                onChange(family);
                handleFontHover(family);
              }}
              onMouseEnter={() => handleFontHover(family)}
              className={`w-full rounded px-3 py-2 text-left transition-colors ${
                value === family
                  ? 'bg-blue-100 text-blue-900 font-medium'
                  : 'bg-white text-gray-900 hover:bg-gray-100'
              }`}
              style={{
                fontFamily: hoveredFont === family || value === family ? family : 'inherit',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">{family}</span>
                <span className="text-xs text-gray-500">
                  {variants.length} variant{variants.length > 1 ? 's' : ''}
                </span>
              </div>
              {(hoveredFont === family || value === family) && (
                <div className="mt-1 text-xs text-gray-500">
                  The quick brown fox jumps over the lazy dog
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Upload Custom Font Button */}
      <button
        onClick={() => setShowUploadModal(true)}
        className="w-full rounded border border-dashed border-gray-400 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        + Upload Custom Font
      </button>

      {/* Upload Modal (placeholder - will implement below) */}
      {showUploadModal && (
        <FontUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={(font) => {
            setShowUploadModal(false);
            loadFonts(); // Reload fonts list
            onChange(font.fontFamily); // Select the new font
          }}
        />
      )}
    </div>
  );
}

// Font Upload Modal Component
interface FontUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (font: Font) => void;
}

function FontUploadModal({ isOpen, onClose, onSuccess }: FontUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fontName, setFontName] = useState('');
  const [fontFamily, setFontFamily] = useState('');
  const [fontCategory, setFontCategory] = useState('sans-serif');
  const [fontVariant, setFontVariant] = useState('regular');
  const [fontWeight, setFontWeight] = useState(400);
  const [fontStyle, setFontStyle] = useState('normal');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validExtensions = ['.woff2', '.woff', '.ttf', '.otf', '.ttc'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      setError('Please select a valid font file (.woff2, .woff, .ttf, .otf, .ttc)');
      return;
    }

    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File size exceeds 10MB limit');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Auto-fill font name from file name
    if (!fontName) {
      const name = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setFontName(name);
      if (!fontFamily) {
        setFontFamily(name.replace(/\s+/g, ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !fontName || !fontFamily) {
      setError('Please fill in all required fields');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const font = await fontService.uploadFont(file, {
        fontName,
        fontFamily,
        fontCategory,
        fontVariant,
        fontWeight,
        fontStyle,
      });

      onSuccess(font);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload font');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Upload Custom Font</h3>

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Font File *</label>
            <input
              type="file"
              accept=".woff2,.woff,.ttf,.otf,.ttc"
              onChange={handleFileChange}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">
              Supported formats: .woff2 (recommended), .woff, .ttf, .otf, .ttc
            </p>
          </div>

          {/* Font Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Font Name *</label>
            <input
              type="text"
              value={fontName}
              onChange={(e) => setFontName(e.target.value)}
              placeholder="e.g., My Custom Font Bold"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>

          {/* Font Family */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Font Family *</label>
            <input
              type="text"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              placeholder="e.g., MyCustomFont"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">
              CSS font-family name (no spaces recommended)
            </p>
          </div>

          {/* Category, Variant, Weight, Style */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <select
                value={fontCategory}
                onChange={(e) => setFontCategory(e.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="serif">Serif</option>
                <option value="sans-serif">Sans-Serif</option>
                <option value="display">Display</option>
                <option value="handwriting">Handwriting</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Variant</label>
              <select
                value={fontVariant}
                onChange={(e) => setFontVariant(e.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="regular">Regular</option>
                <option value="bold">Bold</option>
                <option value="italic">Italic</option>
                <option value="bold-italic">Bold Italic</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Weight</label>
              <input
                type="number"
                value={fontWeight}
                onChange={(e) => setFontWeight(parseInt(e.target.value))}
                min={100}
                max={900}
                step={100}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Style</label>
              <select
                value={fontStyle}
                onChange={(e) => setFontStyle(e.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading || !file || !fontName || !fontFamily}
            className="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload Font'}
          </button>
        </div>
      </div>
    </div>
  );
}
