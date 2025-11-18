interface LocationAddressProps {
  address: string;
}

export function LocationAddress({ address }: LocationAddressProps) {
  return (
    <div className="text-xs text-muted-foreground/80 mt-1 max-w-xs text-left">
      {address}
    </div>
  );
}
