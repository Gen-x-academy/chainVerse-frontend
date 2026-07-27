"use client";

import React from "react";
import { Settings, User, Mail, Shield, Save } from "lucide-react";

/**
 * STANDARD SPACING REFERENCE GUIDE:
 * * - Page Container: `max-w-3xl mx-auto p-6` (or p-4 on mobile sm:p-6)
 * - Section Spacing (Vertical Rhythm): `space-y-8`
 * - Card Padding: `p-6`
 * - Card Header Padding: `px-6 py-4`
 * - Internal Form Spacing: `space-y-6`
 * - Label to Input Spacing: `mb-1.5`
 * - Grid Gaps: `gap-6` (large), `gap-4` (medium)
 * - Icon to Text Spacing: `mr-2` or `gap-2`
 * - Button Padding: `px-6 py-2.5` (large), `px-4 py-2` (normal)
 */

export function StandardFormTemplate() {
  return (
    // 1. PAGE CONTAINER: Standard padding (p-6) and vertical spacing (py-8)
    <div className="max-w-3xl mx-auto p-6 py-8">
      
      {/* 2. PAGE HEADER: Margin bottom (mb-8) to separate from content */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="w-6 h-6 text-gray-700" />
          Standardized Form Blueprint
        </h1>
        {/* Margin top (mt-2) for subtitle spacing */}
        <p className="text-sm text-gray-500 mt-2">
          Use this layout as the standard reference for all spacing and margins across the UI.
        </p>
      </div>

      {/* 3. VERTICAL RHYTHM: space-y-8 creates consistent 2rem gaps between cards */}
      <form className="space-y-8">
        
        {/* --- CARD 1: Basic Info --- */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Card Header: px-6 py-4 */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <User className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
          </div>
          
          {/* Card Body: p-6 with internal space-y-6 for standard input separation */}
          <div className="p-6 space-y-6">
            
            {/* Standard Input Group */}
            <div>
              {/* Label margin-bottom: mb-1.5 (0.375rem) */}
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-900 mb-1.5">
                Full Name
              </label>
              {/* Input padding: px-3 py-2 */}
              <input
                id="fullName"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus-ring transition-colors"
                placeholder="Jane Doe"
              />
            </div>

            {/* Grid Layout: gap-6 creates consistent 1.5rem spacing between columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1.5 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus-ring transition-colors"
                  placeholder="jane@example.com"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-900 mb-1.5 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  System Role
                </label>
                <select
                  id="role"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus-ring transition-colors"
                >
                  <option>Administrator</option>
                  <option>Editor</option>
                  <option>Viewer</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* --- CARD 2: Preferences --- */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Checkbox item: gap-3 between checkbox and text */}
            <label className="flex items-start gap-3">
              {/* Checkbox margin-top: mt-1 to align perfectly with text baseline */}
              <input type="checkbox" className="mt-1 w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900" />
              <div>
                <span className="block text-sm font-medium text-gray-900">Email Notifications</span>
                <span className="block text-sm text-gray-500 mt-0.5">Receive daily summary reports in your inbox.</span>
              </div>
            </label>
          </div>
        </div>

        {/* 4. FOOTER ACTIONS: padding top (pt-4) and flex gap (gap-3) */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            className="px-6 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}