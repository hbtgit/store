import { Box, Text } from "@saleor/macaw-ui";
import { ReactNode } from "react";

export const formatMoney = (cents: number | null | undefined, currency = "USD") =>
  cents == null
    ? "-"
    : new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);

export const formatRate = (bp: number) => `${(bp / 100).toFixed(2)}%`;

/** Parses "12,500.50" style input into cents; returns null for empty input. */
export const parseMoney = (value: string): number | null => {
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};

export const humanize = (value: string) => value.replace(/_/g, " ");

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box padding={8} display="flex" flexDirection="column" gap={6}>
      <Text size={10} fontWeight="bold">
        {title}
      </Text>
      {children}
    </Box>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Text size={7} fontWeight="bold">
        {title}
      </Text>
      {children}
    </Box>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <Text color="critical1">{error}</Text> : null;
}

export function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) return <Text color="default2">{empty}</Text>;
  return (
    <Box as="table" width="100%" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {head.map((h) => (
            <Box
              as="th"
              key={h}
              textAlign="left"
              paddingY={2}
              paddingRight={4}
              borderBottomStyle="solid"
              borderBottomWidth={1}
              borderColor="default1"
            >
              <Text size={2} color="default2">
                {h}
              </Text>
            </Box>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i}>
            {cells.map((cell, j) => (
              <Box
                as="td"
                key={j}
                paddingY={2}
                paddingRight={4}
                borderBottomStyle="solid"
                borderBottomWidth={1}
                borderColor="default1"
              >
                {typeof cell === "string" || typeof cell === "number" ? (
                  <Text size={3}>{cell}</Text>
                ) : (
                  cell
                )}
              </Box>
            ))}
          </tr>
        ))}
      </tbody>
    </Box>
  );
}

/** Native select styled to sit next to macaw inputs; avoids macaw's Option typing for simple enums. */
export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Box display="flex" flexDirection="column" gap={1}>
      <Text size={2} color="default2">
        {label}
      </Text>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: 8, borderRadius: 4 }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Box>
  );
}
