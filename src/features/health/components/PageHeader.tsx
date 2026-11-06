import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            fontFamily: (t) => t.typography.h4.fontFamily,
            // Telefone: display grande não cabe em 390px (quebra em 2 linhas).
            fontSize: { xs: '1.5rem', sm: '2.125rem' },
            lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, display: { xs: 'none', sm: 'block' } }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ width: { xs: '100%', sm: 'auto' }, '& > *': { flex: { xs: '1 1 auto', sm: '0 0 auto' } } }}
        >
          {action}
        </Stack>
      )}
    </Stack>
  )
}
