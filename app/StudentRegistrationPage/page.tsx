'use client';
import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

function App() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const validatePassword = (password: string) => {
    const hasMinLength = password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return hasMinLength && hasLetter && hasNumber && hasSymbol;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = {
      firstName: !formData.firstName ? 'First name is required' : '',
      lastName: !formData.lastName ? 'Last name is required' : '',
      email: !formData.email
        ? 'Email is required'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
        ? 'Invalid email format'
        : '',
      password: !validatePassword(formData.password)
        ? 'Password must be at least 8 characters with letters, numbers, and symbols'
        : '',
    };

    setErrors(newErrors);

    if (!Object.values(newErrors).some((error) => error)) {
      // Form is valid, proceed with submission
      console.log('Form submitted:', formData);
    }
  };

  const handleWeb3Registration = () => {
    // Implement Web3 wallet connection logic here
    console.log('Connecting Web3 wallet...');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      {/* Outer container: Full screen height, centers content vertically */}
      <div className="flex flex-col px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        {/* Inner container: Limits width and centers horizontally with mx-auto */}

        {/* Back to Home button: Aligned to the left at the top */}
        <div className="p-4 self-start">
          <button className="flex items-center text-black font-bold hover:text-gray-900">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </button>
        </div>

        {/* Card 1: Title section */}
        <div className="bg-[#F9F8FD] text-left max-w-md w-full p-6 shadow-xl">
          <h1 className="text-2xl font-bold text-gray-900">
            Create Student Account
          </h1>
          <p className="text-gray-600 text-sm">
            Join ChainVerse Academy to start your blockchain learning journey
          </p>
        </div>

        {/* Card 2: Form section */}
        <div className="max-w-md w-full space-y-2 bg-white px-8 py-4 shadow-xl">
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {/* Form grid for First Name and Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-bold text-gray-700"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full rounded-sm border ${
                    errors.firstName ? 'border-red-300' : 'border-gray-300'
                  } px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                  placeholder="John"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.firstName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-bold text-gray-700"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full rounded-sm border ${
                    errors.lastName ? 'border-red-300' : 'border-gray-300'
                  } px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                  placeholder="Doe"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-bold text-gray-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-sm border ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                } px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                placeholder="your.email@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Password field with toggle visibility */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-bold text-gray-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full rounded-sm border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } px-3 py-2 pr-10 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Password must be at least 8 characters long with a mix of
                letters, numbers, and symbols.
              </p>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-[#426ae2] to-[#9470db] hover:from-[#3a5ecc] hover:to-[#8563c4] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Continue
            </Button>

            {/* Web3 Wallet registration button */}
            <button
              type="button"
              onClick={handleWeb3Registration}
              className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Wallet className="w-5 h-5 mr-2" />
              Register with Web3 Wallet
            </button>

            {/* Sign-in link */}
            <div className="text-center">
              <div className="text-sm text-gray-500">OR</div>
              <p className="mt-2 text-sm text-gray-600">
                Already have an account?{' '}
                <a
                  href="/signin"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Sign in
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
