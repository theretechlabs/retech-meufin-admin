import { useMemo, useState } from 'react'
import { Button, Card, Chip, IconButton, InputAdornment, TextField, Tooltip, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import HomeWorkRoundedIcon from '@mui/icons-material/HomeWorkRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { deleteProperty, listProperties, type Property } from '../api'
import { errorMessage, formatArea, formatCents, patrimonyKeys } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { PropertyFormDialog } from '../components/PropertyFormDialog'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { DataTable } from '@/components/tables/DataTable'
import { FilterBar } from '@/components/common/FilterBar'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'

const detailPath = (id: string) => `/dashboard/patrimonio/imoveis/${id}`

export default function PropertiesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { show } = useToast()
  const propertyType = useCatalog('patrimony.property_type')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [toDelete, setToDelete] = useState<Property | null>(null)

  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const params = useMemo(
    () => ({ limit: pageSize, offset: page * pageSize }),
    [pageSize, page],
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: patrimonyKeys.properties(params),
    queryFn: () => listProperties(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProperty(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patrimonyKeys.all })
      setToDelete(null)
      show('Imóvel excluído.')
    },
  })

  const properties = useMemo(() => {
    const items = data?.items ?? []
    if (!q.trim()) return items
    const lower = q.toLowerCase()
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.city ?? '').toLowerCase().includes(lower) ||
        (p.address ?? '').toLowerCase().includes(lower),
    )
  }, [data, q])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (p: Property) => {
    setEditing(p)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Imóveis"
        subtitle="Cadastre os imóveis da família e acompanhe valores, impostos e documentos de cada um."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Novo imóvel
          </Button>
        }
      />

      <FilterBar
        primary={
          <TextField
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar por nome, cidade, endereço…"
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : properties.length === 0 ? (
        <EmptyState
          icon={<HomeWorkRoundedIcon />}
          title="Nenhum imóvel encontrado"
          description={q ? 'Ajuste a busca.' : 'Cadastre o primeiro imóvel da família.'}
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo imóvel
            </Button>
          }
        />
      ) : (
        <Card>
          <DataTable
            rows={properties}
            getRowKey={(p) => p.id}
            size="medium"
            onRowClick={(p) => navigate(detailPath(p.id))}
            columns={[
              {
                key: 'name',
                header: 'Imóvel',
                mobile: 'title',
                cellSx: { fontWeight: 600 },
                render: (p) => (
                  <>
                    {p.name}
                    {p.address && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {p.address}
                      </Typography>
                    )}
                  </>
                ),
              },
              {
                key: 'type',
                header: 'Tipo',
                render: (p) => (
                  <Chip size="small" label={propertyType.labelOf(p.property_type)} variant="outlined" />
                ),
              },
              {
                key: 'city',
                header: 'Cidade',
                cellSx: { color: 'text.secondary' },
                render: (p) => (p.city ? `${p.city}${p.state ? `/${p.state}` : ''}` : '—'),
              },
              {
                key: 'area',
                header: 'Área',
                cellSx: { color: 'text.secondary' },
                render: (p) => formatArea(p.area_m2),
              },
              {
                key: 'value',
                header: 'Valor atual',
                align: 'right',
                mobile: 'value',
                cellSx: { fontWeight: 600 },
                render: (p) => formatCents(p.current_value_cents ?? p.purchase_value_cents),
              },
              {
                key: 'actions',
                header: 'Ações',
                align: 'right',
                mobile: 'actions',
                render: (p) => (
                  <>
                    <Tooltip title="Ver detalhes">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(detailPath(p.id))
                        }}
                      >
                        <OpenInNewRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(p)
                        }}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation()
                          setToDelete(p)
                        }}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                ),
              },
            ]}
          />
          <TablePaginationBR
            total={data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}

      {formOpen && (
        <PropertyFormDialog
          property={editing}
          onClose={() => setFormOpen(false)}
          // Recém-cadastrado: abre o imóvel para seguir com valores, impostos e documentos.
          onCreated={(created) => navigate(detailPath(created.id))}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir imóvel"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? Documentos e impostos vinculados também serão removidos. Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
