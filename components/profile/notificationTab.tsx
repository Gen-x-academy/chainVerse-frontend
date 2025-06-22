import { NotificationData } from '@/types';
import { useState } from 'react';

const NotificationTab: React.FC<{ notificationData: NotificationData }> = ({
  notificationData,
}) => {
  const [preferences, setPreferences] = useState({
    courseUpdates: true,
    newLessons: true,
    assignmentDeadlines: true,
    instructorMessages: true,
    certificateIssuance: true,
    marketingEmails: false,
  });

  const handlePreferenceChange = (key: keyof typeof preferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSavePreferences = () => {
    // Handle save logic here
    console.log('Preferences saved:', preferences);
  };

  return (
    <div className="w-full">
      {/* Notification Preferences */}
      <div className="bg-white rounded-xl shadow-sm border p-8">
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Notification Preferences
          </h3>
          <p className="text-gray-500">Choose how you want to be notified</p>
        </div>

        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-lg mb-1">
                Course updates
              </p>
              <p className="text-sm text-gray-500">
                Get notified when a course you're enrolled in is updated
              </p>
            </div>
            <button
              onClick={() => handlePreferenceChange('courseUpdates')}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                preferences.courseUpdates ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                  preferences.courseUpdates ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-lg mb-1">
                New lessons
              </p>
              <p className="text-sm text-gray-500">
                Get notified when new lessons are available in your courses
              </p>
            </div>
            <button
              onClick={() => handlePreferenceChange('newLessons')}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                preferences.newLessons ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                  preferences.newLessons ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-lg mb-1">
                Assignment deadlines
              </p>
              <p className="text-sm text-gray-500">
                Receive reminders about upcoming assignment deadlines
              </p>
            </div>
            <button
              onClick={() => handlePreferenceChange('assignmentDeadlines')}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                preferences.assignmentDeadlines ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                  preferences.assignmentDeadlines
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-lg mb-1">
                Instructor messages
              </p>
              <p className="text-sm text-gray-500">
                Get notified when an instructor sends you a message
              </p>
            </div>
            <button
              onClick={() => handlePreferenceChange('instructorMessages')}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                preferences.instructorMessages ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                  preferences.instructorMessages
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-lg mb-1">
                Certificate issuance
              </p>
              <p className="text-sm text-gray-500">
                Get notified when a certificate is issued to your wallet
              </p>
            </div>
            <button
              onClick={() => handlePreferenceChange('certificateIssuance')}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                preferences.certificateIssuance ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                  preferences.certificateIssuance
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-lg mb-1">
                Marketing emails
              </p>
              <p className="text-sm text-gray-500">
                Receive updates about new courses and promotions
              </p>
            </div>
            <button
              onClick={() => handlePreferenceChange('marketingEmails')}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                preferences.marketingEmails ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                  preferences.marketingEmails
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-12">
          <button
            onClick={handleSavePreferences}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Save Preference
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationTab;
