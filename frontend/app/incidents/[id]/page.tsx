'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthGate } from '@/components/auth-gate';
import {
  IncidentTypeBadge,
  PriorityBadge,
  StatusBadge,
  TriageStatusBadge,
} from '@/components/badges';
import {
  EmptyState,
  ErrorNotice,
  FieldError,
  LoadingPanel,
  PageHeader,
  SuccessNotice,
} from '@/components/ui';
import {
  confirmTriage,
  getApiErrorMessage,
  getAvailableTransitions,
  getIncident,
  getIncidentEvents,
  getTriageRuns,
  rejectTriage,
  runTriage,
  transitionIncident,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  eventLabel,
  formatConfidence,
  formatDateTime,
  formatLatency,
  formatTokens,
  incidentLocation,
  incidentTypeLabel,
  roleLabel,
  statusLabel,
} from '@/lib/format';
import { TriageFormDto } from '@/lib/form-dtos';
import type { Incident, IncidentEvent, IncidentStatus, TriageRun } from '@/lib/types';
import { validateDto } from '@/lib/validation';

export default function IncidentDetailPage() {
  return (
    <AuthGate>
      <IncidentDetail />
    </AuthGate>
  );
}

function IncidentDetail() {
  const params = useParams<{ id: string }>();
  const incidentId = params.id;
  const { user, isOperator } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [runs, setRuns] = useState<TriageRun[]>([]);
  const [allowedTransitions, setAllowedTransitions] = useState<IncidentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedIncident, loadedEvents, loadedRuns, loadedTransitions] = await Promise.all([
        getIncident(incidentId),
        getIncidentEvents(incidentId),
        getTriageRuns(incidentId),
        getAvailableTransitions(incidentId),
      ]);
      setIncident(loadedIncident);
      setEvents(loadedEvents);
      setRuns(loadedRuns);
      setAllowedTransitions(loadedTransitions.allowed);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Não foi possível carregar o incidente.'));
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refreshRelated = useCallback(async () => {
    try {
      const [loadedEvents, loadedRuns] = await Promise.all([
        getIncidentEvents(incidentId),
        getTriageRuns(incidentId),
      ]);
      setEvents(loadedEvents);
      setRuns(loadedRuns);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Não foi possível atualizar o histórico.'));
    }
  }, [incidentId]);

  const handleIncidentChanged = async (updatedIncident: Incident) => {
    setIncident(updatedIncident);
    const [loadedTransitions] = await Promise.all([
      getAvailableTransitions(incidentId),
      refreshRelated(),
    ]);
    setAllowedTransitions(loadedTransitions.allowed);
  };

  if (loading && !incident) {
    return <LoadingPanel label="Carregando incidente…" />;
  }

  if (!incident) {
    return (
      <>
        <ErrorNotice message={error || 'Incidente não encontrado.'} />
        <EmptyState
          title="Incidente indisponível"
          description="O registro pode ter sido removido ou o identificador é inválido."
          action={
            <Link className="button button-primary" href="/incidents">
              Voltar para incidentes
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/incidents">Incidentes</Link>
        <span aria-hidden="true">/</span>
        <span>{incident.id.slice(0, 8)}</span>
      </div>

      <PageHeader
        eyebrow="Detalhes do incidente"
        title={`${incidentTypeLabel(incident.incidentType)} em ${incidentLocation(incident)}`}
        description={`Reportado em ${formatDateTime(incident.reportedAt)} · atualizado em ${formatDateTime(incident.updatedAt)}`}
        actions={
          <>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void loadAll()}
            >
              Atualizar
            </button>
            <Link className="button button-ghost" href="/incidents">
              Voltar
            </Link>
          </>
        }
      />

      {error ? <ErrorNotice message={error} /> : null}

      <section className="detail-grid">
        <div className="stack">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Relato original</p>
                <h2>O que foi informado</h2>
              </div>
              <div className="badge-row">
                <PriorityBadge priority={incident.priority} />
                <StatusBadge status={incident.status} />
              </div>
            </div>

            <blockquote className="report-block">{incident.originalReport}</blockquote>

            <dl className="detail-list detail-list-grid">
              <DetailField label="Tipo">
                <IncidentTypeBadge type={incident.incidentType} />
              </DetailField>
              <DetailField label="Rodovia">{incident.roadName ?? '—'}</DetailField>
              <DetailField label="Marco">{incident.kilometerMarker ?? '—'}</DetailField>
              <DetailField label="Sentido">{incident.direction ?? '—'}</DetailField>
              <DetailField label="Localização">{incident.locationText ?? '—'}</DetailField>
              <DetailField label="Registrado por">{incident.createdById ?? 'Sistema'}</DetailField>
            </dl>

            {incident.description ? (
              <div className="detail-section">
                <h3>Descrição operacional</h3>
                <p>{incident.description}</p>
              </div>
            ) : null}

            {incident.riskFactors.length > 0 ? (
              <div className="detail-section">
                <h3>Fatores de risco</h3>
                <ul className="chip-list">
                  {incident.riskFactors.map((factor) => (
                    <li key={factor}>{factor}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>

          <TriagePanel
            incident={incident}
            runs={runs}
            isOperator={isOperator}
            canConfirm={allowedTransitions.includes('CONFIRMED')}
            actorLabel={user ? roleLabel(user.role) : ''}
            onRunComplete={refreshRelated}
            onIncidentChanged={handleIncidentChanged}
          />
        </div>

        <aside className="stack">
          <article className="panel">
            <p className="eyebrow">Estado operacional</p>
            <h2>Resumo</h2>
            <dl className="detail-list">
              <DetailField label="Status">
                <StatusBadge status={incident.status} />
              </DetailField>
              <DetailField label="Prioridade">
                <PriorityBadge priority={incident.priority} />
              </DetailField>
              <DetailField label="ID">{incident.id}</DetailField>
              <DetailField label="Resolvido em">{formatDateTime(incident.resolvedAt)}</DetailField>
              <DetailField label="Cancelado em">{formatDateTime(incident.cancelledAt)}</DetailField>
            </dl>

            <StatusControl
              incidentId={incident.id}
              allowed={allowedTransitions}
              isOperator={isOperator}
              onChanged={handleIncidentChanged}
            />
          </article>

          <Timeline events={events} />
        </aside>
      </section>
    </>
  );
}

function StatusControl({
  incidentId,
  allowed,
  isOperator,
  onChanged,
}: {
  incidentId: string;
  allowed: IncidentStatus[];
  isOperator: boolean;
  onChanged: (incident: Incident) => Promise<void>;
}) {
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOperator) return null;

  if (allowed.length === 0) {
    return <p className="muted status-control-note">Nenhuma transição de status disponível.</p>;
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target) return;
    setError('');
    setIsSubmitting(true);
    try {
      const updated = await transitionIncident(incidentId, {
        to: target as IncidentStatus,
        reason: reason.trim() || undefined,
      });
      setTarget('');
      setReason('');
      await onChanged(updated);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Não foi possível alterar o status.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="status-control" onSubmit={submit}>
      <h3>Alterar status</h3>
      <div className="field">
        <label htmlFor="nextStatus">Próximo status</label>
        <select id="nextStatus" value={target} onChange={(event) => setTarget(event.target.value)}>
          <option value="">Selecione…</option>
          {allowed.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="transitionReason">Motivo (opcional)</label>
        <input
          id="transitionReason"
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      <button className="button button-primary" type="submit" disabled={!target || isSubmitting}>
        {isSubmitting ? 'Aplicando…' : 'Aplicar transição'}
      </button>
    </form>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Timeline({ events }: { events: IncidentEvent[] }) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Auditoria</p>
          <h2>Histórico</h2>
        </div>
        <span className="muted">
          {events.length} evento{events.length === 1 ? '' : 's'}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="muted">Nenhum evento registrado.</p>
      ) : (
        <ol className="timeline">
          {events.map((event) => (
            <li key={event.id}>
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <strong>{eventLabel(event.type)}</strong>
                <time>{formatDateTime(event.createdAt)}</time>
                <EventMetadata value={event.metadata} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function EventMetadata({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return null;

  return (
    <div className="event-metadata">
      {entries.map(([key, item]) => (
        <span key={key}>
          <strong>{key}:</strong> {typeof item === 'object' ? JSON.stringify(item) : String(item)}
        </span>
      ))}
    </div>
  );
}

function TriagePanel({
  incident,
  runs,
  isOperator,
  canConfirm,
  actorLabel,
  onRunComplete,
  onIncidentChanged,
}: {
  incident: Incident;
  runs: TriageRun[];
  isOperator: boolean;
  canConfirm: boolean;
  actorLabel: string;
  onRunComplete: () => Promise<void>;
  onIncidentChanged: (incident: Incident) => Promise<void>;
}) {
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmingId, setConfirmingId] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<TriageFormDto>({
    defaultValues: { sourceText: incident.originalReport },
  });

  const analyze = handleSubmit(async (values) => {
    setActionError('');
    setSuccess('');
    clearErrors();
    const validationErrors = await validateDto(TriageFormDto, values);
    if (Object.keys(validationErrors).length > 0) {
      for (const [field, message] of Object.entries(validationErrors)) {
        setError(field as keyof TriageFormDto, { message });
      }
      return;
    }

    try {
      const run = await runTriage({
        sourceText: values.sourceText.trim(),
        incidentId: incident.id,
      });
      if (run.status === 'FAILED') {
        setActionError(
          `A triagem foi persistida como falha: ${run.errorMessage ?? 'erro do provedor'}.`,
        );
      } else {
        setSuccess('Triagem executada. Revise a sugestão antes de confirmar.');
      }
      await onRunComplete();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Não foi possível executar a triagem.'));
    }
  });

  const confirm = async (run: TriageRun) => {
    setActionError('');
    setSuccess('');
    setConfirmingId(run.id);
    try {
      const updatedIncident = await confirmTriage(incident.id, run.id);
      setSuccess('Sugestão confirmada pelo backend. O incidente e a prioridade foram atualizados.');
      await onIncidentChanged(updatedIncident);
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Não foi possível confirmar a sugestão.'));
    } finally {
      setConfirmingId('');
    }
  };

  const reject = async (run: TriageRun, reason: string) => {
    setActionError('');
    setSuccess('');
    setRejectingId(run.id);
    try {
      await rejectTriage(incident.id, run.id, reason.trim() || undefined);
      setSuccess('Sugestão rejeitada. O incidente não foi alterado.');
      await onRunComplete();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Não foi possível rejeitar a sugestão.'));
    } finally {
      setRejectingId('');
    }
  };

  return (
    <section className="stack">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Triagem assistida</p>
            <h2>Sugestões e confirmação humana</h2>
          </div>
          <span className="muted">A IA sugere; o backend decide.</span>
        </div>

        {actionError ? <ErrorNotice message={actionError} /> : null}
        {success ? <SuccessNotice message={success} /> : null}

        {isOperator ? (
          <form className="triage-form" onSubmit={analyze} noValidate>
            <div className="field">
              <label htmlFor="sourceText">Texto para análise *</label>
              <textarea
                id="sourceText"
                rows={4}
                aria-invalid={!!errors.sourceText}
                {...register('sourceText')}
              />
              <FieldError message={errors.sourceText?.message} />
            </div>
            <div className="form-actions">
              <button className="button button-primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Executando triagem…' : 'Executar triagem'}
              </button>
              <span className="muted">A execução é registrada no histórico do incidente.</span>
            </div>
          </form>
        ) : (
          <p className="muted">
            Perfil {actorLabel || 'de leitura'}: é possível consultar as sugestões, mas não executar
            nem confirmar triagens.
          </p>
        )}
      </div>

      {runs.length === 0 ? (
        <EmptyState
          title="Nenhuma triagem executada"
          description="Execute a triagem assistida para gerar uma sugestão estruturada. Nenhum campo do incidente é alterado sem confirmação."
        />
      ) : (
        runs.map((run) => (
          <TriageCard
            key={run.id}
            run={run}
            isOperator={isOperator}
            canConfirm={canConfirm}
            confirming={confirmingId === run.id}
            rejecting={rejectingId === run.id}
            onConfirm={() => confirm(run)}
            onReject={(reason) => reject(run, reason)}
          />
        ))
      )}
    </section>
  );
}

function TriageCard({
  run,
  isOperator,
  canConfirm,
  confirming,
  rejecting,
  onConfirm,
  onReject,
}: {
  run: TriageRun;
  isOperator: boolean;
  canConfirm: boolean;
  confirming: boolean;
  rejecting: boolean;
  onConfirm: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}) {
  const [armed, setArmed] = useState(false);
  const [rejectArmed, setRejectArmed] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const hasSuggestion = run.status === 'SUCCEEDED' || run.status === 'CONFIRMED';

  return (
    <article className="panel triage-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Execução {run.id.slice(0, 8)}</p>
          <h3>{formatDateTime(run.requestedAt)}</h3>
        </div>
        <TriageStatusBadge status={run.status} />
      </div>

      {run.status === 'FAILED' ? (
        <ErrorNotice message={run.errorMessage ?? 'A triagem falhou sem detalhes públicos.'} />
      ) : null}

      {hasSuggestion ? (
        <>
          <dl className="detail-list detail-list-grid">
            <DetailField label="Tipo sugerido">
              <IncidentTypeBadge type={run.suggestedIncidentType} />
            </DetailField>
            <DetailField label="Confiança">{formatConfidence(run.confidence)}</DetailField>
            <DetailField label="Rodovia sugerida">{run.suggestedRoadName ?? '—'}</DetailField>
            <DetailField label="Marco sugerido">{run.suggestedKilometerMarker ?? '—'}</DetailField>
            <DetailField label="Sentido sugerido">{run.suggestedDirection ?? '—'}</DetailField>
            <DetailField label="Local sugerido">{run.suggestedLocationText ?? '—'}</DetailField>
          </dl>

          {run.suggestedDescription ? (
            <div className="detail-section">
              <h4>Descrição sugerida</h4>
              <p>{run.suggestedDescription}</p>
            </div>
          ) : null}

          <div className="triage-columns">
            <div>
              <h4>Fatores de risco</h4>
              {run.riskFactors.length > 0 ? (
                <ul className="chip-list">
                  {run.riskFactors.map((factor) => (
                    <li key={factor}>{factor}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nenhum fator informado.</p>
              )}
            </div>
            <div>
              <h4>Informação faltante</h4>
              {run.missingInformation.length > 0 ? (
                <ul className="plain-list">
                  {run.missingInformation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nenhuma lacuna apontada.</p>
              )}
            </div>
          </div>
        </>
      ) : null}

      <details className="source-details">
        <summary>Texto analisado</summary>
        <p>{run.sourceText}</p>
      </details>

      <dl className="triage-meta">
        <DetailField label="Provedor">{run.provider ?? '—'}</DetailField>
        <DetailField label="Modelo">{run.model ?? '—'}</DetailField>
        <DetailField label="Latência">{formatLatency(run.latencyMs)}</DetailField>
        <DetailField label="Tokens">{formatTokens(run)}</DetailField>
      </dl>

      {isOperator && canConfirm && run.status === 'SUCCEEDED' ? (
        <div className="confirm-zone">
          {armed ? (
            <>
              <p>
                Confirmar aplica os campos sugeridos ao incidente e recalcula a prioridade no
                backend. Esta ação é auditada.
              </p>
              <div className="form-actions">
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => void onConfirm()}
                  disabled={confirming}
                >
                  {confirming ? 'Confirmando…' : 'Confirmar agora'}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setArmed(false)}
                  disabled={confirming}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <button className="button button-primary" type="button" onClick={() => setArmed(true)}>
              Revisar e confirmar sugestão
            </button>
          )}
        </div>
      ) : null}

      {isOperator && run.status === 'SUCCEEDED' ? (
        <div className="confirm-zone">
          {rejectArmed ? (
            <>
              <p>Rejeitar mantém o incidente inalterado e registra a decisão no histórico.</p>
              <div className="field">
                <label htmlFor={`reject-reason-${run.id}`}>Motivo da rejeição (opcional)</label>
                <textarea
                  id={`reject-reason-${run.id}`}
                  rows={2}
                  value={rejectReason}
                  maxLength={500}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </div>
              <div className="form-actions">
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => void onReject(rejectReason)}
                  disabled={rejecting}
                >
                  {rejecting ? 'Rejeitando…' : 'Confirmar rejeição'}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setRejectArmed(false);
                    setRejectReason('');
                  }}
                  disabled={rejecting}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setRejectArmed(true)}
              disabled={confirming}
            >
              Rejeitar sugestão
            </button>
          )}
        </div>
      ) : null}

      {run.status === 'CONFIRMED' ? (
        <p className="confirmed-note">Esta sugestão já foi confirmada e aplicada ao incidente.</p>
      ) : null}

      {run.status === 'REJECTED' ? (
        <p className="confirmed-note">Esta sugestão foi rejeitada sem alterar o incidente.</p>
      ) : null}
    </article>
  );
}
