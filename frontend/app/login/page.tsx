import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/incidents';

  return (
    <div className="auth-layout">
      <section className="auth-copy">
        <p className="eyebrow">Acesso local</p>
        <h1>Operação rodoviária com decisão humana.</h1>
        <p>
          Consulte incidentes, execute a triagem assistida e confirme apenas as sugestões revisadas.
          O backend mantém a autoridade sobre prioridade, permissões e transições de estado.
        </p>
        <ul className="feature-list">
          <li>Registro manual de ocorrências</li>
          <li>Extração estruturada com provedor mock local</li>
          <li>Histórico auditável de cada decisão</li>
        </ul>
      </section>
      <LoginForm nextPath={nextPath} />
    </div>
  );
}
