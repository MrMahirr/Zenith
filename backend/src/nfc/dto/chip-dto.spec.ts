import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterChipDto } from './register-chip.dto';
import { UpdateChipDto } from './update-chip.dto';

const errorsFor = async <T extends object>(cls: new () => T, plain: object) =>
  (await validate(plainToInstance(cls, plain))).map((error) => error.property);

describe('NFC chip DTOs', () => {
  it('accepts a known mode and trims the label', async () => {
    const dto = plainToInstance(RegisterChipDto, { label: '  Kartim ', assignedMode: 'FOCUS' });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.label).toBe('Kartim');
  });

  it('rejects an unknown mode', async () => {
    expect(await errorsFor(RegisterChipDto, { label: 'x', assignedMode: 'HACK' })).toContain(
      'assignedMode',
    );
  });

  it('rejects an empty or too long label', async () => {
    expect(await errorsFor(RegisterChipDto, { label: '   ', assignedMode: 'CODING' })).toContain(
      'label',
    );
    expect(
      await errorsFor(RegisterChipDto, { label: 'a'.repeat(101), assignedMode: 'CODING' }),
    ).toContain('label');
  });

  it('allows partial updates but validates provided fields', async () => {
    expect(await errorsFor(UpdateChipDto, {})).toHaveLength(0);
    expect(await errorsFor(UpdateChipDto, { assignedMode: 'RELAX' })).toHaveLength(0);
    expect(await errorsFor(UpdateChipDto, { assignedMode: 'nope' })).toContain('assignedMode');
  });
});
