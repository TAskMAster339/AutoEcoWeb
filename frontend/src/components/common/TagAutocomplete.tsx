import { Autocomplete, Box, TextField, Typography } from '@mui/material'
import type { Tag } from '../../api/types'

interface TagAutocompleteProps {
  tags: Tag[]
  value: string | null
  onChange: (tagId: string | null) => void
}

/** Поисковый выбор тега с цветом — единый для форм создания и редактирования. */
export function TagAutocomplete({ tags, value, onChange }: TagAutocompleteProps) {
  const selectedTag = tags.find((tag) => tag.id === value) ?? null

  return (
    <Autocomplete
      options={tags}
      value={selectedTag}
      onChange={(_, tag) => onChange(tag?.id ?? null)}
      getOptionLabel={(tag) => tag.name}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      openOnFocus
      autoHighlight
      selectOnFocus
      clearOnEscape
      noOptionsText="Тег не найден"
      renderOption={(props, tag) => (
        <Box
          component="li"
          {...props}
          key={tag.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            minHeight: 44,
            width: '100%',
          }}
        >
          <Typography component="span" noWrap>{tag.name}</Typography>
          <Box
            aria-label={`Цвет тега ${tag.name}`}
            sx={{
              width: 20,
              height: 20,
              borderRadius: '4px',
              bgcolor: tag.color,
              border: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
              ml: 'auto',
            }}
          />
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Тег"
          placeholder="Найти тег по названию"
          fullWidth
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {selectedTag && (
                    <Box
                      aria-label={`Цвет выбранного тега ${selectedTag.name}`}
                      sx={{
                        width: 20,
                        height: 20,
                        mr: 0.5,
                        borderRadius: '4px',
                        bgcolor: selectedTag.color,
                        border: '1px solid',
                        borderColor: 'divider',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  )
}
