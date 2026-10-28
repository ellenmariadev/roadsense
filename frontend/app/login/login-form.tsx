'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FieldError } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LoginFormDto } from '@/lib/form-dtos';
import { validateDto } from '@/lib/validation';

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { login, user } = useAuth();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormDto>({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    clearErrors();
    const validationErrors = await validateDto(LoginFormDto, values);
    if (Object.keys(validationErrors).length > 0) {
      for (const [field, message] of Object.entries(validationErrors)) {
        setError(field as keyof LoginFormDto, { message });
      }
      return;
    }

    try {
      await login(values.email.trim(), values.password);
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Não foi possível entrar.'));
    }
  });

  if (user) {
    return (
      <div className="auth-card panel">
        <h2>Sessão ativa</h2>
        <p className="muted">
          Você já está autenticado como <strong>{user.email}</strong>.
        </p>
        <Link className="button button-primary" href={nextPath}>
          Continuar
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-card panel" onSubmit={onSubmit} noValidate>
      <div>
        <p className="eyebrow">Entrar</p>
        <h2>Acesse sua conta</h2>
        <p className="muted">Use um usuário criado pelo seed local ou por um administrador.</p>
      </div>

      {formError ? (
        <div className="notice notice-error" role="alert">
          {formError}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="operador@roadsense.local"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div className="field">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha local"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
      </div>

      <button className="button button-primary button-block" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
