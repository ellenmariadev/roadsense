import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export async function validateDto<T extends object>(
  dtoClass: new () => T,
  values: object,
): Promise<Record<string, string>> {
  const instance = plainToInstance(dtoClass, values);
  const errors = await validate(instance, {
    whitelist: true,
    forbidUnknownValues: true,
  });
  const messages: Record<string, string> = {};

  for (const error of errors) {
    const firstConstraint = error.constraints ? Object.values(error.constraints)[0] : undefined;
    if (firstConstraint && !messages[error.property]) {
      messages[error.property] = firstConstraint;
    }
  }

  return messages;
}
