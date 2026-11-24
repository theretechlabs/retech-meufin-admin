import { Button, Card, Grid, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { StatCard } from '@/components/common/StatCard'
import { getAssetDebts } from '@/features/finance/api'
import { financeKeys } from '@/features/finance/constants'
import { formatCents, formatDate } from '../constants'

/**
 * Valores do imóvel no resumo. Nada aqui é digitado: tudo vem do
 * financiamento lançado na aba própria (contrato + parcelas). O saldo devedor
 * é o informado no contrato; sem ele, cai na soma das parcelas em aberto, que
 * superestima a dívida (carrega juros futuros) — o hint diz qual dos dois
 * está na tela.
 */
export function PropertyFinanceStats({
  propertyId,
  onOpenFinancing,
}: {
  propertyId: string
  onOpenFinancing: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: financeKeys.assetDebts('property', propertyId),
    queryFn: () => getAssetDebts('property', propertyId),
  })
  const debts = data?.debts ?? []

  if (!isLoading && debts.length === 0) {
    return (
      <Card sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="body2" color="text.secondary">
            Nenhum financiamento lançado. Os valores do imóvel aparecem aqui a partir do contrato e das
            parcelas.
          </Typography>
          <Button variant="outlined" onClick={onOpenFinancing} sx={{ flexShrink: 0 }}>
            Lançar financiamento
          </Button>
        </Stack>
      </Card>
    )
  }

  const open = debts.filter((d) => !d.settled)
  const contracts = debts.flatMap((d) => (d.contract ? [d.contract] : []))
  const financed = contracts.reduce((sum, c) => sum + (c.financed_cents ?? 0), 0)
  const downPayment = contracts.reduce((sum, c) => sum + (c.down_payment_cents ?? 0), 0)
  const purchase = financed > 0 ? financed + downPayment : null
  const paid = debts.reduce((sum, d) => sum + d.paid_cents, 0)
  const paidCount = debts.reduce((sum, d) => sum + d.paid_count, 0)
  const openCount = open.reduce((sum, d) => sum + d.open_count, 0)

  const informed = open.every((d) => d.contract?.balance_cents != null)
  const balance = open.reduce((sum, d) => sum + (d.contract?.balance_cents ?? d.open_cents), 0)
  const balanceDate = open.length === 1 ? open[0].contract?.balance_date : null

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard
          label="Valor de compra"
          value={formatCents(purchase)}
          loading={isLoading}
          hint={
            purchase == null
              ? 'Informe o valor financiado no contrato'
              : downPayment > 0
                ? `${formatCents(financed)} financiado + ${formatCents(downPayment)} de entrada`
                : 'Valor financiado no contrato'
          }
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard
          label="Já pago"
          value={formatCents(paid)}
          loading={isLoading}
          color="success"
          hint={`${paidCount} ${paidCount === 1 ? 'parcela' : 'parcelas'}`}
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard
          label="Saldo devedor"
          value={open.length === 0 ? 'Quitado' : formatCents(balance)}
          loading={isLoading}
          color={open.length === 0 ? 'success' : 'warning'}
          hint={
            open.length === 0
              ? undefined
              : informed
                ? balanceDate
                  ? `Informado em ${formatDate(balanceDate)}`
                  : 'Informado no contrato'
                : 'Soma das parcelas em aberto'
          }
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard
          label="Parcelas restantes"
          value={openCount}
          loading={isLoading}
          hint={
            openCount > 0 ? `${formatCents(open.reduce((s, d) => s + d.open_cents, 0))} a pagar` : undefined
          }
        />
      </Grid>
    </Grid>
  )
}
