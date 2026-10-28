import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { E2E_USERS } from './test-users';

async function loginAs(page: Page, role: keyof typeof E2E_USERS) {
  const user = E2E_USERS[role];
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/incidents$/);
  await expect(page.getByRole('heading', { name: 'Incidentes rodoviários' })).toBeVisible();
}

test('operator registers an incident, runs triage and confirms the suggestion', async ({
  page,
}) => {
  const marker = `E2E-${Date.now()}`;
  await loginAs(page, 'operator');

  await page.getByRole('link', { name: 'Novo relato', exact: true }).click();
  await expect(page).toHaveURL(/\/incidents\/new$/);

  await page
    .getByLabel(/Relato original/)
    .fill(
      `Colisão entre dois veículos na BR-040, km 100, sentido norte. Marcador ${marker}. Há vítimas e vazamento de combustível.`,
    );
  await page.getByLabel('Tipo de incidente').selectOption('ACCIDENT');
  await page.getByLabel('Rodovia').fill('BR-040');
  await page.getByLabel('Marco quilométrico').fill('100');
  await page.getByLabel('Sentido').fill('norte');
  await page.getByLabel('Fatores de risco').fill('vítimas, vazamento de combustível');
  await page.getByRole('button', { name: 'Registrar incidente' }).click();

  await expect(page).toHaveURL(/\/incidents\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: /Acidente em BR-040 · km 100/ })).toBeVisible();
  await expect(page.getByText('Reportado', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Executar triagem' }).click();
  await expect(
    page.getByText('Triagem executada. Revise a sugestão antes de confirmar.'),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Sugestão gerada', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Acidente', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('90%', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Revisar e confirmar sugestão' }).click();
  await expect(page.getByText(/Confirmar aplica os campos sugeridos/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar agora' }).click();

  await expect(
    page.getByText(
      'Sugestão confirmada pelo backend. O incidente e a prioridade foram atualizados.',
    ),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Confirmado', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Sugestão confirmada', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Confirmado', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Confirmada', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Sugestão confirmada', { exact: true })).toBeVisible();
});

test('operator rejects a suggestion and advances the incident status', async ({ page }) => {
  const marker = `E2E-STATUS-${Date.now()}`;
  await loginAs(page, 'operator');

  await page.getByRole('link', { name: 'Novo relato', exact: true }).click();
  await page.getByLabel(/Relato original/).fill(`Pane seca na BR-050, km 10. ${marker}`);
  await page.getByRole('button', { name: 'Registrar incidente' }).click();
  await expect(page).toHaveURL(/\/incidents\/[0-9a-f-]+$/);

  await page.getByRole('button', { name: 'Executar triagem' }).click();
  await expect(
    page.getByText('Triagem executada. Revise a sugestão antes de confirmar.'),
  ).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Rejeitar sugestão' }).click();
  await page
    .getByLabel('Motivo da rejeição (opcional)')
    .fill('Sugestão não corresponde ao relato.');
  await page.getByRole('button', { name: 'Confirmar rejeição' }).click();

  await expect(page.getByText('Sugestão rejeitada. O incidente não foi alterado.')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('Rejeitada', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Reportado', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Sugestão rejeitada', { exact: true })).toBeVisible();

  await page.getByLabel('Próximo status').selectOption('UNDER_REVIEW');
  await page.getByLabel('Motivo (opcional)').fill('Enviado para análise.');
  await page.getByRole('button', { name: 'Aplicar transição' }).click();

  await expect(page.getByText('Em análise', { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.reload();
  await expect(page.getByText('Em análise', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Mudança de status', { exact: true })).toBeVisible();
});

test('lists, filters and opens incident details with audit history', async ({ page }) => {
  await loginAs(page, 'operator');

  await expect(page.getByRole('heading', { name: 'Incidentes rodoviários' })).toBeVisible();
  await page.getByLabel('Rodovia').fill('SP-330');
  await page.getByRole('button', { name: 'Filtrar' }).click();

  await expect(page.getByText('1 incidente encontrado')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Detalhes' })).toHaveCount(1);
  await page.getByRole('link', { name: 'Detalhes' }).click();

  await expect(
    page.getByRole('heading', { name: /Pane de veículo em SP-330 · km 87/ }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Histórico' })).toBeVisible();
  await expect(page.getByText('Incidente criado', { exact: true })).toBeVisible();
  await expect(page.getByText('Sugestão gerada', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('68%', { exact: true })).toBeVisible();
});

test('viewer can read triage results but cannot operate', async ({ page }) => {
  await loginAs(page, 'viewer');

  await page.goto('/incidents/new');
  await expect(page.getByText('Acesso restrito')).toBeVisible();

  await page.goto('/incidents/00000000-0000-4000-8000-000000000101');
  await expect(page.getByRole('heading', { name: /Acidente em BR-116 · km 245/ })).toBeVisible();
  await expect(
    page.getByText(/Perfil Visualizador: é possível consultar as sugestões/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Executar triagem' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revisar e confirmar sugestão' })).toHaveCount(0);

  await page.goto('/register');
  await expect(page.getByText('Acesso restrito')).toBeVisible();
});

test('invalid login shows a safe error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(E2E_USERS.operator.email);
  await page.getByLabel('Senha').fill('wrong-password');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.locator('.notice-error')).toContainText(
    'Credenciais inválidas ou sessão expirada.',
  );
  await expect(page).toHaveURL(/\/login/);
});

test('admin creates a new user who can sign in', async ({ page }) => {
  const email = `e2e-created-${Date.now()}@roadsense.local`;
  const password = 'E2E-created-password-123';

  await loginAs(page, 'admin');
  await page.getByRole('link', { name: 'Usuários' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Criar usuário' })).toBeVisible();

  await page.getByLabel('Nome').fill('Usuário E2E');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha inicial').fill(password);
  await page.getByLabel('Perfil').selectOption('VIEWER');
  await page.getByRole('button', { name: 'Criar usuário' }).click();

  await expect(page.getByText(`Usuário ${email} criado com o perfil VIEWER.`)).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/incidents$/);
  await expect(page.getByRole('heading', { name: 'Incidentes rodoviários' })).toBeVisible();
  await expect(page.getByText('Usuário E2E', { exact: true })).toBeVisible();
});
