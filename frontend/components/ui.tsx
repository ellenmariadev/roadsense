import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function LoadingPanel({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="panel loading-panel" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="notice notice-error" role="alert">
      {message}
    </div>
  );
}

export function SuccessNotice({ message }: { message: string }) {
  return (
    <div className="notice notice-success" role="status">
      {message}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel empty-state">
      <div className="empty-icon" aria-hidden="true">
        ◌
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

export function AccessDenied({
  title = 'Acesso restrito',
  description = 'Seu perfil não tem permissão para esta operação.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={
        <Link className="button button-secondary" href="/incidents">
          Voltar para incidentes
        </Link>
      }
    />
  );
}

export function SignInRequired() {
  return (
    <EmptyState
      title="Entre para continuar"
      description="A API do RoadSense exige autenticação para consultar incidentes e triagens."
      action={
        <Link className="button button-primary" href="/login">
          Entrar
        </Link>
      }
    />
  );
}
