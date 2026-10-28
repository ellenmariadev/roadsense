import Link from 'next/link';
import { EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <EmptyState
      title="Página não encontrada"
      description="O endereço acessado não existe nesta aplicação."
      action={
        <Link className="button button-primary" href="/incidents">
          Ir para incidentes
        </Link>
      }
    />
  );
}
