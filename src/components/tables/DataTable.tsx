import { Fragment, type ReactNode } from 'react'
import {
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  type SxProps,
  type TableCellProps,
  type Theme,
} from '@mui/material'
import { useIsMobile } from '@/hooks/useIsMobile'

/**
 * Papel da coluna no card do telefone:
 * - `title`: linha principal (negrito) — normalmente a descrição;
 * - `value`: destaque à direita do título — normalmente o valor em R$;
 * - `meta`: linha secundária, concatenada com " · " (data, categoria, status…);
 * - `actions`: rodapé do card (botões de ação);
 * - `hidden`: não aparece no telefone.
 */
export type DataColumnMobile = 'title' | 'value' | 'meta' | 'actions' | 'hidden'

export type DataColumn<T> = {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  align?: TableCellProps['align']
  /** Default: `meta`. */
  mobile?: DataColumnMobile
  /** Rótulo curto antes do valor no card (ex.: "Venc."). Só para `meta`. */
  mobileLabel?: string
  headerSx?: SxProps<Theme>
  cellSx?: SxProps<Theme>
  /** Coluna ordenável (precisa de `sort`/`onSort` na tabela). */
  sortable?: boolean
  /** Só no telefone (ex.: descrição como título do card, que a tabela não mostra). */
  mobileOnly?: boolean
}

export type DataSort = { key: string; dir: 'asc' | 'desc' }

type Props<T> = {
  rows: T[]
  columns: DataColumn<T>[]
  getRowKey: (row: T) => string
  size?: 'small' | 'medium'
  /** Linha extra sob a linha/card (detalhe expandido). Retorne null quando fechado. */
  renderDetail?: (row: T) => ReactNode
  /** Célula/card com conteúdo antes da primeira coluna (ex.: botão expandir). */
  leading?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
  rowSx?: (row: T) => SxProps<Theme> | undefined
  /** Conteúdo quando `rows` está vazio (mensagem, EmptyState…). */
  empty?: ReactNode
  /** Rodapé (paginação). Fica fora da rolagem horizontal. */
  footer?: ReactNode
  /** Ordenação controlada: desktop usa TableSortLabel, telefone mostra chips. */
  sort?: DataSort
  onSort?: (key: string) => void
  sx?: SxProps<Theme>
}

/**
 * Tabela que vira lista de cards no telefone (< `sm`). Mesmas colunas, dois
 * layouts: no desktop é a `<Table>` do MUI; no telefone cada linha é um card
 * (título + valor em destaque, metadados numa linha, ações no rodapé).
 * Migrar uma página = descrever as colunas uma vez, nada de JSX duplicado.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  size = 'small',
  renderDetail,
  leading,
  onRowClick,
  rowSx,
  empty,
  footer,
  sort,
  onSort,
  sx,
}: Props<T>) {
  const isMobile = useIsMobile()
  const sortable = onSort ? columns.filter((c) => c.sortable) : []

  if (rows.length === 0 && empty !== undefined) {
    return (
      <>
        {empty}
        {footer}
      </>
    )
  }

  if (isMobile) {
    const title = columns.find((c) => c.mobile === 'title')
    const value = columns.find((c) => c.mobile === 'value')
    const metas = columns.filter((c) => (c.mobile ?? 'meta') === 'meta')
    const actions = columns.filter((c) => c.mobile === 'actions')
    return (
      <Box sx={sx}>
        {sortable.length > 0 && (
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ px: 0.5, pb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Ordenar:
            </Typography>
            {sortable.map((c) => {
              const active = sort?.key === c.key
              return (
                <Chip
                  key={c.key}
                  size="small"
                  variant={active ? 'filled' : 'outlined'}
                  color={active ? 'primary' : 'default'}
                  label={`${typeof c.header === 'string' ? c.header : c.key}${active ? (sort?.dir === 'asc' ? ' ↑' : ' ↓') : ''}`}
                  onClick={() => onSort?.(c.key)}
                />
              )
            })}
          </Stack>
        )}
        <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
          {rows.map((row) => {
            const detail = renderDetail?.(row)
            return (
              <Box key={getRowKey(row)} sx={rowSx?.(row)}>
                <Box
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{ py: 1.5, px: 0.5, cursor: onRowClick ? 'pointer' : undefined }}
                >
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    {leading && <Box sx={{ flexShrink: 0, mt: -0.5 }}>{leading(row)}</Box>}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between">
                        {title && (
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}
                          >
                            {title.render(row)}
                          </Typography>
                        )}
                        {value && (
                          <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {value.render(row)}
                          </Typography>
                        )}
                      </Stack>
                      {metas.length > 0 && (
                        <Stack
                          direction="row"
                          flexWrap="wrap"
                          useFlexGap
                          columnGap={1}
                          rowGap={0.5}
                          alignItems="center"
                          sx={{ mt: 0.5, color: 'text.secondary', fontSize: 12.5, lineHeight: 1.5 }}
                        >
                          {metas.map((c) => {
                            const node = c.render(row)
                            if (node === null || node === undefined || node === '' || node === '—') return null
                            return (
                              <Box key={c.key} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                {c.mobileLabel && <Box component="span" sx={{ color: 'text.disabled' }}>{c.mobileLabel}</Box>}
                                {node}
                              </Box>
                            )
                          })}
                        </Stack>
                      )}
                      {actions.length > 0 && (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                          sx={{ mt: 0.5, mr: -0.5 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {actions.map((c) => (
                            <Fragment key={c.key}>{c.render(row)}</Fragment>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Stack>
                </Box>
                {detail ? <Box sx={{ pb: 1.5 }}>{detail}</Box> : null}
              </Box>
            )
          })}
        </Stack>
        {footer}
      </Box>
    )
  }

  const desktopColumns = columns.filter((c) => !c.mobileOnly)
  const colSpan = desktopColumns.length + (leading ? 1 : 0)
  return (
    <>
      <TableContainer sx={sx}>
        <Table size={size}>
          <TableHead>
            <TableRow>
              {leading && <TableCell sx={{ width: 40 }} />}
              {desktopColumns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <TableCell
                    key={c.key}
                    align={c.align}
                    sx={c.headerSx}
                    sortDirection={c.sortable && active ? sort?.dir : false}
                  >
                    {c.sortable && onSort ? (
                      <TableSortLabel active={active} direction={active ? sort?.dir : 'asc'} onClick={() => onSort(c.key)}>
                        {c.header}
                      </TableSortLabel>
                    ) : (
                      c.header
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const detail = renderDetail?.(row)
              return (
                <Fragment key={getRowKey(row)}>
                  <TableRow
                    hover={Boolean(onRowClick)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    sx={{ cursor: onRowClick ? 'pointer' : undefined, ...(rowSx?.(row) as object) }}
                  >
                    {leading && <TableCell sx={{ width: 40, pr: 0 }}>{leading(row)}</TableCell>}
                    {desktopColumns.map((c) => (
                      <TableCell key={c.key} align={c.align} sx={c.cellSx}>
                        {c.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                  {detail ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} sx={{ py: 0 }}>
                        {detail}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {footer}
    </>
  )
}
