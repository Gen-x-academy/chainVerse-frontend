'use client';

import React, { useState } from 'react';
import { useCancellableTimeout } from '@/src/hooks/useCancellableTimeout';

interface ProfileFormValues {
  firstName: string;
  lastName: string;
  bio: string;
  avatarUrl: string;
}

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileFormValues>({
    firstName: '',
    lastName: '',
    bio: '',
    avatarUrl: '',
  });
  const [passwords, setPasswords] = useState<PasswordFormValues>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const saveStatusTimeout = useCancellableTimeout();
  const passwordStatusTimeout = useCancellableTimeout();

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
      await fetch(`${base}/student-account-settings/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
        }),
      });
      setSaveStatus('saved');
      saveStatusTimeout.schedule(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (passwords.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    setPasswordStatus('saving');
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
      await fetch(`${base}/student-account-settings/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        }),
      });
      setPasswordStatus('saved');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      passwordStatusTimeout.schedule(() => setPasswordStatus('idle'), 3000);
    } catch {
      setPasswordStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto px-4 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-500 mt-1">Manage your profile and security settings.</p>
        </div>

        {/* Profile section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h2>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center overflow-hidden">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-2xl font-bold" aria-hidden="true">
                  {profile.firstName?.[0]?.toUpperCase() ?? 'U'}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Profile picture</p>
              <p className="text-xs text-gray-500">Enter an image URL below to update your avatar.</p>
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={profile.firstName}
                  onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="Jane"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring text-sm"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={profile.lastName}
                  onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="avatarUrl" className="block text-sm font-medium text-gray-700 mb-1">
                Avatar URL
              </label>
              <input
                id="avatarUrl"
                type="url"
                value={profile.avatarUrl}
                onChange={(e) => setProfile((p) => ({ ...p, avatarUrl: e.target.value }))}
                placeholder="https://example.com/avatar.png"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring text-sm"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                id="bio"
                rows={3}
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Tell us a bit about yourself..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring text-sm resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saveStatus === 'saving'}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50 focus-ring"
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Save Profile'}
              </button>
              {saveStatus === 'saved' && <p className="text-green-600 text-sm">Profile saved!</p>}
              {saveStatus === 'error' && <p className="text-red-600 text-sm">Failed to save. Please try again.</p>}
            </div>
          </form>
        </section>

        {/* Change password section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Change Password</h2>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={passwords.currentPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring text-sm"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring text-sm"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring text-sm"
              />
            </div>

            {passwordError && <p className="text-red-600 text-sm">{passwordError}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={passwordStatus === 'saving'}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50 focus-ring"
              >
                {passwordStatus === 'saving' ? 'Updating...' : 'Update Password'}
              </button>
              {passwordStatus === 'saved' && <p className="text-green-600 text-sm">Password updated!</p>}
              {passwordStatus === 'error' && (
                <p className="text-red-600 text-sm">Failed to update. Check your current password.</p>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
