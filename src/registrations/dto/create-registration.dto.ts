import { IsUUID } from 'class-validator';

export class CreateRegistrationDto {
  @IsUUID()
  slotId: string;
}
