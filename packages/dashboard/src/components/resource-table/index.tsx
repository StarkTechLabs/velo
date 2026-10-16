import React, { useState } from "react"

import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { ColDef, DataRow } from "./types"

export * from "./types"

import { Info, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { ConfirmButton } from "../confirm-button"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

const getPath = (row: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], row)

export interface ResourceTableProps<T extends DataRow, F = T> {
  className?: string
  initialData?: Array<T>
  /**
   * Controlled data for the table. If provided, this will be used instead of internal state.
   */
  data?: Array<T>
  fetchData?: () => Promise<Array<T>>
  onRowClick?: (_row: T) => void
  onDeleteItem?: (_row: T) => void
  onEditItem?: (_row: T) => void
  columnsDef: Array<ColDef<T, F>>
  withCard?: boolean
}
const DefaultWrapper = ({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode | null
}) => {
  return <div className={className}>{children}</div>
}
export function ResourceTable<T extends DataRow, F = T>({
  className,
  initialData,
  data,
  columnsDef,
  onRowClick,
  onDeleteItem,
  onEditItem,
  withCard = false,
}: ResourceTableProps<T, F>) {
  // If controlled data is provided, use it. Otherwise, use internal state from initialData.
  const [internalData] = useState<Array<T>>(initialData || [])
  const tableData = data !== undefined ? data : internalData

  const Wrapper = withCard ? Card : DefaultWrapper
  return (
    <Wrapper className={cn("p-0", className)}>
      <Table className="w-full">
        {buildHeader<T, F>(columnsDef, !!onDeleteItem || !!onEditItem)}
        <TableBody>
          {buildBody<T, F>(columnsDef, tableData, onRowClick, onDeleteItem, onEditItem)}
        </TableBody>
      </Table>
    </Wrapper>
  )
}

function buildHeader<T extends DataRow, F = T>(
  columnsDef: Array<ColDef<T, F>>,
  withDelete: boolean,
) {
  const buildWidth = (colDef: ColDef<T, F>) => {
    let widthClasses = ""
    if (colDef.width) widthClasses += `w-${colDef.width}`
    if (colDef.maxWidth) widthClasses += ` max-w-[${colDef.maxWidth}px]`
    if (colDef.minWidth) widthClasses += ` min-w-[${colDef.minWidth}px]`
    return widthClasses
  }
  return (
    <TableHeader>
      <TableRow className="border-gray-700 hover:bg-transparent">
        {columnsDef.map((colDef) => (
          <TableHead
            key={colDef.field}
            title={colDef.description}
            data-testid={`header-${colDef.field}`}
            className={cn(
              buildWidth(colDef),
              colDef.hidden ? "hidden" : "",
              "text-gray-200 font-semibold bg-gray-800/80 border-gray-700 px-4 py-3 text-sm uppercase tracking-wide",
            )}
          >
            {colDef.headerName || colDef.field}
          </TableHead>
        ))}
        {withDelete && (
          <TableHead
            key="delete"
            className="text-gray-200 font-semibold bg-gray-800/80 border-gray-700 px-4 py-3 text-sm"
          ></TableHead>
        )}
      </TableRow>
    </TableHeader>
  )
}

function buildBody<T extends DataRow, F = T>(
  columnsDef: Array<ColDef<T, F>>,
  data: Array<T>,
  onRowClick?: (_row: T) => void,
  onDeleteItem?: (_row: T) => void,
  onEditItem?: (_row: T) => void,
) {
  return (data || []).map((row, idx) => (
    <TableRow
      key={row.id || idx}
      data-testid={`row-${row.id || idx}`}
      onClick={() => onRowClick && onRowClick(row)}
      className={cn(
        "border-gray-700 transition-all duration-200",
        onRowClick && "cursor-pointer",
        "hover:bg-gray-800/60 hover:shadow-md",
        "even:bg-gray-900/30 odd:bg-gray-900/10",
        onRowClick && "hover:scale-[1.01]",
      )}
    >
      {columnsDef.map((col) => (
        <TableCell
          key={col.field}
          data-testid={`cell-${col.field}`}
          className={cn(
            "table-cell text-gray-200 px-4 py-3 border-gray-700",
            col.display,
            col.hidden ? "hidden" : "",
            col.cellClassName,
          )}
          colSpan={col.colSpan}
        >
          {col.renderCell
            ? col.renderCell({ id: row.id, field: col.field, value: row })
            : col.valueFormatter
              ? (col.valueFormatter({
                  id: row.id,
                  field: col.field,
                  value: row,
                }) as React.ReactNode)
              : ((getPath(row, col.field) as React.ReactNode) ?? col.defaultValue)}
        </TableCell>
      ))}
      {(onDeleteItem || onEditItem) && (
        <TableCell
          key="actions"
          className="table-cell text-gray-200 px-4 py-3 border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900">
              {onEditItem && (
                <DropdownMenuItem
                  data-testid="edit-menu-item"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditItem(row)
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDeleteItem && (
                <ConfirmButton
                  variant="destructive"
                  size="sm"
                  title="Delete"
                  onClick={() => onDeleteItem(row)}
                  confirmChild={
                    <div className="flex">
                      <Info className="mr-2 h-4 w-4" />
                      Confirm
                    </div>
                  }
                  asChild
                >
                  <DropdownMenuItem
                    data-testid="delete-menu-item"
                    onSelect={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </ConfirmButton>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  ))
}
