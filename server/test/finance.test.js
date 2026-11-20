import { describe, expect, it } from 'vitest';
import {
  activationFee,
  employerInvoice,
  paymentPlan,
  computePayout,
  ledgerForActivation,
  ledgerForInvoiceCapture,
  ledgerForPayout,
  assertBalanced
} from '../src/domain/finance.js';
import { splitGst, toPaise, formatInr } from '../src/lib/money.js';

const settings = { activation_fee_paise: 69900, gst_rate_bps: 1800, platform_fee_bps: 0 };

describe('required ₹20,000 assignment example', () => {
  const plan = paymentPlan(20_000 * 100, 50);
  const fee = activationFee(settings);
  const advancePayout = computePayout({
    grossPaise: plan.advancePaise,
    activationFeePaise: fee.grossPaise
  });

  it('splits the ₹20,000 assignment into two ₹10,000 payments', () => {
    expect(plan.advancePaise).toBe(1_000_000);
    expect(plan.finalPaise).toBe(1_000_000);
    expect(plan.totalPaise).toBe(2_000_000);
    expect(plan.reconciles).toBe(true);
  });

  it('charges a GST-inclusive ₹699 activation fee exactly once', () => {
    expect(fee.grossPaise).toBe(69_900);
    expect(fee.basePaise).toBe(59_237);
    expect(fee.gstPaise).toBe(10_663);
    expect(fee.basePaise + fee.gstPaise).toBe(69_900);
  });

  it('pays ₹9,301 first and ₹10,000 on completion, totalling ₹19,301', () => {
    expect(advancePayout.netPaise).toBe(930_100);
    expect(formatInr(advancePayout.netPaise)).toBe('₹9,301.00');
    const finalPayout = computePayout({ grossPaise: plan.finalPaise, alreadyCharged: true });
    expect(finalPayout.netPaise).toBe(1_000_000);
    expect(advancePayout.netPaise + finalPayout.netPaise).toBe(1_930_100);
  });

  it('does not charge an activation fee twice', () => {
    const finalPayout = computePayout({
      grossPaise: 1_000_000,
      activationFeePaise: 69_900,
      alreadyCharged: true
    });
    expect(finalPayout.activationFeePaise).toBe(0);
    expect(finalPayout.netPaise).toBe(1_000_000);
  });
});

describe('GST and platform fees', () => {
  it('itemises GST only on the platform fee, never on professional charges', () => {
    const invoice = employerInvoice({
      professionalChargesPaise: 1_000_000,
      platformFeeBps: 500,
      gstRateBps: 1800
    });
    expect(invoice.platformFeePaise).toBe(50_000);
    expect(invoice.gstPaise).toBe(9_000);
    expect(invoice.totalPaise).toBe(1_059_000);
  });

  it('keeps the ₹20,000 example at 0% platform fee so it reconciles exactly', () => {
    const invoice = employerInvoice({
      professionalChargesPaise: 1_000_000,
      platformFeeBps: 0,
      gstRateBps: 1800
    });
    expect(invoice.gstPaise).toBe(0);
    expect(invoice.totalPaise).toBe(1_000_000);
  });

  it('splits inclusive GST without losing a paisa', () => {
    for (const gross of [1, 99, 69_900, 12_345_67]) {
      const { base, gst } = splitGst(gross, 1800);
      expect(base + gst).toBe(gross);
      expect(gst).toBeGreaterThanOrEqual(0);
    }
  });

  it('converts rupees without floating point drift', () => {
    expect(toPaise(1999.99)).toBe(199_999);
    expect(toPaise('0.1')).toBe(10);
  });
});

describe('payout safety and ledger integrity', () => {
  it('never produces a negative payout', () => {
    const payout = computePayout({ grossPaise: 50_000, activationFeePaise: 69_900 });
    expect(payout.netPaise).toBe(0);
  });

  it('withholds TDS only when applicable and rounds correctly', () => {
    const payout = computePayout({
      grossPaise: 1_000_000,
      tdsRateBps: 10,
      tdsApplicable: true
    });
    expect(payout.tdsPaise).toBe(1_000);
    expect(payout.netPaise).toBe(999_000);
  });

  it('rejects invalid payment plans', () => {
    expect(() => paymentPlan(0)).toThrow();
    expect(() => paymentPlan(1000, 100)).toThrow();
    expect(() => paymentPlan(1000, 0)).toThrow();
  });

  it('balances every ledger group it creates', () => {
    const fee = activationFee(settings);
    const invoice = employerInvoice({ professionalChargesPaise: 1_000_000 });
    const groups = [
      ledgerForInvoiceCapture({ invoice, groupId: 'g1' }),
      ledgerForActivation({ fee, groupId: 'g2' }),
      ledgerForPayout({ payout: { netPaise: 930_100, tdsPaise: 0 }, groupId: 'g3' })
    ];
    for (const group of groups) {
      expect(assertBalanced(group).balanced).toBe(true);
    }
  });
});
