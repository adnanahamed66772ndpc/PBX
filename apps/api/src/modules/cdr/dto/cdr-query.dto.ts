import { IsString, IsOptional, IsDateString, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'

/**
 * GET /cdr query filters. Inherits page/limit from {@link PaginationDto}.
 *
 * `from` / `to` are ISO-8601 timestamps bounding start_time; `fromExt` /
 * `toExt` filter by calling/called extension; `did` filters by inbound DID;
 * `direction` is in|out|internal; `status` is answered|noanswer|busy|failed.
 */
export class CdrQueryDto extends PaginationDto {
  @ApiProperty({ required: false, enum: ['in', 'out', 'internal'] })
  @IsOptional()
  @IsString()
  @Matches(/^(in|out|internal)$/, { message: 'direction must be in, out, or internal' })
  direction?: string

  @ApiProperty({ required: false, enum: ['answered', 'noanswer', 'busy', 'failed'] })
  @IsOptional()
  @IsString()
  status?: string

  @ApiProperty({ required: false, example: '1001', description: 'Filter by from_ext' })
  @IsOptional()
  @IsString()
  fromExt?: string

  @ApiProperty({ required: false, example: '1002', description: 'Filter by to_ext' })
  @IsOptional()
  @IsString()
  toExt?: string

  @ApiProperty({ required: false, example: '+18005551234', description: 'Filter by DID' })
  @IsOptional()
  @IsString()
  did?: string

  @ApiProperty({ required: false, example: '2024-01-01T00:00:00Z', description: 'start_time >= from' })
  @IsOptional()
  @IsDateString()
  from?: string

  @ApiProperty({ required: false, example: '2024-02-01T00:00:00Z', description: 'start_time < to' })
  @IsOptional()
  @IsDateString()
  to?: string
}
