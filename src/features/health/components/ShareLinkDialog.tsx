import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import EmailRoundedIcon from '@mui/icons-material/EmailRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createShareLink, listShareLinks, revokeShareLink, type ShareLink } from '../api'
import { errorMessage, healthKeys, SHARE_TTL_OPTIONS } from '../constants'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { numericOptions } from '@/components/fields/options'
import { formatDateTimeBR } from '@/utils/dates'

const STATUS_CHIP: Record<ShareLink['status'], { label: string; color: 'success' | 'default' | 'error' }> = {
  active: { label: 'ativo', color: 'success' },
  expired: { label: 'expirado', color: 'default' },
  revoked: { label: 'revogado', color: 'error' },
}

/**
 * Compartilhar painéis do membro com o médico: cria link público temporário
 * (copiar / WhatsApp / e-mail) e gerencia os links existentes (revogar).
 */
export function ShareLinkDialog({
  open,
  memberId,
  memberName,
  onClose,
}: {
  open: boolean
  memberId: string
  memberName: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState(0)
  const [title, setTitle] = useState('')
  const [ttl, setTtl] = useState(48)
  const [created, setCreated] = useState<ShareLink | null>(null)
  const [copied, setCopied] = useState(false)

  const linksKey = [...healthKeys.all, 'share-links'] as const
  const { data: links = [] } = useQuery({
    queryKey: linksKey,
    queryFn: listShareLinks,
    enabled: open && tab === 1,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createShareLink({
        family_member_id: memberId,
        title: title.trim() || undefined,
        expires_in_hours: ttl,
      }),
    onSuccess: (link) => {
      setCreated(link)
      qc.invalidateQueries({ queryKey: linksKey })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeShareLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: linksKey }),
  })

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareText = (url: string) =>
    `Encaminho a evolução dos meus exames (link temporário): ${url}`

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Compartilhar com o médico</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Novo link" />
          <Tab label="Links criados" />
        </Tabs>

        {tab === 0 && !created && (
          <Stack spacing={2.5}>
            {createMutation.isError && (
              <Alert severity="error">{errorMessage(createMutation.error)}</Alert>
            )}
            <Alert severity="info" variant="outlined">
              O link mostra os <strong>painéis evolutivos de {memberName}</strong>, somente
              leitura, sem login — e expira automaticamente.
            </Alert>
            <TextField
              label="Título (opcional)"
              placeholder='Ex.: "Para Dr. João Silva"'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
            />
            <AutocompleteField
              label="Validade"
              value={String(ttl)}
              onChange={(v) => setTtl(Number(v))}
              options={numericOptions(SHARE_TTL_OPTIONS)}
              disableClearable
            />
          </Stack>
        )}

        {tab === 0 && created && (
          <Stack spacing={2}>
            <Alert severity="success">
              Link criado! Expira em {formatDateTimeBR(created.expires_at)}.
            </Alert>
            <TextField
              value={created.url}
              fullWidth
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={copied ? 'Copiado!' : 'Copiar link'}>
                      <IconButton onClick={() => copy(created.url)}>
                        <ContentCopyRoundedIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<WhatsAppIcon />}
                href={`https://wa.me/?text=${encodeURIComponent(shareText(created.url))}`}
                target="_blank"
                rel="noopener"
              >
                WhatsApp
              </Button>
              <Button
                variant="outlined"
                startIcon={<EmailRoundedIcon />}
                href={`mailto:?subject=${encodeURIComponent('Evolução de exames')}&body=${encodeURIComponent(shareText(created.url))}`}
              >
                E-mail
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Você pode revogar este link a qualquer momento na aba "Links criados".
            </Typography>
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={1}>
            {links.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nenhum link criado ainda.
              </Typography>
            )}
            {links.map((l) => (
              <Box
                key={l.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {l.title || 'Sem título'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Expira {formatDateTimeBR(l.expires_at)} · {l.view_count} visualização(ões)
                  </Typography>
                </Box>
                <Chip size="small" variant="outlined" {...STATUS_CHIP[l.status]} />
                {l.status === 'active' && (
                  <>
                    <Tooltip title="Copiar link">
                      <IconButton size="small" onClick={() => copy(l.url)}>
                        <ContentCopyRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Revogar">
                      <IconButton
                        size="small"
                        color="error"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(l.id)}
                      >
                        <BlockRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Fechar
        </Button>
        {tab === 0 && !created && (
          <Button
            variant="contained"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            Gerar link
          </Button>
        )}
        {tab === 0 && created && (
          <Button variant="outlined" onClick={() => setCreated(null)}>
            Criar outro
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
