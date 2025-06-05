"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Wallet, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Task to be done
    //  API call to authenticate
    setUser({
      id: "1",
      email,
      role,
      walletAddress: "0xfcf2....9a56",
    });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex  flex-col justify-center">
      <div className="flex flex-col px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        <div className="flex bg-gray-100 p-2  shadow-md w-full">
          <button
            onClick={() => setRole("student")}
            className={`hover:opacity-70 py-2 px-2 rounded-md w-[50%] ${
              role === "student"
                ? "bg-white text-black border-2 border-border"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            Login as Student
          </button>
          <button
            onClick={() => setRole("instructor")}
            className={`hover:opacity-70 py-2 px-2 rounded-md w-[50%] ${
              role === "instructor"
                ? "bg-white text-black border-2 border-border"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            Login as Instructor
          </button>
        </div>

        <div className="bg-[#F9F8FD] text-left max-w-md w-full p-6 shadow-xl">
          <div className="sm:mx-auto sm:w-full py-6 sm:max-w-md">
            <Link
              href="/"
              className="flex flex-col items-center gap-2 justify-center"
              aria-label="Home"
            >
              <Image
                className="mx-auto h-10 w-auto"
                src="/logo.png"
                alt="ChainVerse Academy"
                width={32}
                height={32}
              />
              <span className="text-xl font-medium  tracking-tight select-none">
                ChainVerse Academy
              </span>
            </Link>
          </div>
          <h2 className="text-xl font-semibold mb-4">
            {role === "student" ? "Student Login" : "Instructor Login"}
          </h2>
          <p className="text-gray-500 mb-4">
            Enter your credentials to access your {role} account.
          </p>
        </div>

        <div className="max-w-md w-full space-y-2 bg-white rounded-b-xl px-8 py-4 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>

            <div>
              <label className="block mb-2 text-gray-700">Password</label>
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" /> Remember me
              </label>
              <Link href="/forgot-password" className="text-blue-500 text-sm">
                Forgot password?
              </Link>
            </div>

            <div className="flex w-full flex-col space-y-3">
              <button
                type="submit"
                className="bg-gradient-to-r from-primary via-primary to-secondary hover:opacity-90 px-2 py-2 text-sm font-bold rounded-md text-white"
              >
                Login
              </button>

              <button
                type="button"
                className="bg-gray-200 text-black p-2 hover:opacity-75 px-2 py-2 text-sm font-bold rounded-md"
              >
                <Wallet className="inline mr-2 py-0.5 text-xs" />
                Connect with Web3 Wallet
              </button>
            </div>
          </form>

          <div className="border-b border-b-gray-400 h-1 mt-4 w-full"></div>

          <div className="text-center mt-4">
            <span className="text-gray-500 text-sm">
              {role === "student"
                ? "Don't have an account?"
                : "Want to become an instructor?"}{" "}
              <Link
                href={role === "student" ? "/register" : "/instructor_register"}
                className="text-blue-500"
              >
                {role === "student" ? "Sign up" : "Apply here"}
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
