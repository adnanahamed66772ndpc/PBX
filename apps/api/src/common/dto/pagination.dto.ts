import { IsInt, IsOptional, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

/**
 * Shared pagination query parameters used by list endpoints (cdr, users, …).
 * `Type` decoration + `@Type(() => Number)` lets the global transform pipe
 * coerce `?page=2&limit=50` strings into numbers.
 */
export class PaginationDto {
  @ApiProperty({ example: 1, minimum: 1, default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @ApiProperty({ example: 25, minimum: 1, maximum: 200, default: 25, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 25
}

/** Convert a {@link PaginationDto} into LIMIT / OFFSET values for SQL. */
export function pageToLimitOffset(page: number, limit: number): { limit: number; offset: number } {
  return { limit, offset: (page - 1) * limit }
}
