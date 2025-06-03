import { useState } from "react";
import { UserData } from "@/lib/types";

// Tab Content Components
const PersonalInfoTab: React.FC<{ userData: UserData }> = ({ userData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(() => {
    const nameParts = userData.name?.split(' ') || [];
    return {
      ...userData,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || ''
    };
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleUpdateProfile = () => {
    const updatedUserData = {
      ...formData,
      name: `${formData.firstName} ${formData.lastName}`.trim()
    };
    
    // Handle update logic here
    console.log('Profile updated:', updatedUserData);
    setIsEditing(false);
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Personal Information</h2>
          <p className="text-gray-500 text-sm">Update your personal details</p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* First Name and Last Name Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">First name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="John"
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">Last name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Doe"
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="johndoe@example.com"
              className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">Bio</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Tell us about yourself..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200 resize-none"
            />
          </div>

          {/* Update Button */}
          <div className="pt-4">
            <button
              onClick={handleUpdateProfile}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
                />
              </svg>
              Update Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalInfoTab;