import { db } from '@/api/client';

import { useState } from 'react';

import { Upload, Save, Sparkles } from 'lucide-react';

// For Rainbow earners — create a custom badge with name + image.
export default function CustomBadgeCreator({ customName, customImage, onSave, onEquipCustom, isCustomEquipped }) {
  const [name, setName] = useState(customName || '');
  const [image, setImage] = useState(customImage || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setImage(file_url);
    } catch { /* ignore */ }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), image);
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-red-950/20 via-yellow-950/10 via-green-950/10 via-blue-950/10 to-purple-950/20 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-pink-400" />
        <h3 className="font-bold bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
          Create Your Custom Badge
        </h3>
      </div>
      <p className="mb-4 text-sm text-zinc-400">
        You've earned a Rainbow roll! Design your own badge with a custom name and picture. Other players will see it when equipped.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Preview */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-pink-500/50 bg-zinc-900">
            {image ? (
              <img src={image} alt="Custom badge" className="h-full w-full object-cover" />
            ) : (
              <Sparkles className="h-8 w-8 text-pink-400/50" />
            )}
          </div>
          <span className="max-w-[5rem] truncate text-xs font-semibold text-zinc-300">
            {name || 'Custom'}
          </span>
        </div>

        {/* Inputs */}
        <div className="flex-1 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Badge Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="My Legendary Badge"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-pink-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Badge Image</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:border-pink-500/50">
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : image ? 'Change image' : 'Upload image'}
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Badge'}
            </button>
            {image && name.trim() && (
              <button
                onClick={onEquipCustom}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isCustomEquipped
                    ? 'bg-violet-600 text-white'
                    : 'border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-violet-500'
                }`}
              >
                {isCustomEquipped ? '✓ Equipped' : 'Equip Custom'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}