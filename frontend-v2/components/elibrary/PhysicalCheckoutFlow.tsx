'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarcodeScanInput } from './BarcodeScanInput';
import { usePhysicalCheckout } from '@/src/features/library/hooks/usePhysicalCheckout';

export interface PhysicalCheckoutFlowProps {
  className?: string;
}

/** Issue #951: librarian checkout with patron lookup, scanning, review, and receipt. */
export function PhysicalCheckoutFlow({ className }: PhysicalCheckoutFlowProps) {
  const checkout = usePhysicalCheckout();

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle>1. Patron lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void checkout.lookupPatron(checkout.patronQuery);
            }}
          >
            <label className="flex-1 text-sm font-medium">
              Patron ID or email
              <input
                aria-label="Patron ID or email"
                className="mt-1 w-full rounded border px-3 py-2"
                value={checkout.patronQuery}
                onChange={(e) => checkout.setPatronQuery(e.target.value)}
                disabled={checkout.patronLoading}
                placeholder="Enter patron id"
              />
            </label>
            <Button type="submit" disabled={checkout.patronLoading || !checkout.patronQuery.trim()}>
              {checkout.patronLoading ? 'Searching…' : 'Find patron'}
            </Button>
          </form>

          {checkout.patronError && (
            <div role="alert" className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {checkout.patronError}
            </div>
          )}

          {checkout.patron ? (
            <div className="space-y-2">
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Patron</dt>
                  <dd className="font-medium">{checkout.patron.name ?? checkout.patron.id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="capitalize">{checkout.patron.role}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="capitalize">{checkout.patron.status}</dd>
                </div>
              </dl>
              {checkout.dueDatePreview && !checkout.receipt && (
                <p className="text-sm">
                  Due date preview:{' '}
                  <span className="font-medium">{checkout.dueDatePreview}</span>
                  {checkout.policy ? ` (${checkout.policy.loanPeriodDays}-day loan)` : ''}
                </p>
              )}
            </div>
          ) : (
            !checkout.patronLoading && (
              <p role="status" className="text-sm text-muted-foreground">
                No patron selected. Search by patron ID to begin.
              </p>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Scan copy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeScanInput
            mode="checkout"
            isLoading={checkout.copyLoading}
            error={checkout.copyError}
            lastScanMessage={checkout.scanMessage}
            onScan={(barcode) => checkout.lookupCopy(barcode)}
            onManualLookup={(query) => {
              void checkout.lookupCopy(query);
            }}
          />

          {checkout.copy ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Title</dt>
                <dd className="font-medium">{checkout.copy.title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Author</dt>
                <dd>{checkout.copy.author}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Barcode</dt>
                <dd className="font-mono">{checkout.copy.barcode}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="capitalize">{checkout.copy.status.replace('-', ' ')}</dd>
              </div>
            </dl>
          ) : (
            !checkout.copyLoading && (
              <p role="status" className="text-sm text-muted-foreground">
                No copy selected yet. Scan a barcode to continue.
              </p>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Review &amp; confirm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {checkout.patron && checkout.copy ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded border p-3 text-sm">
                  <p className="font-medium">Patron</p>
                  <p>{checkout.patron.name ?? checkout.patron.id}</p>
                  <p className="capitalize text-muted-foreground">{checkout.patron.status}</p>
                </div>
                <div className="rounded border p-3 text-sm">
                  <p className="font-medium">Copy</p>
                  <p>{checkout.copy.title}</p>
                  <p className="font-mono text-muted-foreground">{checkout.copy.barcode}</p>
                </div>
              </div>

              {checkout.dueDatePreview && !checkout.receipt && (
                <p className="text-sm">
                  Due date preview:{' '}
                  <span className="font-medium">{checkout.dueDatePreview}</span>
                  {checkout.policy ? ` (${checkout.policy.loanPeriodDays}-day loan)` : ''}
                </p>
              )}

              {!checkout.receipt && checkout.warnings.length > 0 && (
                <div role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">Policy warnings</p>
                  <ul className="mt-1 list-disc pl-5">
                    {checkout.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {checkout.checkoutError && (
                <div role="alert" className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {checkout.checkoutError}
                </div>
              )}

              {!checkout.receipt && (
                <Button onClick={() => void checkout.confirmCheckout()} disabled={!checkout.canConfirm}>
                  {checkout.submitting ? 'Checking out…' : 'Confirm checkout'}
                </Button>
              )}
            </>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              Select a patron and a copy to review the checkout.
            </p>
          )}
        </CardContent>
      </Card>

      {checkout.receipt && (
        <Card role="status" aria-label="Checkout receipt">
          <CardHeader>
            <CardTitle>Checkout complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Loan reference: <span className="font-mono">{checkout.receipt.loanId}</span>
            </p>
            <p>
              Copy: <strong>{checkout.receipt.copyTitle}</strong> ({checkout.receipt.barcode})
            </p>
            <p>Patron: {checkout.receipt.patronName ?? checkout.receipt.patronId}</p>
            <p>
              Due date: <strong>{checkout.receipt.dueDate}</strong>
            </p>
            <Button variant="outline" onClick={checkout.reset}>
              Start new checkout
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
