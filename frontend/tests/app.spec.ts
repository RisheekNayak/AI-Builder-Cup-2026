import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { TEST_API } from '../playwright.config';

const company = {
  name: 'Precision Auto Exports Pvt Ltd', iec_code: '0512345678', gstin: '27AABCP1234C1ZP',
  pan: 'AABCP1234C', ad_code: '01234567890123', factory_address: 'Plot 42, Chakan, Pune', state_code: '27',
  port_of_loading: 'INNSA1', authorized_signatory: 'Rajesh Kumar', signatory_designation: 'Director',
};
// Match SHIPSURE_TODAY in the isolated backend so date validation is deterministic.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T12:00:00Z'));
});

const SAMPLE_PO = path.resolve(__dirname, '../../test-data/pos/PO-Chakan-CCPL-2026-748.pdf');

/** The company profile is mocked per test; every other API call goes to the isolated test backend on :8100. */
async function useTestBackend(page: Page, profile: typeof company | null = company) {
  const state = { profile, saveFailures: 0, getFailure: false, saved: null as unknown };
  const reset = await page.request.post(`${TEST_API}/api/demo/reset`, { headers: { 'X-Demo-Reset-Token': 'isolated-e2e-only' } });
  expect(reset.ok()).toBeTruthy();
  // NEXT_PUBLIC_API_URL is baked into the build. Intercept every API host so a
  // configured build still uses these mocks and the isolated backend only.
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/company/') {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      const fulfill = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
      if (request.method() === 'OPTIONS') return fulfill({});
      if (request.method() === 'POST') {
        if (state.saveFailures-- > 0) return fulfill({ detail: 'Profile save failed. Please try again.' }, 503);
        state.saved = request.postDataJSON(); state.profile = state.saved as typeof company; return fulfill({ status: 'saved' });
      }
      return fulfill(state.profile, state.getFailure ? 503 : 200);
    }
    return route.continue({ url: `${TEST_API}${url.pathname}${url.search}` });
  });
  return state;
}

async function ask(page: Page, text: string) {
  await page.getByLabel('Message ShipSure').fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
}

test('onboarding validates, keeps entries when saving fails, then opens the workspace', async ({ page }) => {
  const state = await useTestBackend(page, null);
  state.saveFailures = 1;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Start with your company details.' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Company name is required.')).toBeVisible();
  await page.getByLabel('Company name', { exact: true }).fill(company.name);
  await page.getByLabel('Factory / registered address').fill(company.factory_address);
  await page.getByLabel('State code').fill(company.state_code);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('IEC code').fill(company.iec_code);
  await page.getByLabel('GSTIN').fill(company.gstin);
  await page.getByLabel('PAN', { exact: true }).fill('bad');
  await page.getByLabel('AD code').fill(company.ad_code);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Use the format ABCDE1234F.')).toBeVisible();
  await page.getByLabel('PAN', { exact: true }).fill(company.pan.toLowerCase());
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Port of loading').fill(company.port_of_loading.toLowerCase());
  await page.getByLabel('Authorized signatory', { exact: true }).fill(company.authorized_signatory);
  await page.getByLabel('Signatory designation').fill(company.signatory_designation);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Save & open workspace' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Profile save failed' })).toBeVisible();
  await page.getByRole('button', { name: 'Save & open workspace' }).click();
  await expect(page.getByText('Needs attention today')).toBeVisible();
  expect(state.saved).toMatchObject({ pan: company.pan, port_of_loading: company.port_of_loading });
});

test('home shows the Today inbox, and chat answers from records and opens Receivables', async ({ page }) => {
  await useTestBackend(page);
  await page.goto('/');
  await expect(page.getByText('Western Motors Ltd: ₹4,46,040 unpaid past 45 days')).toBeVisible();
  await ask(page, 'Who owes me past 45 days?');
  await expect(page.getByText('₹10,54,340').first()).toBeVisible();
  const panel = page.getByRole('complementary', { name: 'Workspace panel' });
  await expect(panel.getByRole('heading', { name: 'Who owes you money' })).toBeVisible();
  await expect(panel.getByText('₹10.5 L')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Who owes me past 45 days?', { exact: true })).toBeVisible();
});

test('Hinglish order question opens the order, and recording the dispatch updates it', async ({ page }) => {
  await useTestBackend(page);
  await page.goto('/');
  await ask(page, 'WML-88213 ka maal gaya kya?');
  await expect(page.getByText('900 of 1,500 pcs bhej diye, 600 pcs baaki.')).toBeVisible();
  const panel = page.getByRole('complementary', { name: 'Workspace panel' });
  await expect(panel.getByText('Late', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Dispatch all 600' }).click();
  await panel.getByRole('button', { name: 'Record dispatch' }).click();
  await expect(page.getByText(/Dispatch recorded for PO WML-88213: 600 pcs\. Invoice SPC\/.+ created/)).toBeVisible();
  await expect(panel.locator('span').filter({ hasText: /^Dispatched$/ })).toBeVisible();
});

test('a payment proposed in chat is saved only after confirming', async ({ page }) => {
  await useTestBackend(page);
  await page.goto('/');
  await ask(page, 'Received ₹1 lakh from Chakan');
  await expect(page.getByText('Record ₹1,00,000 received from Chakan Chassis Pvt Ltd')).toBeVisible();
  const before = await (await page.request.get(`${TEST_API}/api/receivables/summary`)).json();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText(/Recorded ₹1,00,000 from Chakan Chassis Pvt Ltd/)).toBeVisible();
  const after = await (await page.request.get(`${TEST_API}/api/receivables/summary`)).json();
  expect(before.total_outstanding - after.total_outstanding).toBeCloseTo(100000);
});

test('customer statement drafts a Hinglish reminder and records a payment', async ({ page }) => {
  await useTestBackend(page);
  await page.goto('/receivables');
  await page.getByRole('button', { name: 'Western Motors Ltd' }).click();
  await expect(page.getByRole('heading', { name: 'Western Motors Ltd' })).toBeVisible();
  await page.getByRole('button', { name: 'Draft in Hinglish' }).click();
  await expect(page.getByText(/aapki taraf se pending hai/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in WhatsApp' })).toHaveAttribute('href', /wa\.me\/919850088213/);
  await page.getByLabel('Amount (₹)').fill('446040');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByText('Past 45 days').locator('..').getByText('₹0')).toBeVisible();
});

test('a customer PO PDF becomes a reviewed order', async ({ page }) => {
  await useTestBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a document' }).click();
  await page.getByRole('menuitem', { name: 'Customer PO' }).click();
  await page.getByLabel('Purchase order file').setInputFiles(SAMPLE_PO);
  await expect(page.getByText('Read by text rules (AI offline)')).toBeVisible();
  await expect(page.getByLabel('PO number')).toHaveValue('CCPL/2026/748');
  await page.getByRole('button', { name: 'Add to order book' }).click();
  await expect(page.getByRole('heading', { name: 'PO CCPL/2026/748' })).toBeVisible();
  await expect(page.getByText(/added to the order book: 1,000 pcs worth ₹2,93,000/)).toBeVisible();
});

test('stock and GST previews are labelled and show sample risks', async ({ page }) => {
  await useTestBackend(page);
  await page.goto('/stock');
  await expect(page.getByText('STR-330 · Steering column bracket')).toBeVisible();
  await expect(page.getByText('Short for open orders')).toBeVisible();
  await page.goto('/gst');
  await expect(page.getByText('E-invoice 30-day limit')).toBeVisible();
  await expect(page.getByText(/Past 1 year by/)).toBeVisible();
  await expect(page.getByText('Preview', { exact: true }).first()).toBeVisible();
});

test('export sample is checked honestly and documents can be drafted', async ({ page }) => {
  await useTestBackend(page);
  await page.goto('/shipments/new');
  await page.getByRole('button', { name: 'UAE buyer (FTA)' }).click();
  await expect(page.getByText('Rules-only check', { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('FTA available: India-UAE CEPA')).toBeVisible();
  await page.getByRole('button', { name: 'Generate documents' }).click();
  await expect(page.getByRole('link', { name: 'Download Certificate of Origin' })).toBeVisible();
});

test('an unreadable invoice shows an error instead of sample data', async ({ page }) => {
  await useTestBackend(page);
  await page.goto('/shipments/new');
  await page.locator('input[type=file]').setInputFiles({ name: 'scomet-invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 not an invoice') });
  await page.getByRole('button', { name: 'Analyze Invoice' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'AI extraction is unavailable' })).toBeVisible();
});

test('mobile switches between chat and panels without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useTestBackend(page);
  await page.goto('/');
  await ask(page, 'Which orders are late?');
  await expect(page.getByRole('heading', { name: 'Customer orders' })).toBeVisible();
  await page.getByRole('button', { name: 'Conversation', exact: true }).click();
  await expect(page.getByText(/1 late order/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
