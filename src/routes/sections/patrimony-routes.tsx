import type { ReactNode } from 'react'
import { PermissionGuard } from '@/auth/guard/permission-guard'
import PatrimonyDashboardPage from '@/features/patrimony/pages/PatrimonyDashboardPage'
import PropertiesPage from '@/features/patrimony/pages/PropertiesPage'
import PropertyDetailPage from '@/features/patrimony/pages/PropertyDetailPage'
import AssetTaxesPage from '@/features/patrimony/pages/AssetTaxesPage'

function guarded(subject: string, node: ReactNode): ReactNode {
  return (
    <PermissionGuard required={{ action: 'view', subject }} hasContent>
      {node}
    </PermissionGuard>
  )
}

/**
 * Rotas do módulo Patrimônio (imóveis + impostos de bens), montadas como filhas
 * de `/dashboard` em App.tsx.
 */
export const patrimonyRoutes: { path: string; element: ReactNode }[] = [
  { path: 'patrimonio', element: guarded('patrimony.dashboard', <PatrimonyDashboardPage />) },
  { path: 'patrimonio/imoveis', element: guarded('patrimony.properties', <PropertiesPage />) },
  {
    path: 'patrimonio/imoveis/:propertyId',
    element: guarded('patrimony.properties', <PropertyDetailPage />),
  },
  { path: 'patrimonio/impostos', element: guarded('patrimony.taxes', <AssetTaxesPage />) },
]
