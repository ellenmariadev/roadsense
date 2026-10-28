'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthGate } from '@/components/auth-gate';
import { PriorityBadge, StatusBadge } from '@/components/badges';
import { EmptyState, ErrorNotice, LoadingPanel, PageHeader } from '@/components/ui';
import { getApiErrorMessage, listIncidents } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  PRIORITY_LABELS,
  formatDateTime,
  incidentLocation,
  incidentTypeLabel,
} from '@/lib/format';
import type {
  IncidentListResponse,
  IncidentStatus,
  IncidentType,
  Priority,
} from '@/lib/types';

const PAGE_SIZE = 10;

interface FilterValues {
  q: string;
  roadName: string;
  status: IncidentStatus | '';
  priority: Priority | '';
  incidentType: IncidentType | '';
}

const EMPTY_FILTERS: FilterValues = {
  q: '',
  roadName: '',
  status: '',
  priority: '',
  incidentType: '',
};

export default function IncidentsPage() {
  return (
    <AuthGate>
      <IncidentList />
    </AuthGate>
  );
}

function IncidentList() {
  const { isOperator } = useAuth();
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<IncidentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { register, handleSubmit, reset } = useForm<FilterValues>({
    defaultValues: EMPTY_FILTERS,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    listIncidents({ ...filters, page, limit: PAGE_SIZE })
      .then((response) => {
        if (active) setResult(response);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getApiErrorMessage(requestError, 'Não foi possível carregar os incidentes.'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, page]);

  const applyFilters = handleSubmit((values) => {
    setPage(1);
    setFilters({
      q: values.q.trim(),
      roadName: values.roadName.trim(),
      status: values.status,
      priority: values.priority,
      incidentType: values.incidentType,
    });
  });

  const clearFilters = () => {
    reset(EMPTY_FILTERS);
    setPage(1);
    setFilters(EMPTY_FILTERS);
  };

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = result?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Incidentes rodoviários"
        description="Acompanhe relatos, prioridade operacional e o resultado da triagem assistida."
        actions={
          isOperator ? (
            <Link className="button button-primary" href="/incidents/new">
              + Novo relato
            </Link>
          ) : null
        }
      />

      <form className="panel filter-panel" onSubmit={applyFilters}>
        <div className="filter-grid">
          <div className="field field-wide">
            <label htmlFor="q">Busca livre</label>
            <input id="q" placeholder="Relato, descrição, local ou rodovia" {...register('q')} />
          </div>
          <div className="field">
            <label htmlFor="roadName">Rodovia</label>
            <input id="roadName" placeholder="Ex.: BR-116" {...register('roadName')} />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" {...register('status')}>
              <option value="">Todos</option>
              {Object.entries(INCIDENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="priority">Prioridade</label>
            <select id="priority" {...register('priority')}>
              <option value="">Todas</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="incidentType">Tipo</label>
            <select id="incidentType" {...register('incidentType')}>
              <option value="">Todos</option>
              {Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <button className="button button-primary button-small" type="submit" disabled={loading}>
            Filtrar
          </button>
          <button className="button button-secondary button-small" type="button" onClick={clearFilters}>
            Limpar
          </button>
          <span className="muted filter-summary">
            {loading ? 'Atualizando…' : `${total} incidente${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}`}
          </span>
        </div>
      </form>

      {error ? <ErrorNotice message={error} /> : null}

      {loading && !result ? (
        <LoadingPanel label="Carregando incidentes…" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum incidente encontrado"
          description="Ajuste os filtros ou registre um novo relato para iniciar a operação."
          action={
            isOperator ? (
              <Link className="button button-primary" href="/incidents/new">
                Registrar incidente
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className={loading ? 'panel table-panel table-loading' : 'panel table-panel'} aria-busy={loading}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Incidente</th>
                  <th>Relato</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th>Reportado em</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {items.map((incident) => (
                  <tr key={incident.id}>
                    <td>
                      <div className="table-primary">{incidentTypeLabel(incident.incidentType)}</div>
                      <div className="table-secondary">{incidentLocation(incident)}</div>
                    </td>
                    <td>
                      <p className="report-preview">{incident.originalReport}</p>
                    </td>
                    <td>
                      <PriorityBadge priority={incident.priority} />
                    </td>
                    <td>
                      <StatusBadge status={incident.status} />
                    </td>
                    <td className="nowrap">{formatDateTime(incident.reportedAt)}</td>
                    <td className="align-right">
                      <Link className="text-link" href={`/incidents/${incident.id}`}>
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span className="muted">
              Página {page} de {totalPages}
            </span>
            <div className="pagination-buttons">
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
              >
                Anterior
              </button>
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
