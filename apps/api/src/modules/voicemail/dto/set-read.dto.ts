import { IsBoolean } from 'class-validator'

/** Body for PATCH /voicemail/:id/read. */
export class SetReadDto {
  @IsBoolean()
  read!: boolean
}
