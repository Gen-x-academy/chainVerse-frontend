'use client';

import React from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Split } from 'lucide-react';
import type {
  ConditionalOperator,
  ConfigurableFormField,
  FieldCondition,
} from '../types';

export interface ConditionalRuleBuilderProps {
  currentFieldId: string;
  condition?: FieldCondition;
  availableTargetFields: ConfigurableFormField[];
  onChange: (condition?: FieldCondition) => void;
  className?: string;
}

const OPERATOR_LABELS: Record<ConditionalOperator, string> = {
  is_checked: 'is checked (true)',
  equals: 'equals (=)',
  not_equals: 'does not equal (!=)',
  greater_than: 'is greater than (>)',
  less_than: 'is less than (<)',
  in: 'is one of (in set)',
  not_in: 'is not one of (not in set)',
};

export function ConditionalRuleBuilder({
  currentFieldId,
  condition,
  availableTargetFields,
  onChange,
  className = '',
}: ConditionalRuleBuilderProps) {
  // Only fields that appear before the current field in form order are eligible targets (prevents forward refs)
  const eligibleTargets = availableTargetFields.filter((f) => f.id !== currentFieldId);

  const isEnabled = Boolean(condition);

  function handleToggle(enable: boolean) {
    if (enable) {
      const defaultTarget = eligibleTargets[0]?.id || '';
      onChange({
        targetFieldId: defaultTarget,
        operator: 'is_checked',
        value: true,
      });
    } else {
      onChange(undefined);
    }
  }

  function handleTargetChange(targetFieldId: string) {
    if (!condition) return;
    onChange({
      ...condition,
      targetFieldId,
    });
  }

  function handleOperatorChange(operator: ConditionalOperator) {
    if (!condition) return;
    onChange({
      ...condition,
      operator,
      value: operator === 'is_checked' ? true : '',
    });
  }

  function handleValueChange(rawVal: string) {
    if (!condition) return;
    let parsed: unknown = rawVal;
    if (condition.operator === 'in' || condition.operator === 'not_in') {
      parsed = rawVal.split(',').map((s) => s.trim());
    } else if (condition.operator === 'greater_than' || condition.operator === 'less_than') {
      parsed = Number(rawVal);
    }
    onChange({
      ...condition,
      value: parsed,
    });
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 text-xs ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <Split className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          <span>Conditional Visibility Rule</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
          />
          <span>Enable Condition</span>
        </label>
      </div>

      <p className="text-slate-500 leading-relaxed">
        Only display this item when preceding applicant responses meet the specified criteria.
      </p>

      {isEnabled && condition && (
        <div className="pt-2 border-t border-slate-200/80 space-y-3">
          {eligibleTargets.length === 0 ? (
            <p role="alert" className="text-amber-700 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>No preceding fields available to depend on. Add or reorder fields first.</span>
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {/* Target Field */}
              <div>
                <label htmlFor={`target-${currentFieldId}`} className="block text-[11px] font-medium text-slate-600 mb-1">
                  When field:
                </label>
                <select
                  id={`target-${currentFieldId}`}
                  value={condition.targetFieldId}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  {eligibleTargets.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} ({f.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Operator */}
              <div>
                <label htmlFor={`operator-${currentFieldId}`} className="block text-[11px] font-medium text-slate-600 mb-1">
                  Operator:
                </label>
                <select
                  id={`operator-${currentFieldId}`}
                  value={condition.operator}
                  onChange={(e) => handleOperatorChange(e.target.value as ConditionalOperator)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  {(Object.keys(OPERATOR_LABELS) as ConditionalOperator[]).map((op) => (
                    <option key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expected Value */}
              {condition.operator !== 'is_checked' && (
                <div>
                  <label htmlFor={`val-${currentFieldId}`} className="block text-[11px] font-medium text-slate-600 mb-1">
                    Value:
                  </label>
                  <input
                    id={`val-${currentFieldId}`}
                    type="text"
                    value={
                      Array.isArray(condition.value)
                        ? condition.value.join(', ')
                        : String(condition.value ?? '')
                    }
                    onChange={(e) => handleValueChange(e.target.value)}
                    placeholder={
                      condition.operator === 'in' || condition.operator === 'not_in'
                        ? 'val1, val2'
                        : 'expected value'
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 bg-indigo-50/60 p-2 rounded-lg border border-indigo-100">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Rule: Visible when <code>answers.{condition.targetFieldId}</code> {OPERATOR_LABELS[condition.operator]}{' '}
              {condition.operator !== 'is_checked' ? `"${String(condition.value)}"` : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
