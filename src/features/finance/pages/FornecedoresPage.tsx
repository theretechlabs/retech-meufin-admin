import { useMemo, useState, useCallback } from 'react'
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
  MenuItem,
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
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import {
  createSupplier,
  deleteSupplier,
  listSuppliersPaged,
  updateSupplier,
  type Supplier,
  type SupplierInput,
} from '../api'
import {
  errorMessage,
  financeKeys,
  SUPPLIER_BILLING_LABEL,
  SUPPLIER_BILLING_OPTIONS,
  SUPPLIER_CATEGORY_LABEL,
  SUPPLIER_CATEGORY_OPTIONS,
  BANK_ACCOUNT_TYPE_OPTIONS,
} from '../constants'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { ACTIVE_FILTER_OPTIONS } from '@/components/fields/options'

type FormValues = SupplierInput

const emptyForm: FormValues = {
  name: '',
  category: 'outros',
  default_billing_type: null,
  pix_key: '',
  pix_key_holder: '',
  bank_name: '',
  bank_agency: '',
  bank_account: '',
  bank_account_type: '',
  notes: '',
  active: true,
}

// Quais grupos de campos exibir por forma de cobrança
const BILLING_VISIBILITY: Record<
  string,
  { pix: boolean; bank: boolean; bankDetails: boolean }
> = {
  pix:              { pix: true,  bank: false, bankDetails: false },
  boleto:           { pix: false, bank: true,  bankDetails: false },
  cartao_credito:   { pix: false, bank: false, bankDetails: false },
  debito_automatico:{ pix: false, bank: true,  bankDetails: true  },
  debito:           { pix: false, bank: true,  bankDetails: true  },
  transferencia:    { pix: true,  bank: true,  bankDetails: true  },
  desconto_folha:   { pix: false, bank: false, bankDetails: false },
}

function SupplierFormDialog({
  open,
  supplier,
  onClose,
}: {
  open: boolean
  supplier: Supplier | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(supplier)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    values: supplier
      ? {
          name: supplier.name,
          category: supplier.category,
          default_billing_type: supplier.default_billing_type ?? null,
          pix_key: supplier.pix_key ?? '',
          pix_key_holder: supplier.pix_key_holder ?? '',
          bank_name: supplier.bank_name ?? '',
          bank_agency: supplier.bank_agency ?? '',
          bank_account: supplier.bank_account ?? '',
          bank_account_type: supplier.bank_account_type ?? '',
          notes: supplier.notes ?? '',
          active: supplier.active,
        }
      : emptyForm,
  })

  const billingType = useWatch({ control, name: 'default_billing_type' })
  const vis = BILLING_VISIBILITY[billingType ?? ''] ?? { pix: false, bank: false, bankDetails: false }

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? updateSupplier(supplier!.id, values) : createSupplier(values),
    onSuccess: () => {
      show(isEdit ? 'Fornecedor atualizado com sucesso.' : 'Fornecedor criado com sucesso.')
      qc.invalidateQueries({ queryKey: financeKeys.suppliers() })
      reset(emptyForm)
      onClose()
    },
  })

  const submit = handleSubmit(
    useCallback(
      (values: FormValues) => {
        const v = BILLING_VISIBILITY[values.default_billing_type ?? ''] ?? { pix: false, bank: false, bankDetails: false }
        mutation.mutate({
          ...values,
          name: values.name.trim(),
          pix_key: v.pix ? values.pix_key?.trim() || null : null,
          pix_key_holder: v.pix ? values.pix_key_holder?.trim() || null : null,
          bank_name: v.bank ? values.bank_name?.trim() || null : null,
          bank_agency: v.bankDetails ? values.bank_agency?.trim() || null : null,
          bank_account: v.bankDetails ? values.bank_account?.trim() || null : null,
          bank_account_type: v.bankDetails ? values.bank_account_type?.trim() || null : null,
          notes: values.notes?.trim() || null,
          default_billing_type: values.default_billing_type || null,
        })
      },
      [mutation]
    )
  )

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? 'Editar fornecedor' : 'Novo fornecedor'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Informe o nome do fornecedor' }}
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
            name="category"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField {...field} select label="Categoria" fullWidth required>
                {SUPPLIER_CATEGORY_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            name="default_billing_type"
            control={control}
            render={({ field }) => (
              <AutocompleteField
                label="Forma de cobrança padrão"
                emptyLabel="Nenhuma"
                value={field.value ?? ''}
                onChange={field.onChange}
                options={SUPPLIER_BILLING_OPTIONS}
              />
            )}
          />

          {/* Chave Pix + Titular — visível para: pix, transferência */}
          {vis.pix && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="pix_key"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Chave Pix"
                    fullWidth
                    placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                  />
                )}
              />
              <Controller
                name="pix_key_holder"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Titular da chave"
                    fullWidth
                    placeholder="Nome registrado no Pix"
                  />
                )}
              />
            </Stack>
          )}

          {/* Banco — visível para: boleto, débito automático, débito, transferência */}
          {vis.bank && (
            <Controller
              name="bank_name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Banco"
                  fullWidth
                />
              )}
            />
          )}

          {/* Agência, conta e tipo — visível para: débito automático, débito, transferência */}
          {vis.bankDetails && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="bank_agency"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Agência"
                    sx={{ minWidth: 120 }}
                  />
                )}
              />
              <Controller
                name="bank_account"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Conta"
                    fullWidth
                  />
                )}
              />
              <Controller
                name="bank_account_type"
                control={control}
                render={({ field }) => (
                  <AutocompleteField
                    label="Tipo"
                    fullWidth={false}
                    sx={{ minWidth: 140 }}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={BANK_ACCOUNT_TYPE_OPTIONS}
                    disableClearable
                  />
                )}
              />
            </Stack>
          )}

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

export default function FornecedoresPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [toDelete, setToDelete] = useState<Supplier | null>(null)

  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const params = useMemo(
    () => ({
      limit: pageSize,
      offset: page * pageSize,
      query: q.trim() || undefined,
      category: category || undefined,
      active: status === '' ? undefined : status === 'true',
    }),
    [pageSize, page, q, category, status]
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...financeKeys.suppliers(), params],
    queryFn: () => listSuppliersPaged(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.suppliers() })
      setToDelete(null)
      show('Fornecedor excluído.')
    },
  })

  const suppliers = useMemo(() => data?.items ?? [], [data])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (s: Supplier) => {
    setEditing(s)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Fornecedores"
        subtitle="Gerencie os fornecedores vinculáveis às despesas. Globais são geridos pelo sistema."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Novo fornecedor
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
            label="Categoria"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 220 } }}
            emptyLabel="Todas"
            value={category}
            onChange={(v) => {
              setCategory(v)
              setPage(0)
            }}
            options={SUPPLIER_CATEGORY_OPTIONS}
          />
          <AutocompleteField
            label="Status"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 180 } }}
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
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={<StorefrontRoundedIcon />}
          title="Nenhum fornecedor encontrado"
          description={
            q || category || status
              ? 'Ajuste a busca ou os filtros.'
              : 'Adicione o primeiro fornecedor para vincular às despesas.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo fornecedor
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
                  <TableCell>Categoria</TableCell>
                  <TableCell>Cobrança padrão</TableCell>
                  <TableCell>Origem</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                    <TableCell>{SUPPLIER_CATEGORY_LABEL[s.category] ?? s.category}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {s.default_billing_type
                        ? SUPPLIER_BILLING_LABEL[s.default_billing_type] ?? s.default_billing_type
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={s.is_global ? 'Global' : 'Meu workspace'}
                        color={s.is_global ? 'info' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={s.active ? 'Ativo' : 'Inativo'}
                        color={s.active ? 'success' : 'default'}
                        variant={s.active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={s.is_global ? 'Fornecedores globais não podem ser editados' : 'Editar'}>
                        <span>
                          <IconButton size="small" onClick={() => openEdit(s)} disabled={s.is_global}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={s.is_global ? 'Fornecedores globais não podem ser excluídos' : 'Excluir'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setToDelete(s)}
                            disabled={s.is_global}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
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
        <SupplierFormDialog
          open={formOpen}
          supplier={editing}
          onClose={() => setFormOpen(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir fornecedor"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
