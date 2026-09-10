'use client'

import type { ReactNode } from 'react'
import type { TableColumn } from '@/lib/types'

export interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  rowKey?: (row: T, index: number) => string | number
  emptyMessage?: ReactNode
  /** Apply zebra striping to body rows. */
  zebra?: boolean
  className?: string
}

export function Table<T>({
  columns,
  data,
  rowKey,
  emptyMessage = 'No records found.',
  zebra = true,
  className = '',
}: TableProps<T>) {
  return (
    <div
      className={`overflow-x-auto rounded-md border border-border bg-surface ${className}`}
    >
      <table className="min-w-full divide-y divide-border text-sm">
        <thead>
          <tr className="bg-surface-subtle text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`whitespace-nowrap px-4 py-3 font-semibold text-text-muted ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={rowKey ? rowKey(row, index) : index}
                className={`${
                  zebra && index % 2 === 1 ? 'bg-surface-subtle/60' : ''
                } hover:bg-surface-hover transition-colors`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap px-4 py-3 text-text-primary ${col.className ?? ''}`}
                  >
                    {col.render
                      ? col.render(row, index)
                      : ((row as Record<string, unknown>)[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default Table
