import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
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
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createExamResult,
  deleteExamResult,
  listExamResultsPaged,
  listFamilyMembers,
  listLabs,
  type ExamResult,
  type ExamResultInput,
  type ExamResultItem,
  type Marker,
} from '../api'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { errorMessage, healthKeys } from '../constants'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews'
import { MarkerAutocomplete } from '../components/MarkerAutocomplete'
import { ImportExamResultDialog } from '../components/ImportExamResultDialog'
import { ExamResultDetailDialog } from '../components/ExamResultDetailDialog'
import { useToast } from '@/providers/ToastProvider'
import { formatDateBR } from '@/utils/dates'

type DraftItem = {
  key: string
  marker: Marker | null
  raw_marker_name: string
  result_value: string
  unit: string
  reference_min: string
  reference_max: string
  reference_text: string
}

function newDraftItem(): DraftItem {
  return {
    key: crypto.randomUUID(),
    marker: null,
    raw_marker_name: '',
    result_value: '',
    unit: '',
    reference_min: '',
    reference_max: '',
    reference_text: '',
  }
}

function ResultFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { show } = useToast()
  const sourceTypeCatalog = useCatalog('health.exam_source_type')
  const resultStatusCatalog = useCatalog('health.exam_result_status')
  const [familyMemberId, setFamilyMemberId] = useState('')
  const [labId, setLabId] = useState('')
  const [examDate, setExamDate] = useState('')
  const [sourceType, setSourceType] = useState('manual')
  const [status, setStatus] = useState('draft')
  const [summary, setSummary] = useState('')
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()])
  const [formError, setFormError] = useState<string | null>(null)

  const { data: members } = useQuery({
    queryKey: healthKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })
  const { data: labs } = useQuery({ queryKey: healthKeys.labs(), queryFn: listLabs })

  const mutation = useMutation({
    mutationFn: (input: ExamResultInput) => createExamResult(input),
    onSuccess: () => {
      show('Resultado de exame criado com sucesso.')
      qc.invalidateQueries({ queryKey: healthKeys.examResults() })
      qc.invalidateQueries({ queryKey: healthKeys.dashboard() })
      onClose()
    },
  })

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }
  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key))
  const addItem = () => setItems((prev) => [...prev, newDraftItem()])

  const submit = () => {
    setFormError(null)
    if (!familyMemberId) {
      setFormError('Selecione o membro da família.')
      return
    }
    if (!examDate) {
      setFormError('Informe a data do exame.')
      return
    }
    const validItems = items.filter(
      (it) => (it.marker || it.raw_marker_name.trim()) && it.result_value.trim()
    )
    // Laudo descritivo (imagem sem medidas): aceito sem itens, com resumo.
    if (validItems.length === 0 && !summary.trim()) {
      setFormError('Adicione ao menos um item — ou preencha o resumo para laudo descritivo (ex.: ultrassom sem alterações).')
      return
    }

    const payloadItems: ExamResultItem[] = validItems.map((it) => ({
      marker_id: it.marker?.id ?? undefined,
      raw_marker_name: it.marker ? undefined : it.raw_marker_name.trim() || undefined,
      result_value: it.result_value.trim(),
      unit: it.unit.trim() || it.marker?.canonical_unit || undefined,
      reference_min: it.reference_min ? Number(it.reference_min) : undefined,
      reference_max: it.reference_max ? Number(it.reference_max) : undefined,
      reference_text: it.reference_text.trim() || undefined,
    }))

    mutation.mutate({
      family_member_id: familyMemberId,
      lab_id: labId || undefined,
      exam_date: examDate,
      source_type: sourceType,
      status,
      summary: summary.trim() || undefined,
      items: payloadItems,
    })
  }

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Novo resultado de exame</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {formError && <ErrorState message={formError} />}
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <AutocompleteField
              label="Membro da família"
              value={familyMemberId}
              onChange={setFamilyMemberId}
              options={(members ?? []).map((m) => ({ value: m.id, label: m.full_name }))}
              required
              disableClearable
            />
            <AutocompleteField
              label="Laboratório"
              emptyLabel="Nenhum"
              value={labId}
              onChange={setLabId}
              options={(labs ?? []).map((l) => ({ value: l.id, label: l.name }))}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="date"
              label="Data do exame"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <AutocompleteField
              label="Origem"
              value={sourceType}
              onChange={setSourceType}
              options={sourceTypeCatalog.options}
              loading={sourceTypeCatalog.isLoading}
              disableClearable
            />
            <AutocompleteField
              label="Status"
              value={status}
              onChange={setStatus}
              options={resultStatusCatalog.options}
              loading={resultStatusCatalog.isLoading}
              disableClearable
            />
          </Stack>

          <TextField
            label="Resumo"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            fullWidth
            multiline
            minRows={1}
          />

          <Divider>
            <Typography variant="overline" color="text.secondary">
              Itens do exame
            </Typography>
          </Divider>

          <Stack spacing={2}>
            {items.map((it, idx) => (
              <Card key={it.key} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={700}>
                      Item {idx + 1}
                    </Typography>
                    {items.length > 1 && (
                      <IconButton size="small" color="error" onClick={() => removeItem(it.key)}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                  <MarkerAutocomplete
                    value={it.marker}
                    onChange={(m) =>
                      updateItem(it.key, {
                        marker: m,
                        unit: m?.canonical_unit ?? it.unit,
                      })
                    }
                  />
                  {!it.marker && (
                    <TextField
                      label="Nome do marcador (texto livre)"
                      value={it.raw_marker_name}
                      onChange={(e) => updateItem(it.key, { raw_marker_name: e.target.value })}
                      size="small"
                      fullWidth
                      helperText="Use quando o marcador ainda não estiver no catálogo."
                    />
                  )}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      label="Valor"
                      value={it.result_value}
                      onChange={(e) => updateItem(it.key, { result_value: e.target.value })}
                      size="small"
                      fullWidth
                      required
                    />
                    <TextField
                      label="Unidade"
                      value={it.unit}
                      onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                      size="small"
                      fullWidth
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      label="Ref. mín."
                      type="number"
                      value={it.reference_min}
                      onChange={(e) => updateItem(it.key, { reference_min: e.target.value })}
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Ref. máx."
                      type="number"
                      value={it.reference_max}
                      onChange={(e) => updateItem(it.key, { reference_max: e.target.value })}
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Ref. (texto)"
                      value={it.reference_text}
                      onChange={(e) => updateItem(it.key, { reference_text: e.target.value })}
                      size="small"
                      fullWidth
                    />
                  </Stack>
                </Stack>
              </Card>
            ))}
            <Button
              startIcon={<AddRoundedIcon />}
              onClick={addItem}
              variant="outlined"
              sx={{ alignSelf: 'flex-start' }}
            >
              Adicionar item
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} variant="contained" disabled={mutation.isPending}>
          Criar resultado
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function ExamResultsPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const resultStatusCatalog = useCatalog('health.exam_result_status')
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [toDelete, setToDelete] = useState<ExamResult | null>(null)
  const [detail, setDetail] = useState<{ id: string; title: string } | null>(null)

  const [q, setQ] = useState('')
  const [memberId, setMemberId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const params = useMemo(
    () => ({
      limit: pageSize,
      offset: page * pageSize,
      query: q.trim() || undefined,
      family_member_id: memberId || undefined,
      status: status || undefined,
    }),
    [pageSize, page, q, memberId, status]
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...healthKeys.examResults(), params],
    queryFn: () => listExamResultsPaged(params),
  })
  const { data: members } = useQuery({
    queryKey: healthKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })

  const memberName = useMemo(() => {
    const map = new Map((members ?? []).map((m) => [m.id, m.full_name]))
    return (id: string) => map.get(id) ?? id
  }, [members])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExamResult(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.examResults() })
      qc.invalidateQueries({ queryKey: healthKeys.dashboard() })
      setToDelete(null)
      show('Resultado excluído.')
    },
  })

  const results = data?.items ?? []

  return (
    <>
      <PageHeader
        title="Resultados"
        subtitle="Registre resultados de exames com seus itens e faixas de referência."
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<UploadFileRoundedIcon />}
              onClick={() => setImportOpen(true)}
            >
              Importar exame (PDF)
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setFormOpen(true)}>
              Novo resultado
            </Button>
          </Stack>
        }
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar no resumo…"
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
          <AutocompleteField
            label="Membro"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 200 } }}
            emptyLabel="Todos"
            value={memberId}
            onChange={(v) => {
              setMemberId(v)
              setPage(0)
            }}
            options={(members ?? []).map((m) => ({ value: m.id, label: m.full_name }))}
          />
          <AutocompleteField
            label="Status"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 200 } }}
            emptyLabel="Todos"
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            options={resultStatusCatalog.options}
            loading={resultStatusCatalog.isLoading}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<DescriptionRoundedIcon />}
          title="Nenhum resultado cadastrado"
          description={
            q || memberId || status
              ? 'Ajuste a busca ou os filtros.'
              : 'Registre o primeiro resultado de exame para acompanhar a evolução.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setFormOpen(true)}>
              Novo resultado
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Membro</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell>Itens</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Resumo</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{memberName(r.family_member_id)}</TableCell>
                    <TableCell>{formatDateBR(r.exam_date)}</TableCell>
                    <TableCell>{r.items?.length ?? 0}</TableCell>
                    <TableCell>
                      <Chip size="small" label={resultStatusCatalog.labelOf(r.status)} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.summary || '—'}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ver itens">
                        <IconButton
                          size="small"
                          onClick={() =>
                            setDetail({
                              id: r.id,
                              title: `${memberName(r.family_member_id)} — ${formatDateBR(r.exam_date)}`,
                            })
                          }
                        >
                          <VisibilityRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(r)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePaginationBR
            total={data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}

      {formOpen && <ResultFormDialog open={formOpen} onClose={() => setFormOpen(false)} />}

      {detail && (
        <ExamResultDetailDialog
          resultId={detail.id}
          title={detail.title}
          open
          onClose={() => setDetail(null)}
        />
      )}

      {importOpen && (
        <ImportExamResultDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onConfirmed={(msg) => show(msg)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir resultado"
        description="Tem certeza que deseja excluir este resultado e seus itens? Esta ação não pode ser desfeita."
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
