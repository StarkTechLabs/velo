export interface RowModel {
  [key: string]: unknown
}

export interface DataRow extends RowModel {
  id: string
}

export interface ColDef<V extends DataRow, F = V> {
  field: string
  cellClassName?: string
  colSpan?: number
  description?: string
  display?: "text" | "flex"
  defaultValue?: string
  headerName?: string
  hidden?: boolean
  maxWidth?: number
  minWidth?: number
  renderCell?: (params: RowParams<V>) => React.ReactNode
  valueFormatter?: (params: RowParams<V>) => F
  width?: number
}

export interface RowParams<V extends DataRow> {
  id?: string

  field: string

  value: V
}
