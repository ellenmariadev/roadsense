'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthGate } from '@/components/auth-gate';
import { RoleGate } from '@/components/role-gate';
import { ErrorNotice, FieldError, PageHeader } from '@/components/ui';
import { createIncident, getApiErrorMessage } from '@/lib/api';
import { INCIDENT_TYPE_LABELS } from '@/lib/format';
import { IncidentFormDto } from '@/lib/form-dtos';
import type { CreateIncidentInput, IncidentType } from '@/lib/types';
import { validateDto } from '@/lib/validation';

export default function NewIncidentPage() {
  return (
    <AuthGate>
      <RoleGate roles={['ADMIN', 'OPERATOR']}>
        <NewIncidentForm />
      </RoleGate>
    </AuthGate>
  );
}

function NewIncidentForm() {
  const router = useRouter();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<IncidentFormDto>({
    defaultValues: {
      originalReport: '',
      incidentType: undefined,
      description: '',
      locationText: '',
      roadName: '',
      kilometerMarker: '',
      direction: '',
      riskFactorsText: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    clearErrors();
    const normalized = {
      ...values,
      originalReport: values.originalReport.trim(),
      incidentType: values.incidentType || undefined,
      riskFactorsText: values.riskFactorsText?.trim() || undefined,
    };
    const validationErrors = await validateDto(IncidentFormDto, normalized);
    if (Object.keys(validationErrors).length > 0) {
      for (const [field, message] of Object.entries(validationErrors)) {
        setError(field as keyof IncidentFormDto, { message });
      }
      return;
    }

    const riskFactors = (normalized.riskFactorsText ?? '')
      .split(/[\n,;]+/)
      .map((factor) => factor.trim())
      .filter(Boolean);

    const payload: CreateIncidentInput = {
      originalReport: normalized.originalReport,
      incidentType: normalized.incidentType,
      description: values.description?.trim() || undefined,
      locationText: values.locationText?.trim() || undefined,
      roadName: values.roadName?.trim() || undefined,
      kilometerMarker: values.kilometerMarker?.trim() || undefined,
      direction: values.direction?.trim() || undefined,
      riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    };

    try {
      const incident = await createIncident(payload);
      router.push(`/incidents/${incident.id}`);
      router.refresh();
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Não foi possível registrar o incidente.'));
    }
  });

  return (
    <>
      <PageHeader
        eyebrow="Novo relato"
        title="Registrar incidente"
        description="A prioridade é calculada pelo backend com regras determinísticas. A triagem por IA é opcional e só altera o incidente após confirmação humana."
        actions={
          <Link className="button button-secondary" href="/incidents">
            Cancelar
          </Link>
        }
      />

      <form className="panel form-panel" onSubmit={onSubmit} noValidate>
        {formError ? <ErrorNotice message={formError} /> : null}

        <div className="field">
          <label htmlFor="originalReport">Relato original *</label>
          <textarea
            id="originalReport"
            rows={6}
            placeholder="Descreva a ocorrência com o máximo de contexto disponível."
            aria-invalid={!!errors.originalReport}
            {...register('originalReport')}
          />
          <FieldError message={errors.originalReport?.message} />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="incidentType">Tipo de incidente</label>
            <select id="incidentType" {...register('incidentType')}>
              <option value="">Não definido</option>
              {Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value as IncidentType}>
                  {label}
                </option>
              ))}
            </select>
            <FieldError message={errors.incidentType?.message} />
          </div>

          <div className="field">
            <label htmlFor="roadName">Rodovia</label>
            <input id="roadName" placeholder="Ex.: BR-116" {...register('roadName')} />
          </div>

          <div className="field">
            <label htmlFor="kilometerMarker">Marco quilométrico</label>
            <input id="kilometerMarker" placeholder="Ex.: 245" {...register('kilometerMarker')} />
          </div>

          <div className="field">
            <label htmlFor="direction">Sentido</label>
            <input id="direction" placeholder="Ex.: sul" {...register('direction')} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="locationText">Localização descritiva</label>
          <input
            id="locationText"
            placeholder="Ex.: próximo ao acesso da cidade"
            {...register('locationText')}
          />
        </div>

        <div className="field">
          <label htmlFor="description">Descrição operacional</label>
          <textarea
            id="description"
            rows={3}
            placeholder="Resumo ou observação adicional do operador."
            {...register('description')}
          />
        </div>

        <div className="field">
          <label htmlFor="riskFactorsText">Fatores de risco</label>
          <textarea
            id="riskFactorsText"
            rows={2}
            placeholder="Separe por vírgulas. Ex.: vítimas, vazamento de combustível, pista interditada"
            {...register('riskFactorsText')}
          />
          <p className="field-hint">O backend usa estes fatores para calcular a prioridade.</p>
          <FieldError message={errors.riskFactorsText?.message} />
        </div>

        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Registrando…' : 'Registrar incidente'}
          </button>
          <Link className="button button-ghost" href="/incidents">
            Voltar
          </Link>
        </div>
      </form>
    </>
  );
}
