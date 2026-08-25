'use client';

import React from 'react';
import { BookOpen, AlertCircle, CheckCircle } from 'lucide-react';

interface BorrowingRule {
  id: string;
  role: 'student' | 'tutor';
  rule: string;
  value: string;
  description?: string;
}

interface BorrowingRulesProps {
  rules: BorrowingRule[];
}

export function BorrowingRules({ rules }: BorrowingRulesProps) {
  if (rules.length === 0) return null;

  const studentRules = rules.filter(r => r.role === 'student');
  const tutorRules = rules.filter(r => r.role === 'tutor');

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Borrowing Rules</h2>

      {studentRules.length > 0 && (
        <RuleSection title="Student Rules" rules={studentRules} />
      )}

      {tutorRules.length > 0 && (
        <RuleSection title="Tutor Rules" rules={tutorRules} />
      )}

      <p className="text-xs text-gray-400">
        Rules are resolved based on your account role. If you believe a rule is incorrect,{' '}
        <a href="/contact" className="text-indigo-600 hover:underline">
          contact the library
        </a>.
      </p>
    </div>
  );
}

function RuleSection({ title, rules }: { title: string; rules: BorrowingRule[] }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          {title}
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {rules.map((rule) => (
          <div key={rule.id} className="px-4 py-3 flex items-start gap-3">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{rule.rule}</span>
                <span className="text-sm text-indigo-600 font-mono">{rule.value}</span>
              </div>
              {rule.description && (
                <p className="text-sm text-gray-500 mt-0.5">{rule.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
