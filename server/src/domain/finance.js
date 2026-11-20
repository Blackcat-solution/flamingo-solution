/**
 * Financial engine. All amounts are integer paise.
 * The engine is intentionally pure so it can be unit tested and reused by
 * invoices, payouts, admin reconciliation and reporting.
 */

import { splitGst, addGst } from '../lib/money.js';

export function activationFee(settings, overridePaise) {
  const gross = overridePaise ?? settings.activation_fee_paise;
  const { base, gst } = splitGst(gross, settings.gst_rate_bps);
  return {
    grossPaise: gross,
    basePaise: base,
    gstPaise: gst,
    gstRateBps: settings.gst_rate_bps,
    note: 'Activation fee is GST-inclusive and deducted once per assignment from the first professional payout.'
  };
}

export function employerInvoice({
  professionalChargesPaise,
  platformFeeBps = 0,
  gstRateBps = 1800,
  otherChargesPaise = 0
}) {
  const platformFeePaise = Math.round((professionalChargesPaise * platformFeeBps) / 10_000);
  const gstPaise = Math.round((platformFeePaise * gstRateBps) / 10_000);
  const totalPaise = professionalChargesPaise + platformFeePaise + gstPaise + otherChargesPaise;
  return {
    professionalChargesPaise,
    platformFeePaise,
    platformFeeBps,
    gstPaise,
    gstRateBps,
    otherChargesPaise,
    totalPaise,
    lines: [
      { label: 'Professional assignment charges', amountPaise: professionalChargesPaise },
      {
        label: `FLAMINGO platform fee (${(platformFeeBps / 100).toFixed(2)}%)`,
        amountPaise: platformFeePaise
      },
      { label: `GST @ ${(gstRateBps / 100).toFixed(0)}% on platform fee`, amountPaise: gstPaise },
      ...(otherChargesPaise
        ? [{ label: 'Other disclosed charges', amountPaise: otherChargesPaise }]
        : [])
    ]
  };
}

export function paymentPlan(totalValuePaise, advancePercent = 50) {
  if (!Number.isInteger(totalValuePaise) || totalValuePaise <= 0) {
    throw new Error('Assignment value must be a positive integer amount in paise');
  }
  if (!(advancePercent > 0 && advancePercent < 100)) {
    throw new Error('Advance percentage must be between 0 and 100');
  }
  const advancePaise = Math.round((totalValuePaise * advancePercent) / 100);
  const finalPaise = totalValuePaise - advancePaise;
  return {
    advancePaise,
    finalPaise,
    advancePercent,
    totalPaise: totalValuePaise,
    reconciles: advancePaise + finalPaise === totalValuePaise
  };
}

/**
 * Professional payout calculation.
 * 194-O TDS is modelled but only applied when the professional's cumulative
 * platform earnings cross the statutory threshold and a PAN is on record.
 */
export function computePayout({
  grossPaise,
  activationFeePaise = 0,
  alreadyCharged = false,
  tdsRateBps = 10,
  tdsApplicable = false
}) {
  const deduction = alreadyCharged ? 0 : activationFeePaise;
  const tdsPaise = tdsApplicable
    ? Math.round((grossPaise * tdsRateBps) / 10_000)
    : 0;
  const netPaise = Math.max(0, grossPaise - deduction - tdsPaise);
  return {
    grossPaise,
    activationFeePaise: deduction,
    tdsPaise,
    netPaise,
    activationCharged: deduction > 0
  };
}

export function gstOnPlatformFee(platformFeePaise, gstRateBps) {
  return addGst(platformFeePaise, gstRateBps);
}

/**
 * Build balanced double-entry ledger lines for an employer payment capture.
 * Accounts: cash_gateway, professional_payable, platform_revenue, gst_payable.
 */
export function ledgerForInvoiceCapture({ invoice, groupId, description }) {
  const lines = [
    {
      account: 'cash_gateway',
      direction: 'debit',
      amountPaise: invoice.totalPaise,
      description: description || 'Employer payment captured'
    },
    {
      account: 'professional_payable',
      direction: 'credit',
      amountPaise: invoice.professionalChargesPaise,
      description: 'Liability to professional'
    }
  ];
  if (invoice.platformFeePaise > 0) {
    lines.push({
      account: 'platform_revenue',
      direction: 'credit',
      amountPaise: invoice.platformFeePaise,
      description: 'Employer platform fee'
    });
  }
  if (invoice.gstPaise > 0) {
    lines.push({
      account: 'gst_payable',
      direction: 'credit',
      amountPaise: invoice.gstPaise,
      description: 'GST collected on platform fee'
    });
  }
  if (invoice.otherChargesPaise > 0) {
    lines.push({
      account: 'other_revenue',
      direction: 'credit',
      amountPaise: invoice.otherChargesPaise,
      description: 'Other disclosed charges'
    });
  }
  return lines.map((line) => ({ ...line, groupId }));
}

export function ledgerForActivation({ fee, groupId, description }) {
  return [
    {
      groupId,
      account: 'professional_payable',
      direction: 'debit',
      amountPaise: fee.grossPaise,
      description: description || 'Candidate activation fee deducted from first payout'
    },
    {
      groupId,
      account: 'activation_revenue',
      direction: 'credit',
      amountPaise: fee.basePaise,
      description: 'Activation fee revenue'
    },
    {
      groupId,
      account: 'gst_payable',
      direction: 'credit',
      amountPaise: fee.gstPaise,
      description: 'GST on activation fee'
    }
  ];
}

export function ledgerForPayout({ payout, groupId }) {
  const lines = [];
  if (payout.tdsPaise > 0) {
    lines.push({
      groupId,
      account: 'professional_payable',
      direction: 'debit',
      amountPaise: payout.tdsPaise,
      description: 'TDS u/s 194-O withheld'
    });
    lines.push({
      groupId,
      account: 'tds_payable',
      direction: 'credit',
      amountPaise: payout.tdsPaise,
      description: 'TDS payable to government'
    });
  }
  lines.push({
    groupId,
    account: 'professional_payable',
    direction: 'debit',
    amountPaise: payout.netPaise,
    description: 'Professional payout settled'
  });
  lines.push({
    groupId,
    account: 'professional_settled',
    direction: 'credit',
    amountPaise: payout.netPaise,
    description: 'Cash settled to professional'
  });
  return lines;
}

export function assertBalanced(entries) {
  const debit = entries
    .filter((entry) => entry.direction === 'debit')
    .reduce((sum, entry) => sum + entry.amountPaise, 0);
  const credit = entries
    .filter((entry) => entry.direction === 'credit')
    .reduce((sum, entry) => sum + entry.amountPaise, 0);
  return { debit, credit, balanced: debit === credit };
}
