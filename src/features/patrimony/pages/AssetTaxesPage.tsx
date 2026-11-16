import { Button } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { PageHeader } from '@/features/health/components/PageHeader'
import { AssetTaxesList } from '../components/AssetTaxesList'

export default function AssetTaxesPage() {
  return (
    <AssetTaxesList
      header={(openCreate) => (
        <PageHeader
          title="Impostos de bens"
          subtitle="IPTU, IPVA, condomínio e outras taxas dos imóveis e veículos da família."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo imposto
            </Button>
          }
        />
      )}
    />
  )
}
