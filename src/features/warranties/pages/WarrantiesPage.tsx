import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteWarranty, getWarrantySummary, listWarranties, type Warranty } from '../api'
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_OPTIONS,
  errorMessage,
  formatDate,
  formatMoneyCents,
  warrantyKeys,
  warrantyProgressPct,
} from '../constants'
import { WarrantyDocumentsDialog } from '../components/WarrantyDocumentsDialog'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { WarrantyFormDialog } from '../components/WarrantyFormDialog'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'

type SvgIconComponent = React.ElementType

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
  hint,
}: {
  title: string
  value: string
  icon: SvgIconComponent
  color?: string
  hint?: string
}) {
  const theme = useTheme()
  const c = color ?? theme.palette.primary.main
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(c, 0.12),
              color: c,
            }}
          >
            <Icon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {title}
            </Typography>
            <Typography variant="h5" fontWeight={800} noWrap>
              {value}
            </Typography>
            {hint && (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

function WarrantyProgress({ w }: { w: Warranty }) {
  const theme = useTheme()
  const pct = warrantyProgressPct(w.purchase_date, w.expires_at)
  const color =
    w.status === 'expirada'
      ? theme.palette.error.main
      : w.status === 'expira_em_breve'
        ? theme.palette.warning.main
        : theme.palette.success.main
  const label =
    w.days_remaining < 0
      ? `Expirou há ${Math.abs(w.days_remaining)} d`
      : `Faltam ${w.days_remaining} d`
  return (
    <Box sx={{ minWidth: 140 }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: alpha(color, 0.15),
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {label} • vence {formatDate(w.expires_at)}
      </Typography>
    </Box>
  )
}

export default function WarrantiesPage() {
  const theme = useTheme()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Warranty | null>(null)
  const [docsFor, setDocsFor] = useState<Warranty | null>(null)
  const [toDelete, setToDelete] = useState<Warranty | null>(null)

  const summaryQuery = useQuery({
    queryKey: warrantyKeys.summary(),
    queryFn: getWarrantySummary,
  })

  const params = useMemo(
    () => ({ limit: 200, offset: 0, category: category || undefined, status: status || undefined, q: search || undefined }),
    [category, status, search],
  )

  const listQuery = useQuery({
    queryKey: warrantyKeys.list(params),
    queryFn: () => listWarranties(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (w: Warranty) => deleteWarranty(w.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warrantyKeys.all })
      setToDelete(null)
    },
  })

  const summary = summaryQuery.data
  const items = listQuery.data?.items ?? []

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (w: Warranty) => {
    setEditing(w)
    setFormOpen(true)
  }

  return (
    <Box>
      <PageHeader
        title="Garantias"
        subtitle="Controle a garantia de tudo que a família compra — eletrodomésticos, eletrônicos, veículos, imóveis e compras com garantia estendida."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Nova garantia
          </Button>
        }
      />

      {/* Cards de resumo */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard
            title="Garantias vigentes"
            value={String(summary ? summary.total_active - summary.expired_this_year : '—')}
            icon={VerifiedUserRoundedIcon}
            color={theme.palette.success.main}
            hint={summary ? `${summary.total_active} cadastradas` : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard
            title="Expiram em 60 dias"
            value={summary ? String(summary.expiring_in_60_count) : '—'}
            icon={EventBusyRoundedIcon}
            color={theme.palette.warning.main}
            hint={summary ? `${summary.expiring_in_30_count} em 30 dias` : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard
            title="Valor coberto"
            value={summary ? formatMoneyCents(summary.total_covered_cents) : '—'}
            icon={PaidRoundedIcon}
            color={theme.palette.primary.main}
            hint="Itens ainda na garantia"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard
            title="Expiradas no ano"
            value={summary ? String(summary.expired_this_year) : '—'}
            icon={ShieldRoundedIcon}
            color={theme.palette.error.main}
          />
        </Grid>
      </Grid>

      {/* Filtros */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por item ou marca…"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <AutocompleteField
              label="Categoria"
              emptyLabel="Todas"
              value={category}
              onChange={setCategory}
              options={CATEGORY_OPTIONS.map((o) => ({
                value: o.value,
                label: `${CATEGORY_ICON[o.value]} ${o.label}`,
              }))}
              fullWidth={false}
              sx={{ minWidth: 200 }}
            />
            <AutocompleteField
              label="Situação"
              emptyLabel="Todas"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
              fullWidth={false}
              sx={{ minWidth: 200 }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Tabela */}
      {listQuery.isLoading ? (
        <LoadingState />
      ) : listQuery.isError ? (
        <ErrorState message={errorMessage(listQuery.error)} onRetry={listQuery.refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<VerifiedUserRoundedIcon />}
          title="Nenhuma garantia encontrada"
          description="Cadastre a primeira garantia para acompanhar prazos e não perder cobertura."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Nova garantia
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Compra</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>Garantia</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((w) => (
                  <TableRow key={w.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {w.item_name}
                      </Typography>
                      {(w.brand || w.model) && (
                        <Typography variant="caption" color="text.secondary">
                          {[w.brand, w.model].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${CATEGORY_ICON[w.category]} ${CATEGORY_LABEL[w.category]}`}
                      />
                    </TableCell>
                    <TableCell>{formatDate(w.purchase_date)}</TableCell>
                    <TableCell>{formatMoneyCents(w.price_cents)}</TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS_COLOR[w.status]} label={STATUS_LABEL[w.status]} />
                    </TableCell>
                    <TableCell>
                      <WarrantyProgress w={w} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Documentos">
                        <IconButton size="small" onClick={() => setDocsFor(w)}>
                          <FolderOpenRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(w)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(w)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {formOpen && (
        <WarrantyFormDialog warranty={editing} onClose={() => setFormOpen(false)} />
      )}
      {docsFor && <WarrantyDocumentsDialog warranty={docsFor} onClose={() => setDocsFor(null)} />}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir garantia"
        description={`Excluir a garantia de "${toDelete?.item_name}"? Os documentos anexados também serão removidos.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete)}
        onClose={() => setToDelete(null)}
      />
    </Box>
  )
}
