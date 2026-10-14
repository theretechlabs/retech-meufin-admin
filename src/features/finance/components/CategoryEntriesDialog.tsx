import { useMemo } from 'react'
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { formatCents, getDashboardCategoryEntries, type Entry, type EntryStatus } from '../api'
import { errorMessage, financeKeys, MONTH_OPTIONS } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'

const STATUS_COLOR: Record<EntryStatus, 'success' | 'warning' | 'default'> = {
  realizada: 'success',
  prevista: 'warning',
  cancelada: 'default',
}

function formatDateBR(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/** Valor que a barra do gráfico soma: pago quando realizada, previsto senão. */
function chartedCents(e: Entry): number {
  return e.status === 'realizada' ? (e.paid_amount_cents ?? e.amount_cents) : e.amount_cents
}

/**
 * Drill-down de uma barra do "Pra onde foi o dinheiro": as despesas da
 * categoria no mês filtrado, com os mesmos critérios do gráfico (previstas +
 * realizadas, canceladas fora, itens de fatura contam pela própria categoria).
 */
export function CategoryEntriesDialog({
  slug,
  label,
  year,
  month,
  familyMemberId,
  onClose,
}: {
  slug: string
  label: string
  year: number
  month: number
  familyMemberId?: string
  onClose: () => void
}) {
  const entryStatus = useCatalog('finance.entry_status')
  const params = useMemo(
    () => ({ year, month, family_member_id: familyMemberId || undefined }),
    [year, month, familyMemberId]
  )

  // Endpoint dedicado: mesma cláusula SQL da barra, lista completa sem
  // paginação e total somado no servidor — bate por construção.
  const entriesQ = useQuery({
    queryKey: [...financeKeys.all, 'category-entries', slug, params] as const,
    queryFn: () => getDashboardCategoryEntries(slug, params),
  })

  const entries = entriesQ.data?.items ?? []
  const totalCents = entriesQ.data?.total_cents ?? 0

  const monthLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month)

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {label} — {monthLabel}/{year}
      </DialogTitle>
      <DialogContent>
        {entriesQ.isLoading && <LoadingState label="Carregando despesas…" />}
        {entriesQ.isError && <ErrorState message={errorMessage(entriesQ.error)} />}

        {entriesQ.isSuccess && entries.length === 0 && (
          <EmptyState
            title="Nenhuma despesa encontrada"
            description="Não há lançamentos desta categoria no período."
          />
        )}

        {entries.length > 0 && (
          <>
            <TableContainer
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 420 }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 110 }}>Vencimento</TableCell>
                    <TableCell>Descrição</TableCell>
                    <TableCell sx={{ width: 120 }}>Status</TableCell>
                    <TableCell sx={{ width: 130 }} align="right">
                      Valor
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id} hover>
                      <TableCell>{formatDateBR(e.due_date)}</TableCell>
                      <TableCell>
                        {e.description}
                        {e.parent_id && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            compra em fatura de cartão
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={STATUS_COLOR[e.status]}
                          label={entryStatus.labelOf(e.status)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCents(chartedCents(e))}
                        {e.status === 'realizada' &&
                          e.paid_amount_cents != null &&
                          e.paid_amount_cents !== e.amount_cents && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              previsto {formatCents(e.amount_cents)}
                            </Typography>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="body2" sx={{ mt: 1.5 }}>
              {entries.length} lançamento(s) — total <strong>{formatCents(totalCents)}</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Realizadas contam pelo valor pago e entram no mês do pagamento; previstas, pelo
              valor do lançamento no mês do vencimento — o mesmo critério da barra do gráfico.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
