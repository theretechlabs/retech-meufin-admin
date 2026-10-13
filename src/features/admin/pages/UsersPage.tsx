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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  IconButton,
  InputAdornment,
} from '@mui/material'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { MultiAutocompleteField } from '@/components/fields/MultiAutocompleteField'
import { ACTIVE_FILTER_OPTIONS, type AutocompleteOption } from '@/components/fields/options'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded'
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  createUser,
  deleteUser,
  listRoles,
  listUsers,
  resetUserPassword,
  setUserRoles,
  setUserStatus,
  updateUser,
  type AdminUser,
  type ListUsersParams,
  type Role,
} from '../api'
import { adminKeys, errorMessage } from '../constants'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'


function isMaster(u: AdminUser): boolean {
  return u.roles?.some((r) => r.code === 'master') ?? false
}

/** Opções de grupo para seleção múltipla: nome como rótulo, código como descrição. */
function roleOptions(roles: Role[]): AutocompleteOption[] {
  return roles.map((r) => ({ value: r.id, label: r.name, description: r.code }))
}

// ---------------------------------------------------------------------------
// Dialog: Novo usuário
// ---------------------------------------------------------------------------

type CreateFormValues = {
  email: string
  name: string
  password: string
  role_ids: string[]
}

const emptyCreate: CreateFormValues = { email: '', name: '', password: '', role_ids: [] }

function CreateUserDialog({
  open,
  roles,
  onClose,
}: {
  open: boolean
  roles: Role[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({ values: emptyCreate })

  const mutation = useMutation({
    mutationFn: (values: CreateFormValues) =>
      createUser({
        email: values.email.trim(),
        name: values.name.trim(),
        password: values.password,
        role_ids: values.role_ids,
      }),
    onSuccess: () => {
      show('Usuário criado com sucesso.')
      qc.invalidateQueries({ queryKey: adminKeys.all })
      reset(emptyCreate)
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Novo usuário</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Informe o nome' }}
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
            name="email"
            control={control}
            rules={{
              required: 'Informe o e-mail',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail inválido' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                type="email"
                label="E-mail"
                fullWidth
                required
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
              />
            )}
          />
          <Controller
            name="password"
            control={control}
            rules={{
              required: 'Informe a senha',
              minLength: { value: 8, message: 'Mínimo de 8 caracteres' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                type="password"
                label="Senha"
                fullWidth
                required
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
              />
            )}
          />
          <Controller
            name="role_ids"
            control={control}
            render={({ field }) => (
              <MultiAutocompleteField
                label="Grupos"
                value={field.value}
                onChange={field.onChange}
                options={roleOptions(roles)}
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
          Criar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Editar nome
// ---------------------------------------------------------------------------

function EditNameDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient()
  const { show } = useToast()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string }>({ values: { name: user.name } })

  const mutation = useMutation({
    mutationFn: (values: { name: string }) =>
      updateUser(user.id, { name: values.name.trim(), version: user.version }),
    onSuccess: () => {
      show('Usuário atualizado com sucesso.')
      qc.invalidateQueries({ queryKey: adminKeys.all })
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Editar usuário</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Informe o nome' }}
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
          <TextField label="E-mail" value={user.email} fullWidth disabled />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} variant="contained" disabled={mutation.isPending}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Atribuir grupos
// ---------------------------------------------------------------------------

function AssignRolesDialog({
  user,
  roles,
  onClose,
}: {
  user: AdminUser
  roles: Role[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const [selected, setSelected] = useState<string[]>(user.roles?.map((r) => r.id) ?? [])

  const mutation = useMutation({
    mutationFn: () => setUserRoles(user.id, { role_ids: selected, version: user.version }),
    onSuccess: () => {
      show('Grupos do usuário atualizados.')
      qc.invalidateQueries({ queryKey: adminKeys.all })
      onClose()
    },
  })

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Atribuir grupos</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <MultiAutocompleteField
            label="Grupos"
            value={selected}
            onChange={setSelected}
            options={roleOptions(roles)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={() => mutation.mutate()} variant="contained" disabled={mutation.isPending}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Resetar senha
// ---------------------------------------------------------------------------

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: AdminUser
  onClose: () => void
}) {
  const { show: showToast } = useToast()
  const [show, setShow] = useState(false)
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<{ new_password: string; confirm_password: string }>({
    values: { new_password: '', confirm_password: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: { new_password: string }) =>
      resetUserPassword(user.id, { new_password: values.new_password, version: user.version }),
    onSuccess: () => {
      showToast('Senha alterada com sucesso.')
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate({ new_password: values.new_password }))

  const eyeAdornment = (
    <InputAdornment position="end">
      <IconButton
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        onClick={() => setShow((v) => !v)}
        edge="end"
        size="small"
      >
        {show ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
      </IconButton>
    </InputAdornment>
  )

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Resetar senha</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <TextField label="Usuário" value={user.email} fullWidth disabled />
          <Controller
            name="new_password"
            control={control}
            rules={{
              required: 'Informe a nova senha',
              minLength: { value: 8, message: 'Mínimo de 8 caracteres' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                type={show ? 'text' : 'password'}
                label="Nova senha"
                fullWidth
                required
                error={Boolean(errors.new_password)}
                helperText={errors.new_password?.message}
                slotProps={{ input: { endAdornment: eyeAdornment } }}
              />
            )}
          />
          <Controller
            name="confirm_password"
            control={control}
            rules={{
              required: 'Confirme a nova senha',
              validate: (v, values) => v === values.new_password || 'As senhas não coincidem',
            }}
            render={({ field }) => (
              <TextField
                {...field}
                type={show ? 'text' : 'password'}
                label="Confirmar nova senha"
                fullWidth
                required
                error={Boolean(errors.confirm_password)}
                helperText={errors.confirm_password?.message}
                slotProps={{ input: { endAdornment: eyeAdornment } }}
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
          Resetar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

type Filters = {
  email: string
  name: string
  active: '' | 'true' | 'false'
  role: string
}

const emptyFilters: Filters = { email: '', name: '', active: '', role: '' }

export default function UsersPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<Filters>(emptyFilters)

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [assignUser, setAssignUser] = useState<AdminUser | null>(null)
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  const [toDelete, setToDelete] = useState<AdminUser | null>(null)
  const [toToggle, setToToggle] = useState<AdminUser | null>(null)

  const params: ListUsersParams = useMemo(
    () => ({
      limit: pageSize,
      offset: page * pageSize,
      email: filters.email.trim() || undefined,
      name: filters.name.trim() || undefined,
      active: filters.active === '' ? undefined : filters.active === 'true',
      role: filters.role || undefined,
    }),
    [page, pageSize, filters]
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => listUsers(params),
  })

  const rolesQuery = useQuery({
    queryKey: adminKeys.roles({ include_permissions: false }),
    queryFn: () => listRoles(),
  })
  const roles = useMemo(() => rolesQuery.data?.roles ?? [], [rolesQuery.data])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all })
      setToDelete(null)
      show('Usuário excluído.')
    },
  })

  const statusMutation = useMutation({
    mutationFn: (u: AdminUser) => setUserStatus(u.id, { active: !u.active, version: u.version }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all })
      setToToggle(null)
      show('Status do usuário atualizado.')
    },
  })

  const users = data?.users ?? []
  const total = data?.total ?? 0

  const updateFilter = (patch: Partial<Filters>) => {
    setPage(0)
    setFilters((f) => ({ ...f, ...patch }))
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie os usuários, seus grupos de acesso e credenciais."
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Novo usuário
          </Button>
        }
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="E-mail"
            value={filters.email}
            onChange={(e) => updateFilter({ email: e.target.value })}
            size="small"
            fullWidth
          />
          <TextField
            label="Nome"
            value={filters.name}
            onChange={(e) => updateFilter({ name: e.target.value })}
            size="small"
            fullWidth
          />
          <AutocompleteField
            label="Status"
            size="small"
            emptyLabel="Todos"
            value={filters.active}
            onChange={(v) => updateFilter({ active: v as Filters['active'] })}
            options={ACTIVE_FILTER_OPTIONS}
            fullWidth={false}
            sx={{ minWidth: 160 }}
          />
          <AutocompleteField
            label="Grupo"
            size="small"
            emptyLabel="Todos"
            value={filters.role}
            onChange={(v) => updateFilter({ role: v })}
            options={roles.map((r) => ({ value: r.code, label: r.name }))}
            fullWidth={false}
            sx={{ minWidth: 200 }}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<GroupRoundedIcon />}
          title="Nenhum usuário encontrado"
          description="Ajuste os filtros ou cadastre um novo usuário."
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>E-mail</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Grupos</TableCell>
                  <TableCell>Criado em</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => {
                  const master = isMaster(u)
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={u.active ? 'Ativo' : 'Inativo'}
                          color={u.active ? 'success' : 'default'}
                          variant={u.active ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {u.roles?.length ? (
                            u.roles.map((r) => (
                              <Chip key={r.id} size="small" label={r.name} variant="outlined" />
                            ))
                          ) : (
                            <Box component="span" sx={{ color: 'text.disabled' }}>
                              —
                            </Box>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar nome">
                          <IconButton size="small" onClick={() => setEditUser(u)}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Atribuir grupos">
                          <IconButton size="small" onClick={() => setAssignUser(u)}>
                            <AdminPanelSettingsRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={u.active ? 'Desativar' : 'Ativar'}>
                          <span>
                            <IconButton
                              size="small"
                              color={u.active ? 'warning' : 'success'}
                              disabled={master && u.active}
                              onClick={() => setToToggle(u)}
                            >
                              {u.active ? (
                                <ToggleOffRoundedIcon fontSize="small" />
                              ) : (
                                <ToggleOnRoundedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Resetar senha">
                          <IconButton size="small" onClick={() => setResetUser(u)}>
                            <LockResetRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={master ? 'Usuário master não pode ser excluído' : 'Excluir'}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={master}
                              onClick={() => setToDelete(u)}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePaginationBR
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}

      {createOpen && (
        <CreateUserDialog open={createOpen} roles={roles} onClose={() => setCreateOpen(false)} />
      )}
      {editUser && <EditNameDialog user={editUser} onClose={() => setEditUser(null)} />}
      {assignUser && (
        <AssignRolesDialog user={assignUser} roles={roles} onClose={() => setAssignUser(null)} />
      )}
      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          onClose={() => setResetUser(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir usuário"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(toToggle)}
        title={toToggle?.active ? 'Desativar usuário' : 'Ativar usuário'}
        description={
          toToggle?.active
            ? `Desativar "${toToggle?.name}"? O usuário perderá o acesso.`
            : `Ativar "${toToggle?.name}"? O usuário poderá acessar novamente.`
        }
        confirmLabel={toToggle?.active ? 'Desativar' : 'Ativar'}
        loading={statusMutation.isPending}
        onConfirm={() => toToggle && statusMutation.mutate(toToggle)}
        onClose={() => setToToggle(null)}
      />
    </>
  )
}
