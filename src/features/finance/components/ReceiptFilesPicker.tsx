import { Chip, Stack } from '@mui/material'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { AttachFileButton } from '@/components/common/AttachFileButton'
import { RECEIPT_ACCEPT } from './EntryReceiptsSection'

/**
 * Abre um arquivo local (ainda não enviado) em nova aba.
 * Chrome renderiza PDF e imagem nativamente a partir de uma blob URL;
 * a URL é revogada depois que a aba carrega, pra não vazar memória.
 */
function openLocalFile(file: File) {
  const url = URL.createObjectURL(file)
  const tab = window.open(url, '_blank', 'noopener')
  if (!tab) {
    // Pop-up bloqueado: cai no mesmo comportamento de um link comum.
    window.location.href = url
    return
  }
  // Tempo suficiente pra aba iniciar o download do blob antes de revogar.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Seleção de comprovantes de pagamento antes da liquidação/confirmação.
 * Botão padrão (AttachFileButton) + chips dos arquivos escolhidos.
 * Só guarda os arquivos em memória; o envio acontece depois que a API
 * confirma o pagamento (ver uploadReceiptsOrThrow).
 * Clicar no chip abre o arquivo em nova aba pra conferência.
 */
export function ReceiptFilesPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[]
  onChange: (next: File[]) => void
  disabled?: boolean
}) {
  return (
    <Stack spacing={1}>
      <AttachFileButton
        label="Anexar comprovante de pagamento"
        multiple
        accept={RECEIPT_ACCEPT}
        disabled={disabled}
        onFiles={(picked) => onChange([...files, ...picked])}
      />
      {files.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {files.map((f, i) => (
            <Chip
              key={`${f.name}-${i}`}
              label={f.name}
              size="small"
              icon={<OpenInNewRoundedIcon />}
              title="Abrir em nova aba"
              onClick={() => openLocalFile(f)}
              onDelete={disabled ? undefined : () => onChange(files.filter((_, j) => j !== i))}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
