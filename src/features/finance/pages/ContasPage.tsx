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
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  createAccount,
  deleteAccount,
  listAccountsPaged,
  updateAccount,
  type FinanceAccount,
  type FinanceAccountInput,
} from '../api'
import { ACCOUNT_KIND_LABEL, ACCOUNT_KIND_OPTIONS, errorMessage, financeKeys, ARCHIVED_FILTER_OPTIONS_F } from '../constants'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { AutocompleteField } from '@/components/fields/AutocompleteField'

type FormValues = FinanceAccountInput

const emptyForm: FormValues = {
  name: '',
  kind: 'corrente',
  bank_name: '',
  active: true,
  notes: '',
}

function AccountFormDialog({
  open,
  account,
  onClose,
}: {
  open: boolean
  account: FinanceAccount | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(account)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    values: account
      ? {
          name: account.name,
          kind: account.kind,
          bank_name: account.bank_name ?? '',
          active: account.active,
          notes: account.notes ?? '',
        }
      : emptyForm,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? updateAccount(account!.id, values) : createAccount(values),
    onSuccess: () => {
      show(isEdit ? 'Conta atualizada com sucesso.' : 'Conta criada com sucesso.')
      qc.invalidateQueries({ queryKey: financeKeys.accounts() })
      reset(emptyForm)
      onClose()
    },
  })

  const submit = handleSubmit((values) => {
    mutation.mutate({
      ...values,
      name: values.name.trim(),
      bank_name: values.bank_name?.trim() || null,
      notes: values.notes?.trim() || null,
    })
  })

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{isEdit ? 'Editar conta' : 'Nova conta'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Informe o nome da conta' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nome"
                placeholder="Ex.: Nubank PJ, Carteira, Itaú corrente"
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
            rules={{ required: true }}
            render={({ field }) => (
              <AutocompleteField
                label="Tipo"
                required
                value={field.value}
                onChange={field.onChange}
                options={ACCOUNT_KIND_OPTIONS}
                disableClearable
              />
            )}
          />
          <Controller
            name="bank_name"
            control={control}
            render={({ field }) => (
              <TextField {...field} value={field.value ?? ''} label="Banco (opcional)" fullWidth />
            )}
          />
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
                control={
                  <Switch
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                }
                label="Ativa"
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

export default function ContasPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceAccount | null>(null)
  const [toDelete, setToDelete] = useState<FinanceAccount | null>(null)

  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const params = useMemo(
    () => ({
      limit: pageSize,
      offset: page * pageSize,
      query: q.trim() || undefined,
      kind: kind || undefined,
      active: status === '' ? undefined : status === 'true',
    }),
    [pageSize, page, q, kind, status]
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...financeKeys.accounts(), params],
    queryFn: () => listAccountsPaged(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.accounts() })
      setToDelete(null)
      show('Conta excluída.')
    },
  })

  const accounts = useMemo(() => data?.items ?? [], [data])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (a: FinanceAccount) => {
    setEditing(a)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Contas"
        subtitle="Contas usadas para pagar e receber: corrente, poupança, carteira e digitais."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Nova conta
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
            placeholder="Buscar por nome ou banco…"
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
            label="Tipo"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 200 } }}
            emptyLabel="Todos"
            value={kind}
            onChange={(v) => {
              setKind(v)
              setPage(0)
            }}
            options={ACCOUNT_KIND_OPTIONS}
          />
          <AutocompleteField
            label="Status"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 200 } }}
            emptyLabel="Todas"
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            options={ARCHIVED_FILTER_OPTIONS_F}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<AccountBalanceRoundedIcon />}
          title="Nenhuma conta cadastrada"
          description={
            q || kind || status
              ? 'Ajuste a busca ou os filtros.'
              : 'Cadastre suas contas para informar de onde saiu (ou entrou) o dinheiro ao liquidar um lançamento.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Nova conta
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
                  <TableCell>Banco</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{a.name}</TableCell>
                    <TableCell>{ACCOUNT_KIND_LABEL[a.kind] ?? a.kind}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{a.bank_name || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={a.active ? 'Ativa' : 'Inativa'}
                        color={a.active ? 'success' : 'default'}
                        variant={a.active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(a)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(a)}>
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

      {formOpen && (
        <AccountFormDialog open={formOpen} account={editing} onClose={() => setFormOpen(false)} />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir conta"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
