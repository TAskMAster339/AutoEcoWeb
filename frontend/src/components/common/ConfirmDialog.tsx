import { useEffect, useId, type KeyboardEvent, type ReactNode } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    IconButton,
    Stack,
    Typography,
    useMediaQuery,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'

interface ConfirmDialogProps {
    open: boolean
    title: string
    message: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    /** danger (default) — red confirm button; primary — purple accent. */
    tone?: 'danger' | 'primary'
    /** Override the leading tile icon. */
    icon?: ReactNode
    /** True while the action is running: buttons disabled, spinner in confirm. */
    pending?: boolean
    /** Optional mutation error to show inside the dialog. */
    error?: string | null
    onConfirm: () => void
    onClose: () => void
}

const TONE_ICON: Record<'danger' | 'primary', ReactNode> = {
    danger: <WarningAmberOutlinedIcon fontSize="small" />,
    primary: <InfoOutlinedIcon fontSize="small" />,
}

/**
 * Confirmation modal for dangerous actions (delete user, etc.).
 * Squared design: 10px paper, 8px icon tile and buttons; backdrop darkens
 * (and blurs slightly) while the dialog is open. Buttons stack full-width
 * on mobile for large touch targets.
 */
export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    tone = 'danger',
    icon,
    pending = false,
    error = null,
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
    const titleId = useId()
    const messageId = useId()
    const IconNode = icon ?? TONE_ICON[tone]
    const danger = tone === 'danger'
    const accent = danger ? theme.palette.error : theme.palette.primary

    // The app is a fixed frame: only <main> scrolls, and MUI's modal scroll lock
    // only targets <body> — so without this the admin table would keep scrolling
    // behind the dialog. Lock the app scroll container while open.
    useEffect(() => {
        if (!open) return
        const main = document.querySelector('main')
        if (!main) return
        const prev = main.style.overflowY
        main.style.overflowY = 'hidden'
        return () => {
            main.style.overflowY = prev
        }
    }, [open])

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            if (!pending) onClose()
            return
        }
        if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
        event.preventDefault()
        event.stopPropagation()
        if (!pending) onConfirm()
    }

    return (
        <Dialog
            open={open}
            onClose={pending ? undefined : onClose}
            fullWidth
            maxWidth="xs"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            onKeyDown={handleKeyDown}
            slotProps={{
                backdrop: {
                    sx: {
                        backgroundColor: 'rgba(12, 12, 16, 0.62)',
                        backdropFilter: 'blur(2px)',
                    },
                },
                paper: { sx: { borderRadius: '10px', p: { xs: 1.5, sm: 2 } } },
            }}
        >
            {/* overflow visible: the close button's intentional -4px offset (mr:-0.5)
          otherwise widens scrollWidth and MUI's overflow-x:auto renders a
          horizontal scrollbar right under the text. Content is small — it
          never needs an internal scrollbar. */}
            <DialogContent sx={{ p: 0, pb: 1.5, overflow: 'visible' }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            flexShrink: 0,
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: alpha(accent.main, theme.palette.mode === 'dark' ? 0.22 : 0.1),
                            color: accent.main,
                        }}
                    >
                        {IconNode}
                    </Box>
                    <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.5}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                            <Typography id={titleId} variant="h6">
                                {title}
                            </Typography>
                            <IconButton
                                size="small"
                                onClick={onClose}
                                disabled={pending}
                                aria-label="Закрыть"
                                sx={{ mt: -0.5, mr: -0.5 }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                        <Typography id={messageId} variant="body2" color="text.secondary">
                            {message}
                        </Typography>
                    </Stack>
                </Stack>
            </DialogContent>
            {error && (
                <Alert severity="error" sx={{ borderRadius: '8px', mb: 1.5 }}>
                    {error}
                </Alert>
            )}
            <DialogActions
                sx={{
                    p: 0,
                    pt: 1,
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: isMobile ? 'stretch' : 'space-between',
                    gap: 1,
                    '& > :not(style) ~ :not(style)': { ml: 0 },
                }}
            >
                <Button variant="outlined" color="inherit" fullWidth={isMobile} onClick={onClose} disabled={pending}>
                    {cancelLabel}
                </Button>
                <Button
                    variant="contained"
                    color={danger ? 'error' : 'primary'}
                    fullWidth={isMobile}
                    onClick={onConfirm}
                    disabled={pending}
                    startIcon={pending ? <CircularProgress size={14} color="inherit" /> : undefined}
                >
                    {pending ? `${confirmLabel}…` : confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
