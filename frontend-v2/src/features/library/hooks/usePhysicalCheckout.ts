'use client';

import { useCallback, useMemo, useState } from 'react';
import { libraryService } from '../services/library.service';
import { useAuthStore } from '@/src/store/authStore';
import type {
  BorrowingPolicy,
  CheckoutEligibility,
  CheckoutReceipt,
  CopyDetail,
  PatronSummary,
} from '../types/library.types';

export interface ScanResult {
  success: boolean;
  duplicate?: boolean;
  error?: string;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Issue #951: librarian physical-book checkout.
 *
 * Holds the patron/copy selections so transient errors never clear valid
 * choices, blocks repeat submissions, and previews the policy due date.
 */
export function usePhysicalCheckout() {
  const staffId = useAuthStore((state) => state.user?.id);

  const [patronQuery, setPatronQuery] = useState('');
  const [patron, setPatron] = useState<PatronSummary | null>(null);
  const [policy, setPolicy] = useState<BorrowingPolicy | null>(null);
  const [eligibility, setEligibility] = useState<CheckoutEligibility | null>(null);
  const [patronLoading, setPatronLoading] = useState(false);
  const [patronError, setPatronError] = useState<string | null>(null);

  const [copy, setCopy] = useState<CopyDetail | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null);

  const lookupPatron = useCallback(async (userId: string) => {
    const id = userId.trim();
    if (!id) return;
    setPatronLoading(true);
    setPatronError(null);
    try {
      const [profile, resolvedPolicy, resolvedEligibility] = await Promise.all([
        libraryService.getPatronProfile(id),
        libraryService.getPatronPolicy(id),
        libraryService.getPatronEligibility(id),
      ]);
      setPatron(profile);
      setPolicy(resolvedPolicy);
      setEligibility(resolvedEligibility);
      setReceipt(null);
      setCheckoutError(null);
    } catch (err) {
      // Preserve any previously selected patron so a typo does not lose context.
      setPatronError(err instanceof Error ? err.message : 'Patron not found.');
    } finally {
      setPatronLoading(false);
    }
  }, []);

  const lookupCopy = useCallback(async (barcode: string): Promise<ScanResult> => {
    const code = barcode.trim();
    if (!code) return { success: false, error: 'Enter a barcode.' };

    setCopyLoading(true);
    setCopyError(null);
    setScanMessage(null);
    try {
      const detail = await libraryService.lookupByBarcode(code);
      setCopy(detail);
      setReceipt(null);
      setCheckoutError(null);
      setScanMessage(`Scan accepted for ${detail.title}`);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Copy not found.';
      // Preserve any previously selected copy for the same reason.
      setCopyError(message);
      setScanMessage(message);
      return { success: false, error: message };
    } finally {
      setCopyLoading(false);
    }
  }, []);

  const dueDatePreview = useMemo(() => {
    if (!policy) return null;
    return toDateOnly(addDays(new Date(), policy.loanPeriodDays));
  }, [policy]);

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (patron && patron.status !== 'active') {
      list.push(`Patron account is ${patron.status}.`);
    }
    if (eligibility && !eligibility.eligible) {
      list.push(...(eligibility.reasons?.length ? eligibility.reasons : ['Patron is not eligible for checkout.']));
    }
    if (copy && copy.status !== 'available') {
      list.push(`Copy is not available (status: ${copy.status}).`);
    }
    return list;
  }, [patron, eligibility, copy]);

  const canConfirm = Boolean(
    patron &&
      copy &&
      patron.status === 'active' &&
      copy.status === 'available' &&
      eligibility?.eligible !== false &&
      warnings.length === 0 &&
      !submitting &&
      !receipt,
  );

  const confirmCheckout = useCallback(async () => {
    // Guard against repeat submissions (double clicks / Enter).
    if (!patron || !copy || submitting || receipt) return null;
    if (copy.status !== 'available' || patron.status !== 'active' || eligibility?.eligible === false) {
      setCheckoutError('Resolve the warnings before confirming checkout.');
      return null;
    }

    setSubmitting(true);
    setCheckoutError(null);
    try {
      const result = await libraryService.checkoutPhysical({
        barcode: copy.barcode,
        patronId: patron.id,
        staffId,
      });
      const nextReceipt: CheckoutReceipt = {
        loanId: result.id,
        barcode: copy.barcode,
        copyTitle: copy.title,
        patronId: patron.id,
        patronName: patron.name,
        dueDate: result.dueDate,
        checkedOutAt: result.checkedOutAt,
      };
      setReceipt(nextReceipt);
      // Reflect the now-unavailable copy without dropping the selection.
      setCopy({ ...copy, status: 'checked-out' });
      return nextReceipt;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [patron, copy, eligibility, submitting, receipt, staffId]);

  const reset = useCallback(() => {
    setPatronQuery('');
    setPatron(null);
    setPolicy(null);
    setEligibility(null);
    setPatronError(null);
    setCopy(null);
    setCopyError(null);
    setScanMessage(null);
    setCheckoutError(null);
    setReceipt(null);
  }, []);

  return {
    patronQuery,
    setPatronQuery,
    lookupPatron,
    patron,
    policy,
    eligibility,
    patronLoading,
    patronError,
    dueDatePreview,
    warnings,
    copy,
    copyLoading,
    copyError,
    scanMessage,
    lookupCopy,
    submitting,
    checkoutError,
    receipt,
    canConfirm,
    confirmCheckout,
    reset,
  };
}
