import { expect, test, type Page } from '@playwright/test';

const company = {
  name: 'Precision Auto Exports Pvt Ltd', iec_code: '0512345678', gstin: '27AABCP1234C1ZP',
  pan: 'AABCP1234C', ad_code: '01234567890123', factory_address: 'Plot 42, Chakan, Pune', state_code: '27',
  port_of_loading: 'INNSA1', authorized_signatory: 'Rajesh Kumar', signatory_designation: 'Director',
};
const shipment = {
  id: 'shipment-1042', filename: 'export-invoice.json', status: 'complete', created_at: '2026-10-10T09:00:00Z',
  extracted_data: { invoice_number: 'INV-1042', invoice_date: '2026-10-09', seller_name: company.name, seller_country: 'IN', buyer_name: 'Dubai Motors LLC', buyer_country: 'AE', port_of_loading: 'INNSA1', port_of_discharge: 'AEDXB', currency: 'USD', total_value: 20500, line_items: [{ description: 'Brake pads', hs_code: '87083000', quantity: 500, unit_price: 41, total_value: 20500 }] },
  risk_report: { overall_score: 'low', flags: [], required_forms: ['Shipping Bill'], analysis_summary: 'Review origin evidence before claiming preferential treatment.', duty_savings: null },
};

async function mockApi(page: Page, profile: typeof company | null = company) {
  const state = { profile, getFailure: false, saveFailures: 0, historyFailure: false, records: [shipment], generated: false, saved: null as unknown };
  await page.route('http://localhost:8000/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return fulfill({});
    if (path === '/api/company/') {
      if (request.method() === 'POST') {
        if (state.saveFailures-- > 0) return fulfill({ detail: 'Profile save failed. Please try again.' }, 503);
        state.saved = request.postDataJSON(); state.profile = state.saved as typeof company; return fulfill({ status: 'saved' });
      }
      return fulfill(state.profile, state.getFailure ? 503 : 200);
    }
    if (path === '/api/upload/shipments') return fulfill({ shipments: state.records }, state.historyFailure ? 503 : 200);
    if (path.startsWith('/api/upload/shipments/')) return fulfill(shipment);
    if (path === '/api/upload/') return fulfill({ shipment_id: shipment.id, status: 'complete' });
    if (path.startsWith('/api/extraction/')) return fulfill({ extracted_data: shipment.extracted_data });
    if (path.endsWith('/risk-report')) return fulfill({ status: 'complete', risk_report: shipment.risk_report });
    if (path.endsWith('/generate')) { state.generated = true; return fulfill({ status: 'Forms generated successfully' }); }
    if (path.endsWith('/download')) return route.fulfill({ headers, contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' });
    if (path.endsWith('/forms')) return fulfill({ forms: [{ id: 'shipping_bill', name: 'Shipping Bill' }] });
    if (path === '/api/advisor/chat') return fulfill({ reply: 'Review the applicable origin requirements and keep supporting evidence.', sources: ['https://www.dgft.gov.in/'] });
    return fulfill({ detail: 'Unexpected test endpoint' }, 404);
  });
  return state;
}

test('onboarding validates, retains entries on save failure, and skips on return', async ({ page }) => {
  const state = await mockApi(page, null); state.saveFailures = 1;
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
  await expect(page.getByRole('heading', { name: 'Review your company profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Save & open workspace' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Profile save failed' })).toBeVisible();
  await expect(page.getByText(company.name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save & open workspace' }).click();
  await expect(page.getByRole('heading', { name: 'What would you like to work on?' })).toBeVisible();
  expect(state.saved).toMatchObject({ pan: company.pan, port_of_loading: company.port_of_loading });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What would you like to work on?' })).toBeVisible();
});

test('profile load failure stays recoverable and incomplete profiles require setup', async ({ page }) => {
  const state = await mockApi(page, { ...company, signatory_designation: '' }); state.getFailure = true;
  await page.goto('/shipments');
  await expect(page.getByRole('alert').filter({ hasText: 'Failed to fetch company profile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Company details', exact: true })).not.toBeVisible();
  state.getFailure = false; await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Company details', exact: true })).toBeVisible();
  await expect(page.getByLabel('Company name', { exact: true })).toHaveValue(company.name);
});

test('chat opens shipment views and preserves conversation across routes', async ({ page }) => {
  await mockApi(page); await page.goto('/');
  await page.getByRole('button', { name: 'Open my latest shipment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shipment: INV-1042' })).toBeVisible();
  await expect(page.getByText(/Compliance risk: low/)).toBeVisible();
  await page.getByLabel('Message ShipSure').fill('Show shipment history');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('complementary', { name: 'Shipment workspace panel' }).getByRole('heading', { name: 'Shipment History' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'INV-1042' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Company name', { exact: true }).fill('Updated Precision Exports');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();
  await page.getByRole('link', { name: 'Trade Advisor', exact: true }).click();
  await expect(page.getByText('Show shipment history', { exact: true })).toBeVisible();
  await page.getByLabel('Message ShipSure').fill('What are the CEPA origin requirements?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('link', { name: 'https://www.dgft.gov.in/' })).toBeVisible();
  await page.getByRole('link', { name: 'New Shipment', exact: true }).click();
  await expect(page).toHaveURL('/shipments/new');
  await expect(page.getByRole('button', { name: 'Analyze Invoice' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/advisor');
  await expect(page.getByText('What are the CEPA origin requirements?', { exact: true })).toBeVisible();
});

test('invoice upload opens details and generates downloadable forms', async ({ page }) => {
  const state = await mockApi(page); await page.goto('/');
  await page.getByRole('button', { name: 'Create a new shipment', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'invoice.json', mimeType: 'application/json', buffer: Buffer.from('{"invoice_number":"INV-1042"}') });
  await page.getByRole('button', { name: 'Analyze Invoice' }).click();
  await expect(page.getByRole('heading', { name: 'Shipment: INV-1042' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download Shipping Bill' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Generate Forms', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Regenerate Forms' })).toBeVisible();
  expect(state.generated).toBe(true);
  const download = page.getByRole('link', { name: 'Download Shipping Bill' });
  await expect(download).toHaveAttribute('href', /shipping_bill\/download$/);
});

test('empty history and failed requests are distinct and retryable', async ({ page }) => {
  const state = await mockApi(page); state.historyFailure = true; state.records = [];
  await page.goto('/'); await page.getByRole('button', { name: 'Show shipment history', exact: true }).click();
  await expect(page.getByText('Failed to fetch shipments', { exact: true })).toBeVisible();
  state.historyFailure = false; await page.getByRole('button', { name: 'Retry request' }).click();
  await expect(page.getByText('You have no recorded shipments yet. Start with New Shipment and upload an invoice.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your first shipment starts here' })).toBeVisible();
});

test('mobile switches between chat and details without losing either', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockApi(page); await page.goto('/');
  await page.getByRole('button', { name: 'Open my latest shipment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shipment: INV-1042' })).toBeVisible();
  await page.getByRole('button', { name: 'Conversation', exact: true }).click();
  await expect(page.getByLabel('Message ShipSure')).toBeVisible();
  await expect(page.getByText(/Compliance risk: low/)).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Shipment History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shipment History', exact: true, level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
