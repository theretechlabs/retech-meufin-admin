import { Grid } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { StatCard } from '@/components/common/StatCard'
import { getAssetDebts } from '@/features/finance/api'
import { financeKeys } from '@/features/finance/constants'
import { formatCents, formatDate } from '../constants'

/**
 * Indicadores do financiamento no resumo do imóvel: saldo devedor e
 * patrimônio líquido (valor atual − saldo). O saldo é o informado no
 * contrato; sem ele, cai na soma das parcelas em aberto, que superestima a
 * dívida (carrega juros futuros) — o hint diz qual dos dois está na tela.
 */
export function PropertyDebtStats({
  propertyId,
  currentValueCents,
}: {
  propertyId: string
  currentValueCents?: number | null
}) {
  const { data, isLoading } = useQuery({
    queryKey: financeKeys.assetDebts('property', propertyId),
    queryFn: () => getAssetDebts('property', propertyId),
  })
  const open = (data?.debts ?? []).filter((d) => !d.settled)
  if (!isLoading && open.length === 0) return null

  const informed = open.every((d) => d.contract?.balance_cents != null)
  const balance = open.reduce((sum, d) => sum + (d.contract?.balance_cents ?? d.open_cents), 0)
  const balanceDate = open.length === 1 ? open[0].contract?.balance_date : null
  const equity = currentValueCents != null ? currentValueCents - balance : null

  return (
    <>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard
          label="Saldo devedor"
          value={formatCents(balance)}
          loading={isLoading}
          color="warning"
          hint={
            informed
              ? balanceDate
                ? `Informado em ${formatDate(balanceDate)}`
                : 'Informado no contrato'
              : 'Soma das parcelas em aberto'
          }
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard
          label="Patrimônio líquido"
          value={formatCents(equity)}
          loading={isLoading}
          hint="Valor atual − saldo devedor"
          color={equity == null ? undefined : equity >= 0 ? 'success' : 'error'}
        />
      </Grid>
    </>
  )
}
