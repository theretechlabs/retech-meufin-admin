import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  TextField,
} from '@mui/material'
import ReceiptRoundedIcon from '@mui/icons-material/ReceiptRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { useQuery } from '@tanstack/react-query'
import { listFiscalDocuments } from '../api'
import { financeKeys, errorMessage } from '../constants'
import { formatDateBR } from '@/utils/dates'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { DataTable } from '@/components/tables/DataTable'
import { FilterBar } from '@/components/common/FilterBar'
import { PageHeader } from '@/features/health/components/PageHeader'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/features/health/components/StateViews'
import { ImportFiscalDialog } from '../components/ImportFiscalDialog'
import { useToast } from '@/providers/ToastProvider'
import { AutocompleteField } from '@/components/fields/AutocompleteField'

const EXTRACTION_LABEL: Record<string, string> = {
  pending: 'Aguardando leitura',
  processing: 'Lendo...',
  completed: 'Lido',
  extracted: 'Lido',
  failed: 'Falhou',
}

const EXTRACTION_COLOR: Record<
  string,
  'default' | 'info' | 'success' | 'error'
> = {
  pending: 'info',
  processing: 'info',
  completed: 'success',
  extracted: 'success',
  failed: 'error',
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Aguardando leitura' },
  { value: 'processing', label: 'Lendo...' },
  { value: 'extracted', label: 'Lido' },
  { value: 'failed', label: 'Falhou' },
]

const LINK_OPTIONS = [
  { value: 'true', label: 'Vinculados a despesa' },
  { value: 'false', label: 'Sem vínculo' },
]

export default function CuponsPage() {
  const { show } = useToast()
  const [importOpen, setImportOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [linked, setLinked] = useState('')

  const hasFilters = Boolean(query.trim() || status || linked)

  const params = useMemo(() => {
    const p: Parameters<typeof listFiscalDocuments>[0] = {
      limit: pageSize,
      offset: page * pageSize,
    }
    if (query.trim()) p.q = query.trim()
    if (status) p.status = status
    if (linked) p.linked = linked === 'true'
    return p
  }, [page, pageSize, query, status, linked])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...financeKeys.all, 'fiscal-documents', params] as const,
    queryFn: () => listFiscalDocuments(params),
  })

  const docs = data?.items ?? []

  return (
    <>
      <PageHeader
        title="Cupons e Notas"
        subtitle="Importe cupons e notas fiscais, extraia os itens e vincule à despesa que agrupa a compra."
        action={
          <Button
            variant="contained"
            startIcon={<UploadFileRoundedIcon />}
            onClick={() => setImportOpen(true)}
          >
            Importar cupom/nota
          </Button>
        }
      />

      <FilterBar
        activeCount={(status ? 1 : 0) + (linked ? 1 : 0)}
        primary={
          <TextField
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar pelo nome do arquivo…"
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
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3, md: 3.5 }}>
            <AutocompleteField
              label="Leitura"
              size="small"
              emptyLabel="Todas"
              value={status}
              onChange={(v) => {
                setStatus(v)
                setPage(0)
              }}
              options={STATUS_OPTIONS}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 3.5 }}>
            <AutocompleteField
              label="Vínculo"
              size="small"
              emptyLabel="Todos"
              value={linked}
              onChange={(v) => {
                setLinked(v)
                setPage(0)
              }}
              options={LINK_OPTIONS}
            />
          </Grid>
        </Grid>
      </FilterBar>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : docs.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<ReceiptRoundedIcon />}
            title="Nenhum cupom encontrado"
            description="Nenhum documento corresponde aos filtros. Ajuste a busca ou limpe os filtros."
            action={
              <Button
                variant="outlined"
                onClick={() => {
                  setQuery('')
                  setStatus('')
                  setLinked('')
                  setPage(0)
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<ReceiptRoundedIcon />}
            title="Nenhum cupom importado"
            description="Importe um cupom fiscal ou nota fiscal (PDF ou foto) para extrair os itens comprados."
            action={
              <Button
                variant="contained"
                startIcon={<UploadFileRoundedIcon />}
                onClick={() => setImportOpen(true)}
              >
                Importar cupom/nota
              </Button>
            }
          />
        )
      ) : (
        <Card>
          <DataTable
            rows={docs}
            getRowKey={(d) => d.id}
            size="medium"
            columns={[
              {
                key: 'file',
                header: 'Arquivo',
                mobile: 'title',
                cellSx: { fontWeight: 600 },
                render: (d) => d.original_file_name || d.file_name || '—',
              },
              {
                key: 'created',
                header: 'Importado em',
                render: (d) => (d.created_at ? formatDateBR(d.created_at) : '—'),
              },
              {
                key: 'extraction',
                header: 'Leitura',
                render: (d) => (
                  <Chip
                    size="small"
                    label={EXTRACTION_LABEL[d.extraction_status ?? ''] ?? d.extraction_status}
                    color={EXTRACTION_COLOR[d.extraction_status ?? ''] ?? 'default'}
                    variant="outlined"
                  />
                ),
              },
              {
                key: 'link',
                header: 'Vínculo',
                render: (d) =>
                  d.entry_id ? (
                    <Chip size="small" color="success" label="Vinculado a despesa" />
                  ) : (
                    <Chip size="small" variant="outlined" label="Sem vínculo" />
                  ),
              },
            ]}
          />
          <Divider />
          <TablePaginationBR
            total={data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}

      {importOpen && (
        <ImportFiscalDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onConfirmed={(msg) => show(msg)}
        />
      )}
    </>
  )
}
