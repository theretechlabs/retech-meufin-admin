import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { createLab, deleteLab, listLabsPaged, updateLab, type Lab, type LabInput } from '../api'
import { errorMessage, healthKeys, LAB_KIND_LABEL, LAB_KIND_OPTIONS } from '../constants'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { ACTIVE_FILTER_OPTIONS } from '@/components/fields/options'

type FormValues = LabInput

const emptyForm: FormValues = {
  name: '',
  kind: 'laboratorio',
  website_url: '',
  exam_results_url: '',
  contact_phone: '',
  address: '',
  notes: '',
  active: true,
}

function LabFormDialog({
  open,
  lab,
  onClose,
}: {
  open: boolean
  lab: Lab | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(lab)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    values: lab
      ? {
          name: lab.name,
          kind: lab.kind ?? 'laboratorio',
          website_url: lab.website_url ?? '',
          exam_results_url: lab.exam_results_url ?? '',
          contact_phone: lab.contact_phone ?? '',
          address: lab.address ?? '',
          notes: lab.notes ?? '',
          active: lab.active,
        }
      : emptyForm,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => (isEdit ? updateLab(lab!.id, values) : createLab(values)),
    onSuccess: () => {
      show(isEdit ? 'Local de saúde atualizado com sucesso.' : 'Local de saúde criado com sucesso.')
      qc.invalidateQueries({ queryKey: healthKeys.labs() })
      reset(emptyForm)
      onClose()
    },
  })

  const submit = handleSubmit((values) => {
    mutation.mutate({
      ...values,
      website_url: values.website_url || null,
      exam_results_url: values.exam_results_url || null,
      contact_phone: values.contact_phone || null,
      address: values.address || null,
      notes: values.notes || null,
    })
  })

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? 'Editar local de saúde' : 'Novo local de saúde'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Informe o nome do local' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nome"
                fullWidth
                required
                error={Boolean(errors.name)}
                helperText={errors.name?.message}
              />
            )}
          />
          <Controller
            name="kind"
            control={control}
            render={({ field }) => (
              <AutocompleteField
                label="Tipo de local"
                value={field.value}
                onChange={field.onChange}
                options={LAB_KIND_OPTIONS}
                disableClearable
              />
            )}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="website_url"
              control={control}
              render={({ field }) => (
                <TextField {...field} value={field.value ?? ''} label="Website" fullWidth />
              )}
            />
            <Controller
              name="exam_results_url"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Portal de resultados"
                  fullWidth
                />
              )}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="contact_phone"
              control={control}
              render={({ field }) => (
                <TextField {...field} value={field.value ?? ''} label="Telefone" fullWidth />
              )}
            />
            <Controller
              name="address"
              control={control}
              render={({ field }) => (
                <TextField {...field} value={field.value ?? ''} label="Endereço" fullWidth />
              )}
            />
          </Stack>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                label="Observações"
                fullWidth
                multiline
                minRows={2}
              />
            )}
          />
          <Controller
            name="active"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Ativo"
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} variant="contained" disabled={mutation.isPending}>
          {isEdit ? 'Salvar' : 'Criar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function LabsPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Lab | null>(null)
  const [toDelete, setToDelete] = useState<Lab | null>(null)

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const params = useMemo(
    () => ({
      limit: pageSize,
      offset: page * pageSize,
      query: q.trim() || undefined,
      active: status === '' ? undefined : status === 'true',
    }),
    [pageSize, page, q, status]
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...healthKeys.labs(), params],
    queryFn: () => listLabsPaged(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLab(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.labs() })
      setToDelete(null)
      show('Local excluído.')
    },
  })

  const labs = useMemo(() => data?.items ?? [], [data])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (l: Lab) => {
    setEditing(l)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Locais de Saúde"
        subtitle="Cadastre laboratórios, clínicas, hospitais, consultórios e óticas da família."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Novo local
          </Button>
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
            placeholder="Buscar por nome…"
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
            label="Status"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 220 } }}
            emptyLabel="Todos"
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            options={ACTIVE_FILTER_OPTIONS}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : labs.length === 0 ? (
        <EmptyState
          icon={<ScienceRoundedIcon />}
          title="Nenhum local cadastrado"
          description={
            q || status
              ? 'Ajuste a busca ou os filtros.'
              : 'Adicione um local de saúde para associar a exames e consultas.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo local
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Telefone</TableCell>
                  <TableCell>Portal</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {labs.map((l) => (
                  <TableRow key={l.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{l.name}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={LAB_KIND_LABEL[l.kind] ?? l.kind} />
                    </TableCell>
                    <TableCell>{l.contact_phone || '—'}</TableCell>
                    <TableCell>
                      {l.exam_results_url ? (
                        <Link
                          href={l.exam_results_url}
                          target="_blank"
                          rel="noopener"
                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                        >
                          Abrir <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={l.active ? 'Ativo' : 'Inativo'}
                        color={l.active ? 'success' : 'default'}
                        variant={l.active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(l)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(l)}>
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

      {formOpen && <LabFormDialog open={formOpen} lab={editing} onClose={() => setFormOpen(false)} />}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir local de saúde"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
