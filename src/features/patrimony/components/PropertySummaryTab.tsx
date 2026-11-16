import { useState, type ReactNode } from 'react'
import { Box, Button, Card, Grid, Stack, Typography } from '@mui/material'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { StatCard } from '@/components/common/StatCard'
import type { Property } from '../api'
import { formatArea, formatCents, formatDate, formatPct } from '../constants'
import { PropertyValuesDialog } from './PropertyValuesDialog'

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
        {children}
      </Typography>
    </Box>
  )
}

/**
 * Resumo do imóvel: valores (compra, atual, valorização) e identificação.
 * `extraStats` recebe indicadores de outros módulos (ex.: financiamento).
 */
export function PropertySummaryTab({ property, extraStats }: { property: Property; extraStats?: ReactNode }) {
  const [valuesOpen, setValuesOpen] = useState(false)
  const purchase = property.purchase_value_cents ?? null
  const current = property.current_value_cents ?? null
  const gain = purchase != null && current != null ? current - purchase : null
  const gainPct = gain != null && purchase ? (gain / purchase) * 100 : null

  return (
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Valores
          </Typography>
          <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => setValuesOpen(true)}>
            Editar valores
          </Button>
        </Stack>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              label="Valor de compra"
              value={formatCents(purchase)}
              hint={property.purchase_date ? `Comprado em ${formatDate(property.purchase_date)}` : undefined}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard label="Valor atual" value={formatCents(current)} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              label="Valorização"
              value={formatCents(gain)}
              hint={gainPct != null ? formatPct(gainPct) : undefined}
              color={gain == null ? undefined : gain >= 0 ? 'success' : 'error'}
            />
          </Grid>
          {extraStats}
        </Grid>
      </Box>

      <Card sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
          Identificação
        </Typography>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DetailItem label="Endereço">{property.address || '—'}</DetailItem>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <DetailItem label="Cidade / UF">
              {property.city ? `${property.city}${property.state ? `/${property.state}` : ''}` : '—'}
            </DetailItem>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <DetailItem label="CEP">{property.zip_code || '—'}</DetailItem>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <DetailItem label="Matrícula">{property.registration_number || '—'}</DetailItem>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <DetailItem label="Área">{formatArea(property.area_m2)}</DetailItem>
          </Grid>
          {property.notes && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailItem label="Observações">{property.notes}</DetailItem>
            </Grid>
          )}
        </Grid>
      </Card>

      {valuesOpen && <PropertyValuesDialog property={property} onClose={() => setValuesOpen(false)} />}
    </Stack>
  )
}
