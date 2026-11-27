import { Box, Button } from "@saleor/macaw-ui";

import { humanize } from "./ui";

export function StatusActions<S extends string>({
  next,
  onChange,
  disabled,
}: {
  next: readonly S[];
  onChange: (status: S) => void;
  disabled?: boolean;
}) {
  if (next.length === 0) return null;
  return (
    <Box display="flex" gap={2} flexWrap="wrap">
      {next.map((s) => (
        <Button
          key={s}
          size="small"
          variant="secondary"
          disabled={disabled}
          onClick={() => onChange(s)}
        >
          {humanize(s)}
        </Button>
      ))}
    </Box>
  );
}
