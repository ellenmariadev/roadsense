import { IsInt, IsString, Min } from 'class-validator';
import { globalValidationPipe } from './global-validation.pipe';

class SampleDto {
  @IsInt()
  @Min(1)
  id: number;

  @IsString()
  name: string;
}

describe('globalValidationPipe', () => {
  it('accepts a valid payload', async () => {
    const result = await globalValidationPipe.transform(
      { id: 1, name: 'valid' },
      { type: 'body', metatype: SampleDto, data: '' },
    );

    expect(result).toEqual({ id: 1, name: 'valid' });
  });

  it('transforms primitive values using implicit conversion', async () => {
    const result = await globalValidationPipe.transform(
      { id: '42', name: 'valid' },
      { type: 'body', metatype: SampleDto, data: '' },
    );

    expect(result.id).toBe(42);
  });

  it('rejects unknown properties', async () => {
    await expect(
      globalValidationPipe.transform(
        { id: 1, name: 'valid', injected: 'nope' },
        { type: 'body', metatype: SampleDto, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('rejects invalid property types', async () => {
    await expect(
      globalValidationPipe.transform(
        { id: 'not-a-number', name: 'valid' },
        { type: 'body', metatype: SampleDto, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('rejects missing required fields', async () => {
    await expect(
      globalValidationPipe.transform({}, { type: 'body', metatype: SampleDto, data: '' }),
    ).rejects.toThrow();
  });
});
