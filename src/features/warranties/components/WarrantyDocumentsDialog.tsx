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
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  deleteWarrantyDocument,
  listWarrantyDocuments,
  uploadWarrantyDocument,
  warrantyDocumentDownloadURL,
  type Warranty,
  type WarrantyDocType,
  type WarrantyDocument,
} from '../api'
import { DOC_TYPE_LABEL, DOC_TYPE_OPTIONS, errorMessage, formatDate, warrantyKeys } from '../constants'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'

type FormValues = {
  doc_type: WarrantyDocType
  notes: string
}

const emptyForm: FormValues = { doc_type: 'nota_fiscal', notes: '' }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Documentos da garantia: nota fiscal, certificado, termo da garantia estendida,
 * manual. Upload de quantos arquivos quiser, com download e exclusão.
 */
export function WarrantyDocumentsDialog({
  warranty,
  onClose,
}: {
  warranty: Warranty
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [toDelete, setToDelete] = useState<WarrantyDocument | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: warrantyKeys.documents(warranty.id),
    queryFn: () => listWarrantyDocuments(warranty.id),
  })

  const { control, handleSubmit, reset } = useForm<FormValues>({ defaultValues: emptyForm })

  const uploadMutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!file) throw new Error('Selecione um arquivo')
      return uploadWarrantyDocument(warranty.id, {
        doc_type: values.doc_type,
        notes: values.notes.trim() || null,
        file,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warrantyKeys.documents(warranty.id) })
      reset(emptyForm)
      setFile(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (doc: WarrantyDocument) => deleteWarrantyDocument(warranty.id, doc.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warrantyKeys.documents(warranty.id) })
      setToDelete(null)
    },
  })

  const download = async (doc: WarrantyDocument) => {
    const url = await warrantyDocumentDownloadURL(warranty.id, doc.id)
    window.open(url, '_blank', 'noopener')
  }

  const submit = handleSubmit((values) => uploadMutation.mutate(values))
  const docs = data ?? []

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Documentos — {warranty.item_name}</DialogTitle>
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
                    options={DOC_TYPE_OPTIONS}
                    required
                    disableClearable
                  />
                )}
              />
              <Controller
                name="notes"
                control={control}
                render={({ field }) => <TextField {...field} label="Observação (opcional)" fullWidth />}
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
              <Button variant="contained" onClick={submit} disabled={!file || uploadMutation.isPending}>
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
                icon={<ReceiptLongRoundedIcon />}
                title="Nenhum documento"
                description="Anexe a nota fiscal, o certificado de garantia e o termo da garantia estendida."
              />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Arquivo</TableCell>
                    <TableCell>Tamanho</TableCell>
                    <TableCell>Data</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {docs.map((doc) => (
                    <TableRow key={doc.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{doc.original_file_name}</TableCell>
                      <TableCell>{formatSize(doc.size_bytes)}</TableCell>
                      <TableCell>{formatDate(doc.created_at)}</TableCell>
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
