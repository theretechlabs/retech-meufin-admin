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
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  deletePropertyDocument,
  listPropertyDocuments,
  propertyDocumentDownloadURL,
  uploadPropertyDocument,
  type Property,
  type PropertyDocType,
  type PropertyDocument,
} from '../api'
import {
  errorMessage,
  formatDate,
  patrimonyKeys,
} from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'

type FormValues = {
  doc_type: PropertyDocType
  notes: string
}

const emptyForm: FormValues = { doc_type: 'escritura', notes: '' }

/**
 * Documentos do imóvel (escritura, matrícula, carnê de IPTU, ...): upload de
 * quantos arquivos quiser, com tipo e observação.
 */
export function PropertyDocumentsDialog({
  property,
  onClose,
}: {
  property: Property
  onClose: () => void
}) {
  const qc = useQueryClient()
  const propertyDocType = useCatalog('patrimony.property_doc_type')
  const [file, setFile] = useState<File | null>(null)
  const [toDelete, setToDelete] = useState<PropertyDocument | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: patrimonyKeys.documents(property.id),
    queryFn: () => listPropertyDocuments(property.id),
  })

  const { control, handleSubmit, reset } = useForm<FormValues>({ defaultValues: emptyForm })

  const uploadMutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!file) throw new Error('Selecione um arquivo')
      return uploadPropertyDocument(property.id, {
        doc_type: values.doc_type,
        notes: values.notes.trim() || null,
        file,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patrimonyKeys.documents(property.id) })
      reset(emptyForm)
      setFile(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (doc: PropertyDocument) => deletePropertyDocument(property.id, doc.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patrimonyKeys.documents(property.id) })
      setToDelete(null)
    },
  })

  const download = async (doc: PropertyDocument) => {
    const url = await propertyDocumentDownloadURL(property.id, doc.id)
    window.open(url, '_blank', 'noopener')
  }

  const submit = handleSubmit((values) => uploadMutation.mutate(values))
  const docs = data ?? []

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Documentos — {property.name}</DialogTitle>
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
                    required
                    value={field.value}
                    onChange={field.onChange}
                    options={propertyDocType.options}
                    loading={propertyDocType.isLoading}
                    disableClearable
                  />
                )}
              />
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Observação (opcional)" fullWidth />
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
                icon={<DescriptionRoundedIcon />}
                title="Nenhum documento"
                description="Guarde a escritura, a matrícula, o carnê de IPTU e o que mais precisar deste imóvel."
              />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Arquivo</TableCell>
                    <TableCell>Observação</TableCell>
                    <TableCell>Enviado em</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {docs.map((doc) => (
                    <TableRow key={doc.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {propertyDocType.labelOf(doc.doc_type)}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{doc.file_name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{doc.notes || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{formatDate(doc.created_at)}</TableCell>
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
        description={`Excluir "${toDelete?.file_name}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
