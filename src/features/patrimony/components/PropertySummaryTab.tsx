import type { ReactNode } from 'react'
import { Box, Card, Grid, Stack, Typography } from '@mui/material'
import type { Property } from '../api'
import { formatArea } from '../constants'
import { PropertyFinanceStats } from './PropertyFinanceStats'

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
 * Resumo do imóvel: valores (vindos do financiamento, nunca digitados) e
 * identificação.
 */
export function PropertySummaryTab({
  property,
  onOpenFinancing,
}: {
  property: Property
  onOpenFinancing: () => void
}) {
  return (
    <Stack spacing={3}>
      <PropertyFinanceStats propertyId={property.id} onOpenFinancing={onOpenFinancing} />

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
    </Stack>
  )
}
