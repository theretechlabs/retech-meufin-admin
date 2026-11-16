import { useState } from 'react'
import { Box, Button, Chip, IconButton, Stack, Tab, Tabs, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { AssetFinanceTab } from '@/features/finance/components/AssetFinanceTab'
import { ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { getProperty } from '../api'
import { errorMessage, patrimonyKeys } from '../constants'
import { AssetTaxesList } from '../components/AssetTaxesList'
import { PropertyDebtStats } from '../components/PropertyDebtStats'
import { PropertyDocumentsPanel } from '../components/PropertyDocumentsPanel'
import { PropertyFormDialog } from '../components/PropertyFormDialog'
import { PropertySummaryTab } from '../components/PropertySummaryTab'

const TABS = [
  { slug: 'resumo', label: 'Resumo' },
  { slug: 'financiamento', label: 'Financiamento' },
  { slug: 'impostos', label: 'Impostos e taxas' },
  { slug: 'documentos', label: 'Documentos' },
] as const

type TabSlug = (typeof TABS)[number]['slug']

export default function PropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>()
  const navigate = useNavigate()
  const propertyType = useCatalog('patrimony.property_type')
  const [editOpen, setEditOpen] = useState(false)

  // A aba vive na URL (`?aba=`): dá para linkar direto e voltar no histórico.
  const [search, setSearch] = useSearchParams()
  const tab: TabSlug = TABS.find((t) => t.slug === search.get('aba'))?.slug ?? 'resumo'

  const {
    data: property,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: patrimonyKeys.property(propertyId!),
    queryFn: () => getProperty(propertyId!),
    enabled: Boolean(propertyId),
  })

  if (isLoading) return <LoadingState />
  if (isError || !property) return <ErrorState message={errorMessage(error)} onRetry={refetch} />

  const location = [
    property.address,
    property.city && `${property.city}${property.state ? `/${property.state}` : ''}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate('/dashboard/patrimonio/imoveis')} size="small" sx={{ mt: 0.5 }}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box flex={1} minWidth={0}>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Typography variant="h5" fontWeight={800}>
              {property.name}
            </Typography>
            <Chip size="small" variant="outlined" label={propertyType.labelOf(property.property_type)} />
          </Stack>
          {location && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {location}
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<EditRoundedIcon />}
          onClick={() => setEditOpen(true)}
        >
          Editar
        </Button>
      </Stack>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, slug: TabSlug) =>
            setSearch(slug === 'resumo' ? {} : { aba: slug }, { replace: true })
          }
          variant="scrollable"
          scrollButtons="auto"
        >
          {TABS.map((t) => (
            <Tab key={t.slug} value={t.slug} label={t.label} />
          ))}
        </Tabs>
      </Box>

      {tab === 'resumo' && (
        <PropertySummaryTab
          property={property}
          extraStats={
            <PropertyDebtStats propertyId={property.id} currentValueCents={property.current_value_cents} />
          }
        />
      )}
      {tab === 'financiamento' && (
        <AssetFinanceTab
          assetType="property"
          assetId={property.id}
          assetName={property.name}
          purchaseDate={property.purchase_date}
        />
      )}
      {tab === 'impostos' && (
        <AssetTaxesList
          propertyId={property.id}
          header={(openCreate) => (
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
              <Button variant="contained" size="small" startIcon={<AddRoundedIcon />} onClick={openCreate}>
                Novo imposto
              </Button>
            </Stack>
          )}
        />
      )}
      {tab === 'documentos' && <PropertyDocumentsPanel propertyId={property.id} />}

      {editOpen && <PropertyFormDialog property={property} onClose={() => setEditOpen(false)} />}
    </>
  )
}
