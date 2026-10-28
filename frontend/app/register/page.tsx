'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthGate } from '@/components/auth-gate';
import { RoleGate } from '@/components/role-gate';
import { FieldError, PageHeader, SuccessNotice } from '@/components/ui';
import { getApiErrorMessage, registerUser } from '@/lib/api';
import { RegisterUserFormDto } from '@/lib/form-dtos';
import { validateDto } from '@/lib/validation';

export default function RegisterPage() {
  return (
    <AuthGate>
      <RoleGate roles={['ADMIN']}>
        <RegisterUserPanel />
      </RoleGate>
    </AuthGate>
  );
}

function RegisterUserPanel() {
  const [formError, setFormError] = useState('');
  const [created, setCreated] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterUserFormDto>({
    defaultValues: { email: '', password: '', name: '', role: 'VIEWER' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    setCreated('');
    clearErrors();
    const normalized = {
      ...values,
      email: values.email.trim(),
      name: values.name?.trim() || undefined,
    };
    const validationErrors = await validateDto(RegisterUserFormDto, normalized);
    if (Object.keys(validationErrors).length > 0) {
      for (const [field, message] of Object.entries(validationErrors)) {
        setError(field as keyof RegisterUserFormDto, { message });
      }
      return;
    }

    try {
      const user = await registerUser({
        email: normalized.email,
        password: normalized.password,
        name: normalized.name,
        role: normalized.role,
      });
      setCreated(`Usuário ${user.email} criado com o perfil ${user.role}.`);
      reset({ email: '', password: '', name: '', role: 'VIEWER' });
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Não foi possível criar o usuário.'));
    }
  });

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Criar usuário"
        description="Usuários criados aqui podem acessar a operação conforme o perfil escolhido. A autorização efetiva é sempre aplicada pelo backend."
      />

      <form className="panel form-panel narrow-panel" onSubmit={onSubmit} noValidate>
        {formError ? (
          <div className="notice notice-error" role="alert">
            {formError}
          </div>
        ) : null}
        {created ? <SuccessNotice message={created} /> : null}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" placeholder="Nome de exibição" {...register('name')} />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="off" {...register('email')} />
            <FieldError message={errors.email?.message} />
          </div>

          <div className="field">
            <label htmlFor="password">Senha inicial</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </div>

          <div className="field">
            <label htmlFor="role">Perfil</label>
            <select id="role" {...register('role')}>
              <option value="VIEWER">Visualizador</option>
              <option value="OPERATOR">Operador</option>
              <option value="ADMIN">Administrador</option>
            </select>
            <FieldError message={errors.role?.message} />
          </div>
        </div>

        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Criando…' : 'Criar usuário'}
          </button>
        </div>
      </form>
    </>
  );
}
