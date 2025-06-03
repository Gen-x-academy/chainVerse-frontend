'use client';
import { useState } from 'react';
import { Wallet, Eye, EyeOff, MoveLeft } from 'lucide-react';


const LoginForm = () => {
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      <div className="flex flex-col px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        <div className="flex bg-gray-100 p-2 rounded-lg shadow-md w-full">
          <button
            onClick={() => setRole('student')}
            className={`hover:opacity-70 py-2 px-2 rounded-md w-[50%] ${
              role === 'student'
                ? 'bg-white text-black border-2 border-border]'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Login as Student
          </button>
          <button
            onClick={() => setRole('instructor')}
            className={`hover:opacity-70 py-2 px-2 rounded-md w-[50%] ${
              role === 'instructor'
                ? 'bg-white text-black border-2 border-border]'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Login as Instructor
          </button>
        </div>

        <div className="bg-[#F9F8FD] text-left max-w-md w-full p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4">
            {role === 'student' ? 'Student Login' : 'Instructor Login'}
          </h2>
          <p className="text-gray-500 mb-4">
            Enter your credentials to access your {role} account.
          </p>
        </div>
        <div className="max-w-md w-full space-y-2 bg-white px-8 py-4 shadow-xl">
          <label className="block mb-2 text-gray-700">Email</label>
          <input
            type="email"
            placeholder="your.email@example.com"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <label className="block mt-4 mb-2 text-gray-700">Password</label>
          <div className="relative w-full max-w-md">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              className="absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className="flex justify-between items-center mt-4">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" /> Remember me
            </label>
            <a href="#" className="text-blue-500 text-sm">
              Forgot password?
            </a>
          </div>

          <div className="flex w-full flex-col space-y-3 my-3">
            <button className="bg-gradient-to-r from-primary via-primary to-secondary hover:opacity-90 px-2 py-2 text-sm font-bold rounded-md text-white">
              Login
            </button>

            <button className="bg-gray-200 text-black p-2 hover:opacity-75 px-2 py-2 text-sm font-bold rounded-md">
              <Wallet className="inline mr-2 py-0.5 text-xs" />
              Connect with Web3 Wallet
            </button>
          </div>

          <div className="border-b border-b-gray-400 h-1 mt-4 w-full"></div>

          <div className="text-center mt-4">
            <span className="text-gray-500 text-sm">
              {role === 'student'
                ? "Don't have an account?"
                : 'Want to become an instructor?'}{' '}
              <a href="#" className="text-blue-500">
                {role === 'student' ? 'Sign up' : 'Apply here'}
              </a>
            </span>
          </div>
        </div>
      </div>{' '}
    </div>
  );
};

export default LoginForm;
