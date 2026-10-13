import { useState } from 'react'
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { AttachFileButton } from '@/components/common/AttachFileButton'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FolderSharedRoundedIcon from '@mui/icons-material/FolderSharedRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import {
  deleteMemberDocument,
  listMemberDocuments,
  memberDocumentDownloadURL,
  uploadMemberDocument,
  type FamilyMember,
  type MemberDocType,
  type MemberDocument,
} from '../api'
import {
  errorMessage,
  healthKeys,
  MEMBER_DOC_TYPE_LABEL,
  MEMBER_DOC_TYPE_OPTIONS,
} from '../constants'
import { ConfirmDialog } from './ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from './StateViews'
import { AutocompleteField } from '@/components/fields/AutocompleteField'

type FormValues = {
  doc_type: MemberDocType
  label: string
  doc_number: string
  valid_until: string
  notes: string
}

const emptyForm: FormValues = {
  doc_type: 'cpf',
  label: '',
  doc_number: '',
  valid_until: '',
  notes: '',
}

function isExpired(validUntil?: string | null): boolean {
  if (!validUntil) return false
  return validUntil < new Date().toISOString().slice(0, 10)
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/**
 * Documentos pessoais do membro (cpf, rg, cnh, passaporte, ...): upload de
 * quantos arquivos quiser, com tipo, número e validade.
 */
export function MemberDocumentsDialog({
  member,
  onClose,
}: {
  member: FamilyMember
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [toDelete, setToDelete] = useState<MemberDocument | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: healthKeys.memberDocuments(member.id),
    queryFn: () => listMemberDocuments(member.id),
  })

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: emptyForm })
  const docType = useWatch({ control, name: 'doc_type' })

  const uploadMutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!file) throw new Error('Selecione um arquivo')
      return uploadMemberDocument(member.id, {
        doc_type: values.doc_type,
        label: values.label.trim() || null,
        doc_number: values.doc_number.trim() || null,
        valid_until: values.valid_until || null,
        notes: values.notes.trim() || null,
        file,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.memberDocuments(member.id) })
      reset(emptyForm)
      setFile(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (doc: MemberDocument) => deleteMemberDocument(member.id, doc.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.memberDocuments(member.id) })
      setToDelete(null)
    },
  })

  const download = async (doc: MemberDocument) => {
    const url = await memberDocumentDownloadURL(member.id, doc.id)
    window.open(url, '_blank', 'noopener')
  }

  const submit = handleSubmit((values) => uploadMutation.mutate(values))
  const docs = data ?? []

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Documentos — {member.full_name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {uploadMutation.isError && <ErrorState message={errorMessage(uploadMutation.error)} />}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="doc_type"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <AutocompleteField
                    label="Tipo de documento"
                    value={field.value}
                    onChange={field.onChange}
                    options={MEMBER_DOC_TYPE_OPTIONS}
                    required
                    disableClearable
                  />
                )}
              />
              {docType === 'outro' && (
                <Controller
                  name="label"
                  control={control}
                  rules={{ required: 'Informe o rótulo do documento' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Rótulo"
                      placeholder="Ex.: Carteirinha do plano odontológico"
                      fullWidth
                      required
                      error={Boolean(errors.label)}
                      helperText={errors.label?.message}
                    />
                  )}
                />
              )}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="doc_number"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Número (opcional)" fullWidth />
                )}
              />
              <Controller
                name="valid_until"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Validade (opcional)"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    helperText="CNH e passaporte vencem — informe para acompanhar."
                  />
                )}
              />
            </Stack>

            <AttachFileButton
              label="Escolher arquivo (PDF, imagem ou DOC)"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx"
              onFiles={(picked) => setFile(picked[0] ?? null)}
            />
            <Stack direction="row" spacing={2} alignItems="center">
              {file ? (
                <Chip label={file.name} onDelete={() => setFile(null)} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  PDF, imagem ou DOC
                </Typography>
              )}
              <Button
                variant="contained"
                onClick={submit}
                disabled={!file || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Enviando…' : 'Adicionar'}
              </Button>
            </Stack>

            <Divider />

            {isLoading ? (
              <LoadingState />
            ) : isError ? (
              <ErrorState message={errorMessage(error)} onRetry={refetch} />
            ) : docs.length === 0 ? (
              <EmptyState
                icon={<FolderSharedRoundedIcon />}
                title="Nenhum documento"
                description="Adicione CPF, RG, CNH, passaporte e o que mais precisar guardar deste membro."
              />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Número</TableCell>
                    <TableCell>Validade</TableCell>
                    <TableCell>Arquivo</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {docs.map((doc) => (
                    <TableRow key={doc.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {doc.doc_type === 'outro' && doc.label
                          ? doc.label
                          : (MEMBER_DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type)}
                      </TableCell>
                      <TableCell>{doc.doc_number || '—'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <span>{formatDate(doc.valid_until)}</span>
                          {isExpired(doc.valid_until) && (
                            <Chip size="small" color="error" label="Vencido" />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {doc.original_file_name}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Baixar">
                          <IconButton size="small" onClick={() => download(doc)}>
                            <DownloadRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton size="small" color="error" onClick={() => setToDelete(doc)}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir documento"
        description={`Excluir "${toDelete?.original_file_name}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
