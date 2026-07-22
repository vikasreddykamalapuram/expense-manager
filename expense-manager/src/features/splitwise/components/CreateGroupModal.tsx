import { useState } from 'react';
import { X, Plus, UserPlus } from 'lucide-react';
import * as splitService from '../services/splitService';
import type { SplitMember } from '../../../shared/types';

interface Props {
  profileId: string;
  members: SplitMember[];
  onClose: () => void;
  onCreated: () => void;
  onMembersChanged: () => void;
}

const DEFAULT_GROUP_CATEGORIES = ['trip', 'flat', 'office', 'couple', 'friends', 'family', 'other'];

export function CreateGroupModal({ profileId, members, onClose, onCreated, onMembersChanged }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('friends');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('expenseiq_custom_group_categories') || '[]');
    } catch { return []; }
  });

  const allCategories = [...DEFAULT_GROUP_CATEGORIES, ...customCategories];

  const handleAddCustomCategory = () => {
    const trimmed = customCategoryInput.trim().toLowerCase();
    if (!trimmed || allCategories.includes(trimmed)) return;
    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    localStorage.setItem('expenseiq_custom_group_categories', JSON.stringify(updated));
    setCategory(trimmed);
    setCustomCategoryInput('');
    setShowCustomCategory(false);
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAddNewMember = async () => {
    if (!newMemberName.trim()) return;
    const member = await splitService.addMember(profileId, {
      name: newMemberName.trim(),
      avatarColor: splitService.getRandomAvatarColor(),
    });
    setSelectedMemberIds(prev => [...prev, member.id]);
    setNewMemberName('');
    setShowAddMember(false);
    onMembersChanged();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedMemberIds.length < 2) return;
    setSaving(true);
    await splitService.addGroup(profileId, {
      name: name.trim(),
      description: description.trim() || undefined,
      memberIds: selectedMemberIds,
      category,
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Group</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Goa Trip 2026"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <div className="flex flex-wrap gap-2">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    category === cat
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
              {!showCustomCategory && (
                <button
                  type="button"
                  onClick={() => setShowCustomCategory(true)}
                  className="px-3 py-1 rounded-full text-xs font-medium text-primary-600 dark:text-primary-400 border border-dashed border-primary-400 dark:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                >
                  + Custom
                </button>
              )}
            </div>
            {showCustomCategory && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={customCategoryInput}
                  onChange={e => setCustomCategoryInput(e.target.value)}
                  placeholder="e.g., gym, project, roommates"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomCategory())}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCustomCategory(false); setCustomCategoryInput(''); }}
                  className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Members Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Members * <span className="text-xs text-gray-400">(select at least 2)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                <UserPlus size={14} />
                Add New
              </button>
            </div>

            {/* Add new member inline */}
            {showAddMember && (
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  placeholder="Member name"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddNewMember())}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddNewMember}
                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddMember(false); setNewMemberName(''); }}
                  className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Member list */}
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No members yet. Add members above.</p>
              ) : (
                members.map(m => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ backgroundColor: m.avatarColor }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-900 dark:text-white">{m.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!name.trim() || selectedMemberIds.length < 2 || saving}
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
