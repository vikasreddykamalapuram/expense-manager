import { useState, useEffect } from 'react';
import { Plus, Users, ArrowRight, Trash2 } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import * as splitService from '../services/splitService';
import type { SplitGroup, SplitMember } from '../../../shared/types';
import { GroupDetail } from './GroupDetail';
import { CreateGroupModal } from './CreateGroupModal';

export function SplitwisePage() {
  const { state } = useAppContext();
  const profileId = state.activeProfileId;

  const [groups, setGroups] = useState<SplitGroup[]>([]);
  const [members, setMembers] = useState<SplitMember[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [g, m] = await Promise.all([
      splitService.getGroups(profileId),
      splitService.getMembers(profileId),
    ]);
    setGroups(g);
    setMembers(m);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [profileId]);

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Delete this group? All expenses will be lost.')) return;
    await splitService.deleteGroup(id);
    if (selectedGroupId === id) setSelectedGroupId(null);
    loadData();
  };

  if (selectedGroupId) {
    return (
      <GroupDetail
        groupId={selectedGroupId}
        profileId={profileId}
        members={members}
        onBack={() => { setSelectedGroupId(null); loadData(); }}
        onMembersChanged={loadData}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Splitwise</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Split expenses with friends & groups</p>
        </div>
        <button
          onClick={() => setShowCreateGroup(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />
          New Group
        </button>
      </div>

      {/* Groups List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No groups yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Create a group to start splitting expenses</p>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Create Your First Group
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => {
            const groupMembers = members.filter(m => group.memberIds.includes(m.id));
            return (
              <div
                key={group.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedGroupId(group.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{group.description}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Member avatars */}
                <div className="flex items-center gap-1 mb-3">
                  {groupMembers.slice(0, 5).map(m => (
                    <div
                      key={m.id}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ backgroundColor: m.avatarColor }}
                      title={m.name}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {groupMembers.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300">
                      +{groupMembers.length - 5}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{groupMembers.length} members</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          profileId={profileId}
          members={members}
          onClose={() => setShowCreateGroup(false)}
          onCreated={() => { setShowCreateGroup(false); loadData(); }}
          onMembersChanged={loadData}
        />
      )}
    </div>
  );
}
