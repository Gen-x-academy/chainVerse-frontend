import React from 'react'
import { UserData } from '@/lib/types'
import { useState } from 'react';
import { Camera, Check } from 'lucide-react';

const SideProfile: React.FC<{ userData: UserData }> = ({ userData }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="w-full md:w-[40%] h-full mr-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Profile Header */}
        <div className="flex flex-col items-center p-8 bg-white">
          <div className="relative mb-6">
            {/* Avatar */}
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center relative overflow-hidden">
              {userData.avatar ? (
                <img
                  src={userData.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
            </div>
            {/* Camera icon */}
            <button className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
              <Camera size={14} className="text-gray-600" />
            </button>
          </div>

          {/* Name and Role */}
          <h2 className="text-xl font-bold text-gray-900 text-center mb-1">{userData.name}</h2>
          <p className="text-sm text-gray-500">{userData.role || 'Student'}</p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100"></div>

        {/* Profile Stats */}
        <div className="p-6 space-y-5">
          {/* Member Since */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Member since</span>
            <span className="text-sm font-medium text-gray-900">
              {userData.memberSince || 'January 2025'}
            </span>
          </div>

          {/* Courses Completed */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Courses completed</span>
            <span className="text-sm font-medium text-gray-900">
              {userData.coursesCompleted || 1}
            </span>
          </div>

          {/* Certificates Earned */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Certificates earned</span>
            <span className="text-sm font-medium text-gray-900">
              {userData.certificatesEarned || 1}
            </span>
          </div>

          {/* Wallet Connected */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Wallet connected</span>
            <div className="flex items-center">
              {userData.walletConnected !== false ? (
                <>
                  <Check size={14} className="text-green-600 mr-1" />
                  <span className="text-sm font-medium text-green-600">Yes</span>
                </>
              ) : (
                <span className="text-sm font-medium text-gray-900">No</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SideProfile